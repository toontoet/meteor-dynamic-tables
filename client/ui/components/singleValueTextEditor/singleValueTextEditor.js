import "./singleValueTextEditor.html";
import "./singleValueTextEditor.css";
import { inlineSave, getValue, nextField } from "../../../inlineSave.js";

Template.dynamicTableSingleValueTextEditor.helpers({
  isOverwritten() {
    return this.formula && this.formula.isFormula && this.formula.value && this.formula.value.overwritten !== undefined;
  },
  editableValue() {
    return this.value !== undefined ? this.value : getValue(this.doc, this.column.data);
  },
  inputClass() {
    return this.id !== undefined ? this.id : "";
  },
  placeholder() {
    return this.placeholder !== undefined ? this.placeholder : "";
  },
  type() {
    return (this.column && this.column.type) ? this.column.type : "text";
  }
});
Template.dynamicTableSingleValueTextEditor.events({
  "mousedown .fa-times"(e, templInstance) {
    const computed = this.formula && this.formula.isFormula && this.formula.value && this.formula.value.computed;
    inlineSave(templInstance, computed, { isComputed: true, isOverwrite: false });
    templInstance.data.saveOnBlur = false;
  },
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
  "blur span"(e, templInstance) {
    if (templInstance.data.saveOnBlur !== false) {
      inlineSave(templInstance, $(e.currentTarget).find('input').val());
    }
  }
});
