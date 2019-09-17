// dynamicTableDateValueEditor.js
import "./dateValueEditor.html";
import "./dateValueEditor.css";

import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { inlineSave } from "../../../inlineSave.js";

// define your component
export class dynamicTableDateValueEditor extends BlazeComponent {
  constructor(templInstance) {
     super(templInstance);
  }

  rendered() {
    const input = this.$("input.form-control")
    input.datepicker({
      onClose: function(date, datepicker) {
        input.trigger("needToUpdate")
      }
    })
    $(":focus").focus(); // to trigger datepicker appear
  }

  destructor() {
    // disables any timeouts/intervals associated with this component instance
    super.destructor();
  }

  static HelperMap() {
    return {
      date: "date"
    }
  }

  static EventMap() {
    return {
      "needToUpdate input.form-control": "onNeedToUpdate"
    }
  }

  onNeedToUpdate(e, templInstance, ...args) {
    const input = $(e.target)
    // moment validation and regex 2 digit/2 digit/4 digit
    if (moment(input.val(), "MM/DD/YY").isValid() && /^\d{2}\/\d{2}\/\d{4}$/.test(input.val())) {
      input.removeClass("date-invalid");
      if (templInstance.data.saveOnEnter !== false) {
        inlineSave(templInstance, input.val());
      }
    } else {
      input.addClass("date-invalid")
    }
  }

  date() {
    return this.nonReactiveData().value
  }
}

// register your component and link it to a template
BlazeComponent.register(Template.dynamicTableDateValueEditor, dynamicTableDateValueEditor);
