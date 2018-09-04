export function simpleTablePublication(tableId, publicationName, compositePublicationNames, selector, options) {
  check(tableId, String);
  check(publicationName, String);
  check(selector, Object);
  check(options, Object);
  check(Meteor.default_server.publish_handlers[publicationName], Function);
  const publicationResult = Meteor.default_server.publish_handlers[publicationName].call(this, selector, options);
  let publicationCursor;
  if (_.isArray(publicationResult)) {
    publicationCursor = publicationResult[0];
  }
  else {
    publicationCursor = publicationResult;
  }
  const countPublicationResult = Meteor.default_server.publish_handlers[publicationName].call(
    this,
    selector,
    { fields: { _id: true }, sort: options.sort }
  );
  let countPublicationCursor;
  if (_.isArray(countPublicationResult)) {
    countPublicationCursor = countPublicationResult[0];
  }
  else {
    countPublicationCursor = countPublicationResult;
  }
  let publishedIds = publicationCursor.map(row => row._id);
  let recordsTotal = countPublicationCursor.count();
  let initializing = true;

  console.log(publicationCursor.count());
  let updateCount = () => {
    recordsTotal = countPublicationCursor.count();
    this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
  };
  const hasSortableFields = _.keys(options.fields || {}).length === 0 || _.intersection(_.keys(options.fields || {}), _.keys(options.sort || {})).length === _.keys(options.sort || {}).length;

  if (options.throttleRefresh) {
    updateCount = _.throttle(Meteor.bindEnvironment(updateCount), options.throttleRefresh);
  }
  let dataHandle;
  if (hasSortableFields) {
    dataHandle = publicationCursor.observeChanges({
      _suppress_initial: true,
      added: (_id) => {
        if (!initializing) {
          publishedIds.push(_id);
          recordsTotal++;
          this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
        }
      },
      removed: (_id) => {
        publishedIds = _.without(publishedIds, _id);
        recordsTotal--;
        this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
      }
    });
  }
  else {
    dataHandle = publicationCursor.observeChanges({
      _suppress_initial: true,
      addedBefore: (_id, doc, beforeId) => {
        if (!initializing) {
          publishedIds.splice(publishedIds.indexOf(beforeId), 0, _id);
          recordsTotal++;
          this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
        }
      },
      movedBefore: (_id, beforeId) => {
        publishedIds = _.without(publishedIds, _id);
        publishedIds.splice(publishedIds.indexOf(beforeId), 0, _id);
        this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
      },
      removed: (_id) => {
        publishedIds = _.without(publishedIds, _id);
        recordsTotal--;
        this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
      }
    });
  }
  this.added("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
  const interval = Meteor.setInterval(updateCount, 10000);

  initializing = false;
  this.onStop(() => {
    dataHandle.stop();
    Meteor.clearInterval(interval);
  });
  return {
    find() {
      return publicationCursor;
    },
    children: (compositePublicationNames || []).map((pubName) => {
      check(Meteor.default_server.publish_handlers[pubName], Function);
      return {
        find(play) {
          return Meteor.default_server.publish_handlers[pubName].call(this, play);
        }
      };
    })
  };
}
export function simpleTablePublicationArray(tableId, publicationName, selector, options) {
  check(tableId, String);
  check(publicationName, String);
  check(selector, Object);
  check(options, Object);
  check(Meteor.default_server.publish_handlers[publicationName], Function);
  const publicationResult = Meteor.default_server.publish_handlers[publicationName].call(this, selector, options);
  let publicationCursor;
  if (_.isArray(publicationResult)) {
    publicationCursor = publicationResult[0];
  }
  else {
    publicationCursor = publicationResult;
  }
  console.log(publicationCursor.count());
  const countPublicationResult = Meteor.default_server.publish_handlers[publicationName].call(
    this,
    selector,
    { fields: { _id: true }, sort: options.sort }
  );
  let countPublicationCursor;
  if (_.isArray(countPublicationResult)) {
    countPublicationCursor = countPublicationResult[0];
  }
  else {
    countPublicationCursor = countPublicationResult;
  }
  let publishedIds = publicationCursor.map(row => row._id);
  let recordsTotal = countPublicationCursor.count();
  let initializing = true;
  let updateCount = () => {
    recordsTotal = countPublicationCursor.count();
    this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
  };
  const hasSortableFields = _.keys(options.fields || {}).length === 0 || _.intersection(_.keys(options.fields || {}), _.keys(options.sort || {})).length === _.keys(options.sort || {}).length;

  if (options.throttleRefresh) {
    updateCount = _.throttle(Meteor.bindEnvironment(updateCount), options.throttleRefresh);
  }
  let dataHandle;
  if (hasSortableFields) {
    dataHandle = publicationCursor.observeChanges({
      _suppress_initial: true,
      added: (_id) => {
        if (!initializing) {
          publishedIds.push(_id);
          recordsTotal++;
          this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
        }
      },
      removed: (_id) => {
        publishedIds = _.without(publishedIds, _id);
        recordsTotal--;
        this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
      }
    });
  }
  else {
    dataHandle = publicationCursor.observeChanges({
      _suppress_initial: true,
      addedBefore: (_id, doc, beforeId) => {
        if (!initializing) {
          publishedIds.splice(publishedIds.indexOf(beforeId), 0, _id);
          recordsTotal++;
          this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
        }
      },
      movedBefore: (_id, beforeId) => {
        publishedIds = _.without(publishedIds, _id);
        publishedIds.splice(publishedIds.indexOf(beforeId), 0, _id);
        this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
      },
      removed: (_id) => {
        publishedIds = _.without(publishedIds, _id);
        recordsTotal--;
        this.changed("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
      }
    });
  }
  this.added("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });
  const interval = Meteor.setInterval(updateCount, 10000);

  initializing = false;
  this.onStop(() => {
    dataHandle.stop();
    Meteor.clearInterval(interval);
  });
  return publicationResult;
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
  const publicationResult = Meteor.default_server.publish_handlers[publicationName].call(this, selector, options);
  let publicationCursor;

  // NOTE: if we haven't explicitly stated whether we can override the default publication, lets figure it out
  // if we returned a cursor, or an array with exactly one cursor in it, we can override
  // doing so fixes a potential issue with cursors returning results with a bad sort
  // e.g., one where multiple valid sorts are possible. In this case, the table
  // information can return one set of ids and the cursor a different set of documents
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
export function simpleTablePublicationArrayNew(tableId, publicationName, selector, options) {
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
Meteor.publishComposite("simpleTablePublication", simpleTablePublication);
Meteor.publish("simpleTablePublicationArray", simpleTablePublicationArrayNew);
