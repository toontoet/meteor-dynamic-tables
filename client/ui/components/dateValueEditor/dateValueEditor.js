// dynamicTableDateValueEditor.js
import "./dateValueEditor.html";
import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { inlineSave } from "../../../inlineSave.js";

// define your component
export class dynamicTableDateValueEditor extends BlazeComponent {
  constructor(templInstance) {
     super(templInstance);
  }

  rendered() {
    $("input.form-control").datepicker({
      onClose: function(date, datepicker) {
          if (! date) {
            console.log("nothing")
            $("input.form-control").val("").trigger("change")
          }
      }
    });
    $(":focus").focus(); // to trigger datepicker appear
  }

  destructor() {
    // disables any timeouts/intervals associated with this component instance
    super.destructor();
  }

  static HelperMap() {
    return {
      date: () => this.date ? {value: this.date} : {}
    }
  }

  static EventMap() {
    return {
      "change input.form-control": "onChange",
    }
  }

  onChange(e, templInstance, ...args) {
    console.log("Date value was changed to: %s", e.target.value);
    if (templInstance.data.saveOnEnter !== false) {
      inlineSave(templInstance, $(e.target).val());
    }
  }
}

// register your component and link it to a template
BlazeComponent.register(Template.dynamicTableDateValueEditor, dynamicTableDateValueEditor);
