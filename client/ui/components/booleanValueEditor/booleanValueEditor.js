import "./booleanValueEditor.html";
import { inlineSave } from "../../../inlineSave.js";


Template.dynamicTableBooleanValueEditor.helpers({
  checked() {
    return this.value ? { checked: "checked" } : {};
  }
});

Template.dynamicTableBooleanValueEditor.events({
  "change input"(e, templInstance) {
    inlineSave(templInstance, $(e.currentTarget).is(":checked"));
  },
  "blur input"(e, templInstance) {
    if (templInstance.data.saveOnBlur !== false) {
      inlineSave(templInstance, $(e.currentTarget).is(":checked"));
    }
  }
});
