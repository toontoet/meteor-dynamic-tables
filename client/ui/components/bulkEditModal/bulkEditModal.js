import { Template } from "meteor/templating";

import "./bulkEditModal.html";
import "./bulkEditModal.css";

Template.bulkEditModal.onCreated(function onCreated() {
  this.showAddEditableColumns = new ReactiveVar(false);
  this.fields = new ReactiveVar(this.data.fields);
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
    const collection = Template.currentData().collection;
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
    let editableColumns = Template.instance().fields.get();
    editableColumns = editableColumns.map((col) => {
      if (col.data === editableColId) {
        col.bulkEditDisplay = true;
      }
      return col;
    });
    Template.instance().fields.set(editableColumns);
    Template.instance().showAddEditableColumns.set(false);
  },
  "click #show-add-editable-column"(e) {
    Template.instance().showAddEditableColumns.set(true);
  }
});
