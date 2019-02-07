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
    const $set = {};

    fields.forEach((field) => {
      $set[field.data] = $(document.getElementById(`${field.data}-input`)).val();
    });

    const documentsUpdateSuccess = [];
    const documentsUpdateFail = [];
    const documentsToUpdate = collection.find({ _id: { $in: documentIds } }, { fields: { _id: true } });
    Promise.all(documentsToUpdate.map(doc => new Promise(((resolve, reject) => {
      collection.update({ _id: doc._id }, { $set }, (err, res) => {
        if (err) {
          documentsUpdateFail.push(doc._id);
          reject(err);
        }
        else {
          documentsUpdateSuccess.push(doc._id);
          resolve(res);
        }
      });
    }))))
    .then(() => {
      Notifications.success(`Fields updated successful for ${set}: ${documentsUpdateSuccess}`, "", { timeout: 2000 });
    })
    .catch((err) => {
      Notifications.error(`Couldn't update fields for the ${set}: ${documentsUpdateFail}`, err.reason, { timeout: 5000 });
    });
    $("#bulk-edit-modal").modal("hide");
  }
});
