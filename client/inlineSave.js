import { EJSON } from "meteor/ejson";

export function getColumns(columns, reactive = false) {
  if (_.isFunction(columns)) {
    return reactive ? columns() : Tracker.nonreactive(() => columns());
  }
  return columns;
}

export function getPosition(el) {
  let xPos = 0;
  let yPos = 0;
  const width = $(el).width();
  while (el) {
    if (el.tagName === "BODY") {
      // deal with browser quirks with body/window/document and page scroll
      const xScroll = el.scrollLeft;// || document.documentElement.scrollLeft;
      const yScroll = el.scrollTop;// || document.documentElement.scrollTop;

      xPos += (el.offsetLeft - xScroll + el.clientLeft);
      yPos += (el.offsetTop - yScroll + el.clientTop);
    }
    else {
      // for all other non-BODY elements
      xPos += (el.offsetLeft - el.scrollLeft + el.clientLeft);
      yPos += (el.offsetTop - el.scrollTop + el.clientTop);
    }

    el = el.offsetParent;
  }
  return {
    left: xPos,
    top: yPos,
    width
  };
}

export function getValue(doc, field) {
  let obj = doc;
  const parts = field.split(".");
  while (parts.length) {
    const part = parts.splice(0, 1)[0];
    obj = obj && obj[part];
  }
  return obj;
}

export function getCustom(customField, tableId, callback) {
  let stop = false;
  if (_.isString(customField)) {
    Tracker.autorun(() => {
      if (!Meteor.userId()) {
        return;
      }
      const custom = getValue(Tracker.nonreactive(() => Meteor.user()), customField);
      if (custom) {
        callback(custom);
        stop = true;
      }
    });
  }
  if (!stop && _.isFunction(customField)) {
    const result = customField(tableId, false, null, (asyncResult) => {
      callback(asyncResult);
      stop = true;
    });
    if (result instanceof Promise) {
      result.then((asyncResult) => {
        callback(asyncResult);
        stop = true;
      });
    }
    else if (result) {
      callback(result);
      stop = true;
    }
  }
  else if (!stop && _.isObject(customField)) {
    callback(customField);
    stop = true;
  }
  return stop;
}

export function inlineSave(templInstance, val, extra) {
  if (templInstance.data.editCallback) {
    return templInstance.data.editCallback(templInstance.data.doc._id, val, templInstance.data.doc, templInstance.data.afterEditCallback, extra);
  }
  const collection = templInstance.data.collection;
  const doc = templInstance.data.doc;
  const fieldName = templInstance.data.column.data;
  collection.update(
    { _id: doc._id },
    { $set: { [fieldName]: val } },
    (err, res) => {
      templInstance.data.afterEditCallback(err, res);
    }
  );
}

export function changed(
  custom,
  tableId,
  {
    newColumns, newFilter, newOrder, newLimit, newSkip, newGroupChainFields, changeOpenGroups, unset
  }
) {
  let prefix = "";
  const $set = {
  };
  const $pull = {};
  const $addToSet = {};
  if (_.isString(custom)) {
    prefix = `${custom}.`;
  }
  if (changeOpenGroups) {
    _.each(changeOpenGroups, (open, tableId) => {
      if (open) {
        $addToSet[`${prefix}openGroups`] = tableId;
      }
      else {
        $pull[`${prefix}openGroups`] = tableId;
      }
    });
  }

  if (newColumns) {
    $set[`${prefix}columns`] = newColumns.map(col => ({ data: col.data, id: col.id }));
  }

  if (newGroupChainFields) {
    $set[`${prefix}groupChainFields`] = newGroupChainFields;
  }

  if (newFilter) {
    $set[`${prefix}filter`] = JSON.stringify(EJSON.toJSONValue(newFilter));
  }
  if (newOrder) {
    $set[`${prefix}order`] = newOrder;
  }
  if (newLimit) {
    $set[`${prefix}limit`] = newLimit;
  }
  if (newSkip || newSkip === 0) {
    $set[`${prefix}skip`] = newSkip;
  }
  if (unset) {
    const filter = getValue(Meteor.user(), `${prefix}filter`);
    if (filter) {
      const actualFilter = unset === "all" ? {} : JSON.parse(filter);
      delete actualFilter[unset];
      $set[`${prefix}filter`] = JSON.stringify(actualFilter);
    }
  }
  const update = {};
  if (_.keys($set).length) {
    update.$set = $set;
  }
  if (_.keys($pull).length) {
    update.$pull = $pull;
  }
  if (_.keys($addToSet).length) {
    update.$addToSet = $addToSet;
  }

  if (!_.keys(update).length) {
    return;
  }
  if (_.isString(custom)) {
    Meteor.users.update(
      { _id: Meteor.userId() },
      update
    );
  }
  if (_.isFunction(custom)) {
    custom(
      tableId, true,
      update,
      () => {}
    );
  }
}
