import "./singleValueTextEditor.html";
import { inlineSave, getValue } from "../../../inlineSave.js";

Template.dynamicTableSingleValueTextEditor.helpers({
  editableValue() {
    return getValue(this.doc, this.column.data);
  }
});
Template.dynamicTableSingleValueTextEditor.events({
  "keydown input"(e, templInstance) {
    if (e.keyCode === 13) {
      inlineSave(templInstance, $(e.currentTarget).val());
    }
  },
  "blur input"(e, templInstance) {
    inlineSave(templInstance, $(e.currentTarget).val());
  }
});
