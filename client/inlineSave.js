

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

export function getCustom(customField, callback) {
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
  if (!stop && _.isObject(customField)) {
    callback(customField);
  }
  else if (!stop && _.isFunction(customField)) {
    const result = customField(this.data.columns, (asyncResult) => {
      callback(asyncResult);
    });
    if (result instanceof Promise) {
      result.then((asyncResult) => {
        callback(asyncResult);
      });
    }
    else if (result) {
      callback(result);
    }
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
  {
    newColumns, newFilter, newOrder, newLimit, newSkip, newGroupChainFields, unset
  }
) {
  if (_.isString(custom)) {
    const $set = {
    };

    if (newColumns) {
      $set[`${custom}.columns`] = newColumns.map(col => ({ data: col.data, id: col.id }));
    }

    if (newGroupChainFields) {
      $set[`${custom}.groupChainFields`] = newGroupChainFields;
    }

    if (newFilter) {
      $set[`${custom}.filter`] = JSON.stringify(EJSON.toJSONValue(newFilter));
    }
    if (newOrder) {
      $set[`${custom}.order`] = newOrder;
    }
    if (newLimit) {
      $set[`${custom}.limit`] = newLimit;
    }
    if (newSkip || newSkip === 0) {
      $set[`${custom}.skip`] = newSkip;
    }
    if (unset) {
      const filter = getValue(Meteor.user(), `${custom}.filter`);
      if (filter) {
        const actualFilter = unset === "all" ? {} : JSON.parse(filter);
        delete actualFilter[unset];
        $set[`${custom}.filter`] = JSON.stringify(actualFilter);
      }
    }
    Meteor.users.update(
      { _id: Meteor.userId() },
      { $set }
    );
  }
};
