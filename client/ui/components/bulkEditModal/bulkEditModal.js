import { Template } from "meteor/templating";
import { getAllEditableColumns } from "../../../bulkEditUtils.js";

import "./bulkEditModal.html";
import "./bulkEditModal.css";

Template.bulkEditModal.onCreated(function onCreated() {
  const documentIds = this.data.documentIds;
  const tableData = this.data.tableData;
  const set = this.data.set;
  const FlexTemplates = this.data.FlexTemplates;
  const allEditableColumns = getAllEditableColumns(documentIds, tableData, set, FlexTemplates);

  this.showAddEditableColumns = new ReactiveVar(false);
  this.additionalCols = new ReactiveVar([]);
  this.fields = new ReactiveVar(allEditableColumns);
  this.collection = tableData.table.collection;
  this.bulkEditOptions = tableData.table.bulkEditOptions;

  const self = this;
  this.autorun(() => {
    const additionalCols = self.additionalCols.get();
    const handle = Meteor.subscribe(tableData.table.publication, { _id: { $in: documentIds } }, {});
    this.autorun(() => {
      const isReady = handle.ready();
      if (isReady) {
        self.fields.set(getAllEditableColumns(documentIds, tableData, set, FlexTemplates, additionalCols));
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
  "click #cancel"(e) {
    e.preventDefault();
    $("#bulk-edit-modal").modal("hide");
  },
  "click #update"(e) {
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
          const fieldSelector = $(document.getElementById(`${field.data}-input`));
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
    $("#bulk-edit-modal").modal("hide");
  },
  "click #add-editable-column"(e) {
    const editableColId = $("#add-editable-column-id").val();
    const additionalCols = Template.instance().additionalCols.get();
    additionalCols.push(editableColId);
    Template.instance().additionalCols.set(additionalCols);
    Template.instance().showAddEditableColumns.set(false);
  },
  "click #show-add-editable-column"(e) {
    Template.instance().showAddEditableColumns.set(true);
  }
});
