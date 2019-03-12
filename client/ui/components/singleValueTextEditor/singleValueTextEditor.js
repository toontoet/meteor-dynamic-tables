import "./singleValueTextEditor.html";
import { inlineSave, getValue, nextField } from "../../../inlineSave.js";

Template.dynamicTableSingleValueTextEditor.helpers({
  editableValue() {
    return this.value !== undefined ? this.value : getValue(this.doc, this.column.data);
  }
});
Template.dynamicTableSingleValueTextEditor.events({
  "keydown input"(e, templInstance) {
    if (e.keyCode === 13) {
      inlineSave(templInstance, $(e.currentTarget).val());
    }
    else if (e.keyCode === 9) {
      e.preventDefault();
      inlineSave(templInstance, $(e.currentTarget).val());
      nextField(templInstance);
    }
  },
  "blur input"(e, templInstance) {
    inlineSave(templInstance, $(e.currentTarget).val());
  }
});
