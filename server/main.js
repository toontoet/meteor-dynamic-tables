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
  const countHandle = countPublicationCursor.observeChanges({
    _suppress_initial: true,
    addedBefore() {
      if (!initializing) {
        recordsTotal++;
      }
    },
    removed() {
      recordsTotal--;
    }
  });
  const dataHandle = publicationCursor.observeChanges({
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
  this.added("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });

  initializing = false;
  this.onStop(() => {
    dataHandle.stop();
    countHandle.stop();
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
  const countHandle = countPublicationCursor.observeChanges({
    _suppress_initial: true,
    addedBefore() {
      if (!initializing) {
        recordsTotal++;
      }
    },
    removed() {
      recordsTotal--;
    }
  });
  const dataHandle = publicationCursor.observeChanges({
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
  this.added("tableInformation", tableId, { _ids: publishedIds, recordsFiltered: recordsTotal, recordsTotal });

  initializing = false;
  this.onStop(() => {
    dataHandle.stop();
    countHandle.stop();
  });
  return publicationResult;
}

Meteor.publishComposite("simpleTablePublication", simpleTablePublication);
Meteor.publish("simpleTablePublicationArray", simpleTablePublicationArray);
