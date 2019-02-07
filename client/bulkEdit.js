import "./ui/components/bulkEditModal/bulkEditModal.js";

function getBulkEditValue(collection, documentIds, field) {
  const fields = {};
  fields[field] = true;
  const data = collection.find({ _id: { $in: documentIds } }, { fields });
  if (data) {
    const values = _.uniq(data.map(d => d[field]));
    return (values.length !== 1 || values[0] === undefined) ? "" : values[0];
  }
  return "";
}

export function bulkEdit(documentIds, tableData, set) {
  const columns = tableData.table.columns ? tableData.table.columns : [];
  const collection = tableData.table.collection;
  const editableCols = columns.filter(col => !!col.editTmpl).map((col) => {
    col.editTemplateViewName = col.editTmpl.viewName.split(".")[1];
    col.editTemplateContext = {
      id: `${col.data}-input`,
      value: getBulkEditValue(collection, documentIds, col.data),
      bulkEdit: true
    };
    return col;
  });

  Modal.show("bulkEditModal", {
    class: "modal-medium-height",
    title: `Edit ${documentIds.length} ${set}`,
    set,
    fields: editableCols,
    collection,
    documentIds
  });
}
