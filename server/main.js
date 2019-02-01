const publicationFunctions = {};
export function registerPubFunction(name, fn) {
  publicationFunctions[name] = fn;
}
function getDataHandleAndInterval(tableId, publicationCursor, options, canOverride) {
  const sortKeys = _.keys(options.sort || {});
  const fieldKeys = _.keys(options.fields || {});
  const presentSortKeys = sortKeys.filter((sk) => {
    if (fieldKeys.includes(sk)) {
      return true;
    }
    const parts = sk.split(".");
    return parts.some((p, i) => fieldKeys.includes(parts.slice(0, i).join(".")));
  });
  const hasSortableFields = presentSortKeys.length === sortKeys.length;
  const oldLimit = publicationCursor._cursorDescription.options.limit;
  const recordIds = [];
  let updateRecords;
  let initializing = true;
  let dataHandle;

  // NOTE: the sort is over a subset of the fields we are returning
  // as such, we don't care about the order of the document ID's.
  // this means we can use the oplog to observe and sort on the client
  if (hasSortableFields) {
    dataHandle = publicationCursor.observeChanges({
      added: (id, fields) => {
        recordIds.push(id);
        if (canOverride) {
          this.added(publicationCursor._cursorDescription.collectionName, id, fields);
        }
        if (!initializing) {
          updateRecords();
        }
      },
      changed: (id, fields) => {
        if (canOverride) {
          this.changed(publicationCursor._cursorDescription.collectionName, id, fields);
        }
      },
      removed: (id) => {
        recordIds.splice(recordIds.indexOf(id), 1);
        if (canOverride) {
          this.removed(publicationCursor._cursorDescription.collectionName, id);
        }
        updateRecords();
      }
    });
  }
  else {
    dataHandle = publicationCursor.observeChanges({
      _suppress_initial: true,
      addedBefore: (_id, doc, beforeId) => {
        recordIds.splice(recordIds.indexOf(beforeId), 0, _id);
        if (canOverride) {
          this.added(publicationCursor._cursorDescription.collectionName, _id, doc);
        }
        if (!initializing) {
          updateRecords();
        }
      },
      movedBefore: (_id, beforeId) => {
        recordIds.splice(recordIds.indexOf(_id), 1);
        recordIds.splice(recordIds.indexOf(beforeId), 0, _id);
        updateRecords();
      },
      changed: (_id, fields) => {
        if (canOverride) {
          this.changed(publicationCursor._cursorDescription.collectionName, _id, fields);
        }
      },
      removed: (_id) => {
        recordIds.splice(recordIds.indexOf(_id), 1);
        if (canOverride) {
          this.removed(publicationCursor._cursorDescription.collectionName, _id);
        }
        updateRecords();
      }
    });
  }
  updateRecords = () => {
    delete publicationCursor._cursorDescription.options.limit;
    const recordsTotal = options.skipCount ? options.skip + recordIds.length + 1 : publicationCursor.count();
    publicationCursor._cursorDescription.options.limit = oldLimit;
    if (!initializing) {
      this.changed("__dynamicTableInformation", tableId, { _ids: recordIds, recordsFiltered: recordsTotal, recordsTotal });
    }
    else {
      this.added("__dynamicTableInformation", tableId, { _ids: recordIds, recordsFiltered: recordsTotal, recordsTotal });
    }
  };

  if (options.throttleRefresh) {
    updateRecords = _.throttle(Meteor.bindEnvironment(updateRecords), options.throttleRefresh);
  }
  updateRecords();
  initializing = false;
  let interval;
  if (!options.skipCount) {
    interval = Meteor.setInterval(() => updateRecords(), 10000);
  }
  return { dataHandle, interval, recordIds };
}

function getPublicationCursor(publicationName, selector, options) {
  const fn = publicationFunctions[publicationName] || Meteor.default_server.publish_handlers[publicationName];
  const publicationResult = fn.call(this, selector, options);
  let publicationCursor;
  // NOTE: if we haven't explicitly stated whether we can override the default publication, lets figure it out
  // if we returned a cursor, or an array with exactly one cursor in it, we can override
  // doing so fixes a potential issue with cursors returning results with a bad sort
  // e.g., one where multiple valid sorts are possible. In this case, the table
  // information can return one set of ids and the cursor a different set of documents
  // NOT compatible with the composite publication.
  let canOverride = options.overridePublication === undefined ? undefined : options.overridePublication;
  if (_.isArray(publicationResult)) {
    publicationCursor = publicationResult[0];
    if (canOverride === undefined) {
      canOverride = publicationResult.length === 1;
    }
  }
  else {
    publicationCursor = publicationResult;
    if (canOverride === undefined) {
      canOverride = true;
    }
  }
  return { publicationResult, publicationCursor, canOverride };
}

export function simpleTablePublication(tableId, publicationName, compositePublicationNames, selector, options) {
  check(tableId, String);
  check(publicationName, String);
  check(selector, Object);
  check(options, Object);
  check(publicationFunctions[publicationName] || Meteor.default_server.publish_handlers[publicationName], Function);
  if (Kadira && Kadira._getInfo()) {
    Kadira._getInfo().trace.name += "_" + publicationName;
  }
  const { publicationCursor } = getPublicationCursor.call(this, publicationName, selector, options);
  const { dataHandle, interval, recordIds } = getDataHandleAndInterval.call(this, tableId, publicationCursor, options, false);

  this.onStop(() => {
    dataHandle.stop();
    if (interval) {
      Meteor.clearInterval(interval);
    }
    recordIds.splice(0, recordIds.length);
  });
  return {
    find() {
      return publicationCursor;
    },
    children: (compositePublicationNames || []).map((pubName) => {
      const fn = publicationFunctions[pubName] || Meteor.default_server.publish_handlers[pubName];
      check(fn, Function);
      return {
        find(play) {
          const fn = publicationFunctions[pubName] || Meteor.default_server.publish_handlers[pubName];
          return fn.call(this, play);
        }
      };
    })
  };
}

export function simpleTablePublicationArrayNew(tableId, publicationName, selector, options) {
  check(tableId, String);
  check(publicationName, String);
  check(selector, Object);
  check(options, Object);
  check(publicationFunctions[publicationName] || Meteor.default_server.publish_handlers[publicationName], Function);
  if (Kadira && Kadira._getInfo()) {
    Kadira._getInfo().trace.name += "_" + publicationName;
  }
  const { publicationResult, publicationCursor, canOverride } = getPublicationCursor.call(this, publicationName, selector, options);
  const { dataHandle, interval, recordIds } = getDataHandleAndInterval.call(this, tableId, publicationCursor, options, canOverride);
  this.onStop(() => {
    dataHandle.stop();
    if (interval) {
      Meteor.clearInterval(interval);
    }
    recordIds.splice(0, recordIds.length);
  });
  if (canOverride) {
    this.ready();
  }
  else {
    return publicationResult.slice(1);
  }
}

export function simpleTablePublicationCounts(tableId, publicationName, field, baseSelector, queries, options = {}) {
  check(tableId, String);
  check(publicationName, String);
  check(baseSelector, Object);
  check(options, Object);
  check(publicationFunctions[publicationName] || Meteor.default_server.publish_handlers[publicationName], Function);

  if (options.throttleRefresh === undefined) {
    options.throttleRefresh = 10000;
  }

  if (Kadira && Kadira._getInfo()) {
    Kadira._getInfo().trace.name += "_" + publicationName;
  }
  if (this.unblock) {
    this.unblock();
  }

  let init = true;
  const { publicationCursor } = !queries.length ? { publicationCursor: null } : getPublicationCursor.call(
    this,
    publicationName,
    baseSelector,
    { fields: { [field]: true, _id: true } }
  );

  const result = {};

  const updateRecords = () => {
    const changed = {};
    let hasChanges = false;
    return Promise.all(queries.map((value) => {
      const selector = { $and: [{ [field]: value.query }, publicationCursor._cursorDescription.selector] };
      const id = JSON.stringify(value.query).replace(/[{}.:]/g, "");
      if (id) {
        let cursor = publicationCursor._mongo.db
        .collection(publicationCursor._getCollectionName())
        .find(selector, { _id: true });
        if (value.options && value.options.limit) {
          cursor = cursor.limit(value.options.limit);
        }
        return cursor.count(true).then((count) => {
          if (result[id] !== count) {
            changed[id] = count;
            result[id] = count;
            hasChanges = true;
          }
        });
      }
      return Promise.resolve();
    }))
    .then(() => {
      if (init) {
        init = false;
        this.added("__dynamicTableGroupInfo", tableId, changed);
        this.ready();
      }
      else if (hasChanges) {
        this.changed("__dynamicTableGroupInfo", tableId, changed);
      }
    });
  };


  const throttledUpdateRecords = options.throttleRefresh ? _.throttle(updateRecords, options.throttleRefresh, { leading: true, trailing: true }) : updateRecords;

  let dataHandle;
  if (publicationCursor) {
    dataHandle = publicationCursor.observeChanges({
      added() {
        if (!init) {
          throttledUpdateRecords();
        }
      },
      changed() {
        if (!init) {
          throttledUpdateRecords();
        }
      },
      removed() {
        if (!init) {
          throttledUpdateRecords();
        }
      }
    });
  }

  updateRecords();

  this.onStop(() => {
    if (dataHandle) {
      dataHandle.stop();
    }
    this.removed("__dynamicTableGroupInfo", tableId);
  });
}

function simpleTablePublicationDistinctValuesForField(tableId, publicationName, field, selector = {}, options = {}, count = false) {
  check(tableId, String);
  check(field, String);
  check(publicationName, String);
  check(selector, Object);
  if (Kadira && Kadira._getInfo()) {
    Kadira._getInfo().trace.name += "_" + publicationName;
  }

  if (options.throttleRefresh === undefined) {
    options.throttleRefresh = 10000;
  }

  const { publicationCursor } = getPublicationCursor.call(
    this,
    publicationName,
    selector,
    { fields: { _id: true, [field]: true } }
  );

  let keys = {};
  let init = true;
  const updateRecords = () => {
    publicationCursor._mongo.db.collection(publicationCursor._getCollectionName())
    .distinct(field, publicationCursor._cursorDescription.selector)
    .then((distinctValues) => {
      const newKeys = {};
      let changed = false;
      distinctValues.forEach((distinctValue) => {
        if (!newKeys[JSON.stringify(distinctValue)]) {
          newKeys[JSON.stringify(distinctValue)] = 1;
        }
      });
      const sortedOldKeys = _.sortBy(Object.keys(keys));
      const sortedNewKeys = _.sortBy(Object.keys(newKeys));
      changed = !_.isEqual(sortedOldKeys, sortedNewKeys);
      if (init) {
        init = false;
        this.added("__dynamicTableDistinctValues", tableId, {
          groups: distinctValues.map(dv => ({
            value: dv
          }))
        });
        this.ready();
      }
      else if (changed) {
        keys = newKeys;
        this.changed("__dynamicTableDistinctValues", tableId, {
          groups: distinctValues.map(dv => ({
            value: dv
          }))
        });
      }
    });
  };

  const throttledUpdateRecords = options.throttleRefresh ? _.throttle(updateRecords, options.throttleRefresh, { leading: true, trailing: true }) : updateRecords;

  const dataHandle = publicationCursor.observeChanges({
    added() {
      if (!init) {
        throttledUpdateRecords();
      }
    },
    changed() {
      if (!init) {
        throttledUpdateRecords();
      }
    },
    removed() {
      if (!init) {
        throttledUpdateRecords();
      }
    }
  });

  updateRecords();

  this.onStop(() => {
    dataHandle.stop();
    this.removed("__dynamicTableDistinctValues", tableId);
  });
}
Meteor.publishComposite("__dynamicTableResults", simpleTablePublication);
Meteor.publish("__dynamicTableResultsArray", simpleTablePublicationArrayNew);
Meteor.publish("__dynamicTableGroupCounts", simpleTablePublicationCounts);
Meteor.publish("__dynaicTableDistinctValuesForField", simpleTablePublicationDistinctValuesForField);
