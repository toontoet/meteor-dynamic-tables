import { Template } from "meteor/templating";

import "./bulkEditModal.html";
import "./bulkEditModal.css";

Template.bulkEditModal.helpers({

});

Template.bulkEditModal.events({
  "click #cancel"(e) {
    e.preventDefault();
    $("#bulk-edit-modal").modal("hide");
  },
  "click #update"(e) {
    e.preventDefault();
    const fields = Template.currentData().fields;
    const collection = Template.currentData().collection;
    const documentIds = Template.currentData().documentIds;
    const set = Template.currentData().set;

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
  }
});
