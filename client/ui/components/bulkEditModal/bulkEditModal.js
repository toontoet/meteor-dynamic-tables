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
    return editableColumns.filter(col => col.bulkEditDisplay);
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
    const documentIds = Template.currentData().documentIds;
    const set = Template.currentData().set;

    fields = fields.filter(field => field.bulkEditDisplay);

    const documentsToUpdate = collection.find({ _id: { $in: documentIds } }, { fields: { _id: true } });
    Promise.all(documentsToUpdate.map(doc => new Promise(((resolve, reject) => {
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
            // Skip
          }
          else {
            editTemplateData.editCallback(doc._id, fieldValue, doc, () => {
              // Handle success
            }, extra, true);
          }
        }
        else {
          const placeholder = fieldSelector.attr("placeholder");
          if (!fieldValue && placeholder === "Multiple Values") {
            // Skip
          }
          else {
            const $set = {};
            $set[field.data] = fieldValue;
            collection.update({ _id: doc._id }, { $set }, (err, res) => {
              if (err) {
                // Handle error
              }
              else {
                // Handle success
              }
            });
          }
        }
      });
    }))))
    .then(() => {
      Notifications.success(`Fields updated successful for ${set}.`, "", { timeout: 2000 });
    })
    .catch((err) => {
      console.log({ err });

      Notifications.error(`Couldn't update fields for the ${set}.`, err.reason, { timeout: 5000 });
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
