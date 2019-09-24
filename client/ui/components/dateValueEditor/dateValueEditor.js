// dynamicTableDateValueEditor.js
import "./dateValueEditor.html";
import "./dateValueEditor.css";

import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { inlineSave } from "../../../inlineSave.js";

export class dynamicTableDateValueEditor extends BlazeComponent {
  constructor(templInstance) {
     super(templInstance);
  }

  rendered() {
    const input = this.$("input.form-control");
    const isMultiple = this.reactiveData().multiple;
    let datePickerFn = input.datepicker ? input.datepicker.bind(input) : () => {};
    if (this.reactiveData().options.datePickerFn) {
      datePickerFn = this.reactiveData().options.datePickerFn.bind(input);
    }
    else if (isMultiple || this.reactiveData().options.useBootstrap) {
      // if bootstrap datepicker is not imported it'll keep using jquery datepicker
      try {
        const oldDatePicker = $.fn.datepicker;
        const bsDatePicker = require("bootstrap-datepicker");
        if ($.fn.datepicker) {
          datePickerFn = $.fn.datepicker.bind(input);
        }
        // $.fn.datepicker = oldDatePicker;
      }
      catch (e) { 
        console.warn("Bootstrap datepicker is not found. The program will use the builtin/aviable datepicker insted. Some functionality limmitaion are expected");
      }
    }
    // if bootstrap datepicker is not imported into the project 
    // it will use jquery datepicker syntax
    const datePickerRet = datePickerFn({
      multidate: isMultiple,// will be ignored for jquery
      formate: "dd/mm/yyyy",// will be ignored for jquery
      onClose: function(date, datepicker) {
        input.trigger("needToUpdate");
      }
    });
    // if bootstrap date picker was imported 
    if (datePickerRet.on) {
      datePickerRet.on("changeDate", function(e) {
        if (! isMultiple) {
          input.datepicker("hide");
        }
      }).on("hide", function(e){
        input.trigger("needToUpdate");
      });
    }
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
    // moment validation AND regex 2 digit/2 digit/4 digit OR empty input so date can be erased 
    if (moment(input.val(), "MM/DD/YY").isValid() && /^(\d{2}\/\d{2}\/\d{4},?)+$/.test(input.val()) || input.val() === "") {
      input.removeClass("date-invalid");
      if (templInstance.data.saveOnEnter !== false) {
        const newDateValue = this.reactiveData().multiple ? input.val().split(',').filter((date) => moment(date, "MM/DD/YY").isValid()): input.val();
        inlineSave(templInstance, newDateValue);
      }
    } else {
      input.addClass("date-invalid");
    }
  }

  date() {
    return this.nonReactiveData().value;
  }
}

BlazeComponent.register(Template.dynamicTableDateValueEditor, dynamicTableDateValueEditor);
