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
      const allValuesIncludingEmpty = allValues.map(v => (!v || !v.length ? [""] : v));
      const values = _.union(...allValuesIncludingEmpty);
      let hasMultiple = false;
      allValuesIncludingEmpty.forEach((v) => {
        if (v.length !== values.length) {
          hasMultiple = true;
        }
      });
      if (!hasMultiple) {
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

function getAllTableColumns(collection, table, set, FlexTemplates) {
  const ft = Tracker.nonreactive(() => FlexTemplates.findOne({ teamId: Meteor.teamId(), collectionName: set }));
  if (ft && ft.fields) {
    return _.union(
      table.extraColumns,
      table.columns,
      ft.fields.map(field => ft.flexColumnForField(field, collection, undefined))
    );
  }
  return table.columns;
}

export function bulkEdit(documentIds, tableData, set, FlexTemplates) {
  const columns = tableData.table.columns ? tableData.table.columns : [];
  const collection = tableData.table.collection;
  const allColumns = getAllTableColumns(collection, tableData.table, set, FlexTemplates);
  const editableCols = columns.filter(col => !!col.editTmpl).map(col => col.data);
  let allEditableCols = allColumns.filter(col => !!col.editTmpl);
  const editableRowData = getEditableRowData(collection, documentIds, allEditableCols);

  allEditableCols = allEditableCols.map((col) => {
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
    col.bulkEditDisplay = editableCols.indexOf(col.data) > -1;

    return col;
  });

  Modal.show("bulkEditModal", {
    class: "modal-medium-height",
    title: `Edit ${documentIds.length} ${set}`,
    set,
    fields: allEditableCols,
    collection,
    documentIds
  });
}
