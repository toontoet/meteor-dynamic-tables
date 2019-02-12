import "./ui/components/bulkEditModal/bulkEditModal.js";
import { getValue } from "./inlineSave.js";

function getBulkEditValue(editableRowData, field) {
  const data = editableRowData.map(rowData => ({
    value: rowData.data.filter(d => d.data === field)[0].value,
    options: rowData.data.filter(d => d.data === field)[0].options || []
  }));

  const allValues = data.map(d => (typeof d.value === "object" ? d.value.value : d.value));
  const allOptions = data.map(d => (typeof d.options === "object" ? d.options : []));
  if (allValues) {
    const values = _.uniq(allValues);
    return {
      value: (values.length !== 1 || values[0] === undefined) ? "" : values[0],
      placeholder: values.length > 1 ? "Multiple Values" : "",
      options: allOptions[0]
    };
  }
  return "";
}

function getEditableRowData(collection, documentIds, editableCols) {
  const documentsToUpdate = collection.find({ _id: { $in: documentIds } });
  const data = [];
  Promise.all(documentsToUpdate.map(doc => new Promise(((resolve, reject) => {
    const colData = editableCols.map((field) => {
      const editRowData = {
        doc,
        column: field,
        collection
      };
      const value = getValue(doc, field.data);
      const editTmplContext = field.editTmplContext ? field.editTmplContext(editRowData) : editRowData;
      const options = (editTmplContext.options && _.isFunction(editTmplContext.options)) ? editTmplContext.options : () => [];
      return {
        value,
        data: field.data,
        editTmplContext,
        options: options(doc, field.data, value)
      };
    });
    data.push({ _id: doc._id, data: colData });
  }))));
  return data;
}

export function bulkEdit(documentIds, tableData, set) {
  const columns = tableData.table.columns ? tableData.table.columns : [];
  const collection = tableData.table.collection;
  let editableCols = columns.filter(col => !!col.editTmpl);
  const editableRowData = getEditableRowData(collection, documentIds, editableCols);

  console.log(editableRowData);


  editableCols = editableCols.map((col) => {
    const { value, placeholder, options } = getBulkEditValue(editableRowData, col.data);
    col.editTemplateViewName = col.editTmpl.viewName.split(".")[1];
    col.editTemplateContext = {
      id: `${col.data}-input`,
      value,
      options,
      placeholder,
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
