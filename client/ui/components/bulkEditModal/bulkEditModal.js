import { Template } from "meteor/templating";

import "./bulkEditModal.html";
import "./bulkEditModal.css";
import "../bulkEditForm/bulkEditForm.js";


function getFieldValue(templateInstance, field) {
  const fieldSelector = templateInstance.$(document.getElementsByClassName(`${field.data}-input`));
  let fieldValue = fieldSelector.val();
  const extra = fieldSelector.data("select2") ? fieldSelector.data("select2").data() : undefined;

  if (fieldValue && _.isArray(fieldValue) && fieldValue.length) {
    fieldValue = fieldValue.filter(v => !!v);
  }
  const placeholder = fieldSelector.data("select2") ? fieldSelector.data("select2").results.placeholder.text : fieldSelector.attr("placeholder");

  return { fieldValue, extra, placeholder };
}

Template.bulkEditModal.events({
  "click .cancelBtn"(e) {
    e.preventDefault();
    $(".bulk-edit-modal").modal("hide");
  },
  "click .updateBtn"(e) {
    e.preventDefault();
    const templateInstance = Template.instance();
    const tableData = Template.currentData().tableData;
    const documentIds = Template.currentData().documentIds;
    const columns = tableData.table.columns ? tableData.table.columns : [];
    const editableCols = columns.filter(col => !!col.editTmpl).map(col => col.data);
    const collection = tableData.table.updateCollection || tableData.table.collection;
    const bulkEditOptions = tableData.table.bulkEditOptions;
    const additionalCols = Template.dynamicTableBulkEditForm.additionalCols;
    const allColumns = tableData.allColumns || columns;

    let fields = allColumns.filter(col => !!col.editTmpl);
    fields = fields.filter(field => editableCols.indexOf(field.data) > -1 || additionalCols.indexOf(field.data) > -1);

    const updatedEntries = [];
    const skippedEntries = [];
    const failedEntries = [];
    const documentsToUpdate = collection ? collection.find({ _id: { $in: documentIds } }, { /* we want all the fields to pass whole doc in edit call back */ }) : [];
    const modifier = fields.reduce((memo, field) => {
      const editRowData = {
        doc: {},
        column: field,
        collection
      };
      const editTemplateData = field.editTmplContext ? field.editTmplContext(editRowData) : editRowData;
      const { fieldValue, extra, placeholder } = getFieldValue(templateInstance, field);
      if (!fieldValue || (!fieldValue.length && placeholder === "Multiple Values")) {
        return memo;
      }
      memo.fields[field.data] = field;
      memo.$set[field.data] = fieldValue;
      memo.extra[field.data] = extra;
      memo.callbacks[field.data] = editTemplateData.editCallback;
      return memo;
    }, { $set: {}, extra: {}, callbacks: {}, fields: {} });

    let promise;
    const bulkUpdateMethod = tableData.table.bulkEditOptions.updateMethod === true ? "__dynamicTablesBulkEdit" : tableData.table.bulkEditOptions.updateMethod;
    if (Meteor.status().status === "offline" || !bulkUpdateMethod) {
      promise = Promise.all(documentsToUpdate.map(doc => new Promise(((resolve, reject) => {
        try {
          _.each(modifier.$set, (fieldValue, fieldData) => {
            const extra = modifier.extra[fieldData];
            const editCallback = modifier.callbacks[fieldData];
            const field = modifier.fields[fieldData];
            if (editCallback) {
              editCallback(doc._id, fieldValue, doc, () => {
                // Handle success
                updatedEntries.push({ _id: doc._id, field: field.title });
              }, extra, true);
            }
            else {
              collection.update({ _id: doc._id }, { $set: { [fieldData]: fieldValue } }, (err) => {
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
          });
          resolve();
        }
        catch (error) {
          reject(error);
        }
      }))));
    }
    else {
      promise = new Promise((resolve, reject) => {
        Meteor.call(
          bulkUpdateMethod,
          collection,
          documentsToUpdate.map(d => d._id),
          modifier.$set,
          _.object(_.keys(modifier.extra), _.values(modifier.extra).map(v => v && v.map(o => ({ selected: o.selected, text: o.text, search: o.search, id: o.id })))),
          (err, res) => {
            if (err) {
              reject(err);
            }
            else {
              updatedEntries.push(...documentsToUpdate.map(d => ({ _id: d._id, fields: modifier.fields })));
              if (_.isArray(res)) {
                failedEntries.push(...res);
              }
              resolve();
            }
          }
        );
      });
    }

    promise.then(() => {
      if (bulkEditOptions && typeof bulkEditOptions.onSuccess === "function") {
        bulkEditOptions.onSuccess(updatedEntries, skippedEntries, failedEntries);
      }
      $(".bulk-edit-modal").modal("hide");
    })
    .catch((err) => {
      if (bulkEditOptions && typeof bulkEditOptions.onError === "function") {
        bulkEditOptions.onError(err);
      }
    });
  }
});
