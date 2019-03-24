import { Template } from "meteor/templating";

import "./bulkEditModal.html";
import "./bulkEditModal.css";
import "../bulkEditForm/bulkEditForm.js";

Template.bulkEditModal.events({
  "click .cancelBtn"(e) {
    e.preventDefault();
    $(".bulk-edit-modal").modal("hide");
  },
  "click .updateBtn"(e) {
    e.preventDefault();
    const tableData = Template.currentData().tableData;
    const documentIds = Template.currentData().documentIds;
    const columns = tableData.table.columns ? tableData.table.columns : [];
    const editableCols = columns.filter(col => !!col.editTmpl).map(col => col.data);
    const collection = tableData.table.collection;
    const bulkEditOptions = tableData.table.bulkEditOptions;
    const additionalCols = Template.dynamicTableBulkEditForm.additionalCols;
    const allColumns = tableData.allColumns || columns;

    let fields = allColumns.filter(col => !!col.editTmpl);
    fields = fields.filter(field => editableCols.indexOf(field.data) > -1 || additionalCols.indexOf(field.data) > -1);

    const updatedEntries = [];
    const skippedEntries = [];
    const failedEntries = [];
    const documentsToUpdate = collection ? collection.find({ _id: { $in: documentIds } }, { fields: { _id: true } }) : [];
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
              collection.update({ _id: doc._id }, { $set }, (err) => {
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
  }
});
