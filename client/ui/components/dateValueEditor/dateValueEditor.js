// dynamicTableDateValueEditor.js
import "./dateValueEditor.html";
import "./dateValueEditor.css";

import { inlineSave } from "../../../inlineSave.js";

Template.dynamicTableDateValueEditor.onRendered(function() {
  const input = this.$("input.form-control");
  const isMultiple = this.data.multiple;
  let datePickerFn = input.datepicker ? input.datepicker.bind(input) : () => {};
  if (this.data.options.datePickerFn) {
    datePickerFn = this.data.options.datePickerFn.bind(input);
  }
  else if (isMultiple || this.data.options.useBootstrap) {
    // if bootstrap datepicker is not imported it'll keep using jquery datepicker
    try {
      const oldDatePicker = $.fn.datepicker;
      const bsDatePicker = require("bootstrap-datepicker");
      if ($.fn.datepicker) {
        datePickerFn = $.fn.datepicker.bind(input);
      }
    }
    catch (e) {
      console.warn("Bootstrap datepicker is not found. The program will use the builtin/available datepicker insted. Some functionality limmitaion are expected");
    }
  }

  const defaultDateFormat = "mm/dd/yyyy";
  const dateFormat = this.data.options.dateFormat || defaultDateFormat;
  // if bootstrap datepicker is not imported into the project
  // it will use jquery datepicker syntax
  const datePickerRet = datePickerFn({
    multidate: isMultiple,// will be ignored for jquery
    format: dateFormat,// will be ignored for jquery
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
});

Template.dynamicTableDateValueEditor.helpers({
  date() {
    return Template.instance().data.value;
  },
  inputClass() {
    return this.id !== undefined ? this.id : "";
  },
});

Template.dynamicTableDateValueEditor.events({
  "needToUpdate input.form-control"(e, templInstance, ...args){
    const input = $(e.target);
    const defaultMomentDateFormat = "MM/DD/YY";
    const momentDateFormat = Template.instance().data.options.dateFormat ? Template.instance().options.data.dateFormat.toUpperCase().replace("YYYY", "YY") : defaultMomentDateFormat;
    // moment validation AND regex 2 digit/2 digit/4 digit OR empty input so date can be erased
    if (moment(input.val(), momentDateFormat).isValid() && /^(\d{2}\/\d{2}\/\d{4},?)+$/.test(input.val()) || input.val() === "") {
      input.removeClass("date-invalid");
      if (templInstance.data.saveOnEnter !== false) {
        const newDateValue = Template.instance().data.multiple ? input.val().split(',').filter((date) => moment(date, momentDateFormat).isValid()): input.val();
        inlineSave(templInstance, newDateValue);
      }
    } else {
      input.addClass("date-invalid");
    }
  }
});
