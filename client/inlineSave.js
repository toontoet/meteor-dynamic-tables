
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
