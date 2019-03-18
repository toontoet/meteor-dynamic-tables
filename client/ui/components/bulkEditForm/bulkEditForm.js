import { Template } from "meteor/templating";
import { getValue } from "../../../inlineSave.js";

import "./bulkEditForm.html";
import "./bulkEditForm.css";

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
    if (!allValues.every(v => typeof v === typeof allValues[0])) {
      placeholder = "Multiple Values";
    }
    else if (_.isArray(allValues[0])) {
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
      value = values.length !== 1 || values[0] === undefined ? "" : values[0];
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
  documentsToUpdate.forEach((doc) => {
    const colData = editableCols.map((field) => {
      const editRowData = {
        doc,
        column: field,
        collection
      };
      const value = field.data ? getValue(doc, field.data) : "";

      const editTmplContext = field.editTmplContext ? field.editTmplContext(editRowData) : editRowData;
      return {
        value,
        data: field.data,
        editTmplContext
      };
    });
    data.push({ _id: doc._id, data: colData });
  });
  return data;
}

/**
 *
 * @param {object} editableCols - List of editable columns
 * @param {object} additionalCols - Additional columns to be added
 * @param {object} colData - Column data field name
 *
 * @returns {boolean} - True if current field need to be displayed in bulk edit form
 */
function bulkEditDisplay(editableCols, additionalCols, colData) {
  return editableCols.indexOf(colData) > -1 || additionalCols.indexOf(colData) > -1;
}

Template.dynamicTableBulkEditForm.additionalCols = [];
Template.dynamicTableBulkEditForm.fields = [];

Template.dynamicTableBulkEditForm.onCreated(function onCreated() {
  const documentIds = this.data.documentIds;
  const tableData = this.data.tableData;
  const allColumns = this.data.allColumns;
  const columns = tableData.table.columns ? tableData.table.columns : [];
  const allEditableCols = allColumns.filter(col => !!col.editTmpl);

  this.showAddEditableColumns = new ReactiveVar(false);
  this.additionalCols = new ReactiveVar([]);
  this.subscribedAdditionalCols = new ReactiveVar([]);
  this.collection = tableData.table.collection;
  this.bulkEditOptions = tableData.table.bulkEditOptions;
  this.editableCols = columns.filter(col => !!col.editTmpl).map(col => col.data);
  this.editableRowData = new ReactiveVar(getEditableRowData(tableData.table.collection, documentIds, allEditableCols));
  this.fields = allEditableCols;

  const self = this;
  this.autorun(() => {
    const additionalCols = self.additionalCols.get();
    const subsFields = additionalCols.map(f => ({ [f]: 1 })).reduce((acc, val) => Object.assign(acc, val), {});
    const handle = self.subscribe(tableData.table.publication, { _id: { $in: documentIds } }, { fields: subsFields });
    this.autorun(() => {
      const isReady = handle.ready();
      if (isReady) {
        self.editableRowData.set(getEditableRowData(tableData.table.collection, documentIds, allEditableCols));
        self.subscribedAdditionalCols.set(additionalCols);
        Template.dynamicTableBulkEditForm.additionalCols = additionalCols;
      }
    });
  });
});

Template.dynamicTableBulkEditForm.helpers({
  displayFields() {
    const editableColumns = Template.instance().fields;
    const additionalCols = Template.instance().subscribedAdditionalCols.get();
    const displayColumns = editableColumns.filter(col => bulkEditDisplay(Template.instance().editableCols, additionalCols, col.data) && additionalCols.indexOf(col.data) === -1);
    additionalCols.forEach((addCol) => {
      displayColumns.push(editableColumns.find(col => col.data === addCol));
    });
    return displayColumns;
  },
  templateViewName() {
    return this.editTmpl.viewName.split(".")[1];
  },
  editTemplateContext() {
    const editableRowData = Template.instance().editableRowData.get();
    const { value, placeholder, context } = getBulkEditValue(editableRowData, this.data);

    return Object.assign(context, {
      id: `${this.data}-input`,
      value: value || [],
      placeholder,
      bulkEdit: true
    });
  },
  hasUnselectedEditableColumns() {
    const unselectedEditableColumns = Template.instance().fields;
    const additionalCols = Template.instance().additionalCols.get();
    let foundFlag = false;
    unselectedEditableColumns.forEach((col) => {
      if (!bulkEditDisplay(Template.instance().editableCols, additionalCols, col.data)) {
        foundFlag = true;
      }
    });
    return foundFlag;
  },
  showAddEditableColumns() {
    return Template.instance().showAddEditableColumns.get();
  },
  unselectedEditableColumns() {
    const editableColumns = Template.instance().fields;
    const additionalCols = Template.instance().additionalCols.get();
    return editableColumns.filter(col => !bulkEditDisplay(Template.instance().editableCols, additionalCols, col.data));
  }
});

Template.dynamicTableBulkEditForm.events({
  "click .add-editable-column"() {
    const editableColId = $(".add-editable-column-id").val();
    const additionalCols = Template.instance().additionalCols.get();
    additionalCols.push(editableColId);
    Template.instance().additionalCols.set(additionalCols);
    Template.instance().showAddEditableColumns.set(false);
  },
  "click .show-add-editable-column"() {
    Template.instance().showAddEditableColumns.set(true);
  }
});
