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
export function simpleTablePublicationArray(tableId, publicationName, compositePublicationNames, selector, options) {
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

Meteor.publishComposite("simpleTablePublication", simpleTablePublication);
Meteor.publish("simpleTablePublicationArray", simpleTablePublicationArray);
