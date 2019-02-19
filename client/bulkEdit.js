import "./ui/components/bulkEditModal/bulkEditModal.js";
import { getValue } from "./inlineSave.js";

function getBulkEditValue(editableRowData, field) {
  const data = editableRowData.map(rowData => ({
    value: rowData.data.filter(d => d.data === field)[0].value,
    context: rowData.data.filter(d => d.data === field)[0].editTmplContext || []
  }));

  const allValues = data.map(d => (typeof d.context === "object" && d.context.value ? d.context.value : d.value));
  const allContexts = data.map(d => (typeof d.context === "object" ? d.context : {}));
  if (allValues) {
    let value = "";
    let placeholder = "";
    if (_.isArray(allValues[0])) {
      const allValuesIncludingEmpty = allValues.map(v => (!v.length ? [""] : v));
      const values = _.union(...allValuesIncludingEmpty);
      if (values.length === allValuesIncludingEmpty[0].length) {
        value = values.filter(v => !!v);
      }
      else {
        placeholder = "Multiple Values";
      }
    }
    else {
      const values = _.uniq(allValues);
      value = (values.length !== 1 || values[0] === undefined) ? "" : values[0];
      placeholder = values.length > 1 ? "Multiple Values" : "";
    }

    return {
      value,
      placeholder,
      context: allContexts[0]
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
      return {
        value,
        data: field.data,
        editTmplContext
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

  editableCols = editableCols.map((col) => {
    const {
      value, placeholder, context
    } = getBulkEditValue(editableRowData, col.data);

    col.editTemplateViewName = col.editTmpl.viewName.split(".")[1];
    col.editTemplateContext = Object.assign(context, {
      id: `${col.data}-input`,
      value: value || [],
      placeholder,
      bulkEdit: true
    });

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
