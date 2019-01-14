const publicationFunctions = {};
export function registerPubFunction(name, fn) {
  publicationFunctions[name] = fn;
}
function getDataHandleAndInterval(tableId, publicationCursor, options, canOverride) {
  const hasSortableFields = _.keys(options.fields || {}).length === 0 || _.intersection(_.keys(options.fields || {}), _.keys(options.sort || {})).length === _.keys(options.sort || {}).length;

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
      this.changed("tableInformation", tableId, { _ids: recordIds, recordsFiltered: recordsTotal, recordsTotal });
    }
    else {
      this.added("tableInformation", tableId, { _ids: recordIds, recordsFiltered: recordsTotal, recordsTotal });
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
    return publicationResult;
  }
}

export function simpleTablePublicationCount(tableId, publicationName, selector, options = {}) {
  check(tableId, String);
  check(publicationName, String);
  check(selector, Object);
  check(options, Object);
  check(publicationFunctions[publicationName] || Meteor.default_server.publish_handlers[publicationName], Function);
  if (Kadira && Kadira._getInfo()) {
    Kadira._getInfo().trace.name += "_" + publicationName;
  }
  if (this.unblock) {
    this.unblock();
  }
  const { publicationCursor } = getPublicationCursor.call(this, publicationName, selector, { fields: { _id: true } });
  const count = publicationCursor.count();
  this.added("groupInfo", tableId, { count });
  const interval = Meteor.setInterval(() => {
    const newCount = publicationCursor.count();
    if (count !== newCount) {
      this.changed("groupInfo", tableId, { count: newCount });
    }
  }, options.interval || 10000);
  this.onStop(() => {
    Meteor.clearInterval(interval);
    this.removed("groupInfo", tableId);
  });
  this.ready();
}
Meteor.publishComposite("simpleTablePublication", simpleTablePublication);
Meteor.publish("simpleTablePublicationArray", simpleTablePublicationArrayNew);
Meteor.publish("simpleTablePublicationCount", simpleTablePublicationCount);


Meteor.methods({
  async dynamicTableDistinctValuesForField(tableId, publicationName, selector, field) {
    check(tableId, String);
    check(field, String);
    check(publicationName, String);
    check(selector, Object);
    const { publicationCursor } = getPublicationCursor.call(this, publicationName, selector, { fields: { limit: 0, _id: true } });
    const values = await publicationCursor._mongo.db.collection(publicationCursor._getCollectionName()).distinct(field, publicationCursor._cursorDescription.selector);
    return values;
  }
});
