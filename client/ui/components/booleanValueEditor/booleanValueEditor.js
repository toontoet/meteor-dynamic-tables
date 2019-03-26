import "./booleanValueEditor.html";
import { inlineSave } from "../../../inlineSave.js";


Template.dynamicTableBooleanValueEditor.helpers({
  selected(val) {
    return this.value == val ? { selected: "selected" } : "" ;
  }
});

Template.dynamicTableBooleanValueEditor.events({
  "change select"(e, templInstance) {
    inlineSave(templInstance, $(e.currentTarget).val());
  }
});
