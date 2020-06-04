const publicationFunctions = {};
export function registerPubFunction(name, fn) {
  publicationFunctions[name] = fn;
}


function onStop(recordIds, publicationCursor, dataHandle, interval) {
  dataHandle.stop();
  if (interval) {
    Meteor.clearInterval(interval);
  }

  // NOTE: this was a hack to fix a symptom where multiple observers were being tracked per field (custom pub handle + returning the cursor)
  /* recordIds.forEach((recordId) => {
    const docView = this._session.getCollectionView(publicationCursor._cursorDescription.collectionName).documents[recordId];
    const dummy = {};
    if (docView) {
      Object.keys(docView.dataByKey).forEach(key => docView.clearField(this._subscriptionHandle, key, dummy));
    }
  });
  */
  recordIds.splice(0, recordIds.length);
}

function deepToFlatExtension(doc, toDepth, deleteOrig, ...accessors) {
  if (!accessors || accessors.length === 0) {
    accessors = Object.keys(doc).filter(k => !_.isArray(doc[k]) && _.isObject(doc[k]));
  }
  const toProcess = accessors.map(k => ({ fullKey: k, key: k, parent: doc, depth: 0 }));
  for (let i = 0; i < toProcess.length; i++) {
    const { key, parent, fullKey, depth } = toProcess[i];
    if (toDepth && toDepth === depth) {
      break;
    }
    const newKeys = Object.keys(parent[key]);
    newKeys.forEach((k) => {
      doc[`${fullKey}.${k}`] = parent[key][k];
      if (!_.isArray(parent[key][k]) && _.isObject(parent[key][k])) {
        toProcess.push({
          fullKey: `${fullKey}.${k}`,
          key: k,
          parent: parent[key],
          depth: depth + 1
        });
      }
    });
    if (deleteOrig) {
      //delete parent[key];
    }
  }
  return doc;
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
          // NOTE: yuck, we need to flatten deep objects, in case we have
          // changed our publication to include new fields within the same top level object
          // const convert = this._session.getCollectionView(publicationCursor._cursorDescription.collectionName).documents[id];
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
      addedBefore: (_id, doc, beforeId) => {
        recordIds.splice(recordIds.indexOf(beforeId), 0, _id);
        if (canOverride) {
          // const convert = this._session.getCollectionView(publicationCursor._cursorDescription.collectionName).documents[_id];
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
      canOverride = true;
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
  if (typeof Kadira !== "undefined" && Kadira && Kadira._getInfo()) {
    Kadira._getInfo().trace.name += "_" + publicationName;
  }
  const { publicationCursor } = getPublicationCursor.call(this, publicationName, selector, options);
  const { dataHandle, interval, recordIds } = getDataHandleAndInterval.call(this, tableId, publicationCursor, options, false);

  this.onStop(() => {
    onStop.call(this, recordIds, publicationCursor, dataHandle, interval);
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
  if (typeof Kadira !== "undefined" && Kadira && Kadira._getInfo()) {
    Kadira._getInfo().trace.name += "_" + publicationName;
  }
  const { publicationResult, publicationCursor, canOverride } = getPublicationCursor.call(this, publicationName, selector, options);
  const { dataHandle, interval, recordIds } = getDataHandleAndInterval.call(this, tableId, publicationCursor, options, canOverride);
  this.onStop(() => {
    onStop.call(this, recordIds, publicationCursor, dataHandle, interval);
  });
  return _.isArray(publicationResult) ? publicationResult.slice(1) : [];
}

function canUseAggregate(queries, field) {
  return !queries.find(q => _.isObject(q.query) || q.options.limit);
}
export function simpleTablePublicationCounts(tableId, publicationName, field, baseSelector, queries, options = {}, parentFilters = []) {
  check(tableId, String);
  check(publicationName, String);
  check(baseSelector, Object);
  check(options, Object);
  check(publicationFunctions[publicationName] || Meteor.default_server.publish_handlers[publicationName], Function);

  if (options.throttleRefresh === undefined) {
    options.throttleRefresh = 10000;
  }

  if (typeof Kadira !== "undefined" && Kadira && Kadira._getInfo()) {
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

  const updateRecordsAggregate = () => {
    const changed = {};
    let hasChanges = false;
    let promise = Promise.resolve();
    if (queries.length) {
      let pipeline;
      const match = field.match(/\.(\d+)$/);
      if (match) {
        const trimmedField = field.replace(match[0], "");
        pipeline = [
          {
            $match: publicationCursor._cursorDescription.selector
          },
          {
            $project: {
              [trimmedField]: { $arrayElemAt: [`$${trimmedField}`, parseInt(match[1], 10)] }
            }
          },
          {
            $group: {
              _id: `$${trimmedField}`,
              count: { $sum: 1 }
            }
          }
        ];
      }
      else {
        pipeline = [
          {
            $match: publicationCursor._cursorDescription.selector
          },
          {
            $unwind: `$${field}`
          },
          {
            $group: {
              _id: `$${field}`,
              count: { $sum: 1 }
            }
          }
        ];
      }
      if (options && options.unwind) {
        pipeline.splice(1, 0, { $unwind: options.unwind });
      }
      promise = publicationCursor._mongo.db
      .collection(publicationCursor._getCollectionName())
      .aggregate(pipeline)
      .toArray()
      .then((res) => {
        res.forEach((group) => {
          const query = queries.find(q => q.query === group._id);
          if (query) {
            const id = JSON.stringify(query.query).replace(/[{}.:]/g, "");
            if (id) {
              if (result[id] !== group.count && (result[id] !== undefined || group.count !== 0)) {
                changed[id] = group.count;
                result[id] = group.count;
                hasChanges = true;
              }
            }
          }
        });
      });
    }
    promise.then(() => {
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

  const updateRecordsMap = () => {
    const changed = {};
    let hasChanges = false;
    return Promise.all(queries.map((value) => {
      let subSelector;
      if (value.query.$nor) {
        subSelector = value.query;
      }
      else {
        subSelector = { [field]: value.query };
      }

      // Includes filters applied to table. All parent filters and value's filter as well. Also, we only want filters with keys.
      const extraSelectors = [value.filter, ...parentFilters].filter(filter => _.keys(filter || {}).length);
      const selector = { $and: [subSelector, publicationCursor._cursorDescription.selector, ...extraSelectors] };
      const id = JSON.stringify(value.query).replace(/[{}.:]/g, "");
      if (id) {
        let cursor = publicationCursor._mongo.db
        .collection(publicationCursor._getCollectionName())
        .find(selector, { _id: true });
        if (value.options && value.options.limit) {
          cursor = cursor.limit(value.options.limit);
        }
        return cursor.count(true).then((count) => {
          if (result[id] !== count && (result[id] !== undefined || count !== 0)) {
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

  let updateRecords;
  if (options && options.useAggregate) {
    updateRecords = updateRecordsAggregate;
  }
  else if (options && options.useAggregate === false) {
    updateRecords = updateRecordsMap;
  }
  else {
    updateRecords = canUseAggregate(queries) ? updateRecordsAggregate : updateRecordsMap;
  }
  const throttledUpdateRecords = options.throttleRefresh ? _.throttle(updateRecords, options.throttleRefresh, { leading: true, trailing: true }) : updateRecords;

  let dataHandle;
  if (publicationCursor) {
    dataHandle = publicationCursor.observeChanges({
      _suppress_initial: true,
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
  });
}

function simpleTablePublicationDistinctValuesForField(tableId, publicationName, field, selector = {}, options = {}, count = false) {
  check(tableId, String);
  check(field, String);
  check(publicationName, String);
  check(selector, Object);
  if (typeof Kadira !== "undefined" && Kadira && Kadira._getInfo()) {
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
    _suppress_initial: true,
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
    this.removed("__dynamicTableDistinctValues", tableId);
    dataHandle.stop();
  });
}
Meteor.publishComposite("__dynamicTableResults", simpleTablePublication);
Meteor.publish("__dynamicTableResultsArray", simpleTablePublicationArrayNew);
Meteor.publish("__dynamicTableGroupCounts", simpleTablePublicationCounts);
Meteor.publish("__dynaicTableDistinctValuesForField", simpleTablePublicationDistinctValuesForField);
