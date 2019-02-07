import "./singleValueTextEditor.html";
import { inlineSave, getValue } from "../../../inlineSave.js";

Template.dynamicTableSingleValueTextEditor.helpers({
  editableValue() {
    return this.value !== undefined ? this.value : getValue(this.doc, this.column.data);
  },
  inputId() {
    return this.id !== undefined ? this.id : "";
  },
  placeholder() {
    return this.placeholder !== undefined ? this.placeholder : "";
  }
});
Template.dynamicTableSingleValueTextEditor.events({
  "keydown input"(e, templInstance) {
    if (e.keyCode === 13 && !this.bulkEdit) {
      inlineSave(templInstance, $(e.currentTarget).val());
    }
  },
  "blur input"(e, templInstance) {
    if (!this.bulkEdit) {
      inlineSave(templInstance, $(e.currentTarget).val());
    }
  }
});
