import "./singleValueTextEditor.html";
import { inlineSave, getValue, nextField } from "../../../inlineSave.js";

Template.dynamicTableSingleValueTextEditor.helpers({
  editableValue() {
    return this.value !== undefined ? this.value : getValue(this.doc, this.column.data);
  },
  inputClass() {
    return this.id !== undefined ? this.id : "";
  },
  placeholder() {
    return this.placeholder !== undefined ? this.placeholder : "";
  }
});
Template.dynamicTableSingleValueTextEditor.events({
  "keydown input"(e, templInstance) {
    if (templInstance.data.saveOnEnter !== false && e.keyCode === 13) {
      inlineSave(templInstance, $(e.currentTarget).val());
    }
    else if (templInstance.data.saveOnTab !== false && e.keyCode === 9) {
      e.preventDefault();
      inlineSave(templInstance, $(e.currentTarget).val());
      nextField(templInstance);
    }
  },
  "blur input"(e, templInstance) {
    if (templInstance.data.saveOnBlur !== false) {
      inlineSave(templInstance, $(e.currentTarget).val());
    }
  }
});
