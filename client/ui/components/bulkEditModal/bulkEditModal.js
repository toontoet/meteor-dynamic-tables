import { Template } from "meteor/templating";
import { getValue } from "../../../inlineSave.js";

import "./bulkEditModal.html";
import "./bulkEditModal.css";

/**
 *
 * @param {object} editableRowData - An object containing values for all fields from selected list of rows for bulk edit
 * @param {string} field - The current fields name for which bulk edit value need to be calculated
 *
 * @returns {object} - The initial value/placeholder to be used in the bulk edit modal
 */
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

/**
 *
 * @param {object} collection - Mongo collection
 * @param {object} documentIds - List of ids being editted
 * @param {object} editableCols - List of columns that are editable
 *
 * @returns {object} - List of all rows that are being editted along with data for editable columns
 */
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

/**
 *
 * @param {object} documentIds - List of ids being editted
 * @param {object} tableData
 * @param {object} allColumns - List of all columns in the table
 * @param {object} additionalCols - (Optional) Additional columns to be added
 *
 * @returns - List of all editable columns with data to be used for displaying in bulk edit modal
 */
function getAllEditableColumns(documentIds, tableData, allColumns, additionalCols = []) {
  const columns = tableData.table.columns ? tableData.table.columns : [];
  const collection = tableData.table.collection;
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
    col.bulkEditDisplay = editableCols.indexOf(col.data) > -1 || additionalCols.indexOf(col.data) > -1;

    return col;
  });

  return allEditableCols;
}

Template.bulkEditModal.onCreated(function onCreated() {
  const documentIds = this.data.documentIds;
  const tableData = this.data.tableData;
  const allColumns = this.data.allColumns;
  const allEditableColumns = getAllEditableColumns(documentIds, tableData, allColumns);

  this.showAddEditableColumns = new ReactiveVar(false);
  this.additionalCols = new ReactiveVar([]);
  this.fields = new ReactiveVar(allEditableColumns);
  this.collection = tableData.table.collection;
  this.bulkEditOptions = tableData.table.bulkEditOptions;

  const self = this;
  this.autorun(() => {
    const additionalCols = self.additionalCols.get();
    const subsFields = additionalCols.map(f => ({ [f]: 1 })).reduce((acc, val) => Object.assign(acc, val), {});
    const handle = self.subscribe(tableData.table.publication, { _id: { $in: documentIds } }, { /* fields: subsFields */ });
    this.autorun(() => {
      const isReady = handle.ready();
      if (isReady) {
        self.fields.set(getAllEditableColumns(documentIds, tableData, allColumns, additionalCols));
      }
    });
  });
});

Template.bulkEditModal.helpers({
  displayFields() {
    const editableColumns = Template.instance().fields.get();
    const additionalCols = Template.instance().additionalCols.get();
    const displayColumns = editableColumns.filter(col => col.bulkEditDisplay && additionalCols.indexOf(col.data) === -1);
    additionalCols.forEach((addCol) => {
      displayColumns.push(editableColumns.find(col => col.data === addCol));
    });
    return displayColumns;
  },
  hasUnselectedEditableColumns() {
    const unselectedEditableColumns = Template.instance().fields.get();
    let foundFlag = false;
    unselectedEditableColumns.forEach((col) => {
      if (!col.bulkEditDisplay) {
        foundFlag = true;
      }
    });
    return foundFlag;
  },
  showAddEditableColumns() {
    return Template.instance().showAddEditableColumns.get();
  },
  unselectedEditableColumns() {
    const editableColumns = Template.instance().fields.get();
    return editableColumns.filter(col => !col.bulkEditDisplay);
  }
});

Template.bulkEditModal.events({
  "click .cancelBtn"(e) {
    e.preventDefault();
    $(".bulk-edit-modal").modal("hide");
  },
  "click .updateBtn"(e) {
    e.preventDefault();
    let fields = Template.instance().fields.get();
    const collection = Template.instance().collection;
    const bulkEditOptions = Template.instance().bulkEditOptions;
    const documentIds = Template.currentData().documentIds;

    fields = fields.filter(field => field.bulkEditDisplay);

    const updatedEntries = [];
    const skippedEntries = [];
    const failedEntries = [];
    const documentsToUpdate = collection.find({ _id: { $in: documentIds } }, { fields: { _id: true } });
    Promise.all(documentsToUpdate.map(doc => new Promise(((resolve, reject) => {
      try {
        fields.forEach((field) => {
          const editRowData = {
            doc,
            column: field,
            collection
          };
          const editTemplateData = field.editTmplContext ? field.editTmplContext(editRowData) : editRowData;
          const fieldSelector = $(document.getElementsByClassName(`${field.data}-input`));
          let fieldValue = fieldSelector.val();
          const extra = fieldSelector.data("select2") ? fieldSelector.data("select2").data() : undefined;

          if (fieldValue && _.isArray(fieldValue) && fieldValue.length) {
            fieldValue = fieldValue.filter(v => !!v);
          }

          if (editTemplateData.editCallback) {
            const placeholder = fieldSelector.data("select2") ? fieldSelector.data("select2").results.placeholder.text : fieldSelector.attr("placeholder");
            if (!fieldValue || (!fieldValue.length && placeholder === "Multiple Values")) {
              // Skip (Field has multiple initial values and no new entries added by user)
              skippedEntries.push({ _id: doc._id, field: field.title });
            }
            else {
              editTemplateData.editCallback(doc._id, fieldValue, doc, () => {
                // Handle success
                updatedEntries.push({ _id: doc._id, field: field.title });
              }, extra, true);
            }
          }
          else {
            const placeholder = fieldSelector.attr("placeholder");
            if (!fieldValue && placeholder === "Multiple Values") {
              // Skip (Field has multiple initial values and no new entries added by user)
              skippedEntries.push({ _id: doc._id, field: field.title });
            }
            else {
              const $set = {};
              $set[field.data] = fieldValue;
              collection.update({ _id: doc._id }, { $set }, (err, res) => {
                if (err) {
                  // Handle error
                  failedEntries.push({ _id: doc._id, field: field.title, err });
                }
                else {
                  // Handle success
                  updatedEntries.push({ _id: doc._id, field: field.title });
                }
              });
            }
          }
        });
        resolve();
      }
      catch (error) {
        reject(error);
      }
    }))))
    .then(() => {
      if (bulkEditOptions && typeof bulkEditOptions.onSuccess === "function") {
        bulkEditOptions.onSuccess(updatedEntries, skippedEntries, failedEntries);
      }
    })
    .catch((err) => {
      if (bulkEditOptions && typeof bulkEditOptions.onError === "function") {
        bulkEditOptions.onError(err);
      }
    });
    $(".bulk-edit-modal").modal("hide");
  },
  "click .add-editable-column"(e) {
    const editableColId = $(".add-editable-column-id").val();
    const additionalCols = Template.instance().additionalCols.get();
    additionalCols.push(editableColId);
    Template.instance().additionalCols.set(additionalCols);
    Template.instance().showAddEditableColumns.set(false);
  },
  "click .show-add-editable-column"(e) {
    Template.instance().showAddEditableColumns.set(true);
  }
});
