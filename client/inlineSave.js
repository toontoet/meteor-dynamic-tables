
export function getValue(doc, field) {
  let obj = doc;
  const parts = field.split(".");
  while (parts.length) {
    const part = parts.splice(0, 1)[0];
    obj = obj[part];
  }
  return obj;
}
export function inlineSave(templInstance, val) {
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
