import "./select2ValueEditor.html";
import { getValue, inlineSave } from "../../../inlineSave.js";

function getAjaxConfig(origOptions, optionsResult) {
  const self = this;
  if (!_.isFunction(origOptions) || optionsResult) {
    return undefined;
  }
  let hadResults = false;
  return {
    transport(params, success, failure) {
      const val = self.data.value || getValue(self.data.doc, self.data.column.data) || [];
      origOptions(self.data.doc, self.data.column, val, params.data.q, (results) => {
        if (results.length && !hadResults) {
          const select = self.$(document.getElementsByClassName(`${self.selectId}`));
          select.empty();
          results.forEach((result) => {
            select.append($("<option selected=\"selected\" aria-selected=\"true\">").text(result.text).val(result.id));
          });
          select.val(val).trigger("change");
          hadResults = true;
        }
        success({ results });
      });
    }
  };
}

Template.dynamicTableSelect2ValueEditor.onCreated(function onCreated() {
  const selectId = this.data.id || "selectId";
  const placeholder = this.data.placeholder || "Add tags";
  this.selectId = selectId;
  this.placeholder = placeholder;
});

Template.dynamicTableSelect2ValueEditor.onRendered(function onRendered() {
  let options = this.data.options;
  const val = this.data.value || getValue(this.data.doc, this.data.column.data) || [];
  const origOptions = options;
  if (_.isFunction(options)) {
    options = options(this.data.doc, this.data.column, val);
  }
  this.$(document.getElementsByClassName(`${this.selectId}`)).select2({
    multiple: !!this.data.multiple,
    allowClear: true,
    tags: this.data.tags || !options,
    createTag: _.isFunction(this.data.createTag) ? this.data.createTag : ((params) => {
      const term = $.trim(params.term);

      if (term === "" || this.data.createTag === false) {
        return null;
      }

      return {
        id: term,
        text: term
      };
    }),
    ajax: getAjaxConfig.call(this, origOptions, options),
    data: [{
      id: [],
      text: "",
      search: "",
      hidden: false
    }].concat(options || []),
    placeholder: {
      id: [],
      text: this.placeholder
    }
  });
  this.$(document.getElementsByClassName(`${this.selectId}`)).val(val);
  this.$(document.getElementsByClassName(`${this.selectId}`)).trigger("change");
  this.$(document.getElementsByClassName(`${this.selectId}`)).select2("open");
  if (this.data.bulkEdit) {
    this.$(document.getElementsByClassName(`${this.selectId}`)).select2("close");
    setTimeout(() => {
      this.$(document.getElementsByClassName(`${this.selectId}`)).trigger("change");
      this.$(document.getElementsByClassName(`${this.selectId}`)).select2("open");
      this.$(document.getElementsByClassName(`${this.selectId}`)).select2("close");
    }, 300);
  }
  if (this.handler) {
    document.removeEventListener("mousedown", this.handler, false);
  }
  this.handler = (e) => {
    try {
      const container = this.$(document.getElementsByClassName(`${this.selectId}`)).data("select2").$container;
      if (!container.has($(e.target)).length) {
        if (!this.data.bulkEdit) {
          inlineSave(this, this.$(document.getElementsByClassName(`${this.selectId}`)).val(), this.$(document.getElementsByClassName(`${this.selectId}`)).data("select2").data());
        }
      }
    }
    catch (e1) {
      document.removeEventListener("mousedown", this.handler, false);
    }
  };
  document.addEventListener("mousedown", this.handler, false);
});

Template.dynamicTableSelect2ValueEditor.onDestroyed(function onDestroyed() {
  this.$(document.getElementsByClassName(`${this.selectId}`)).select2("destroy");
  document.removeEventListener("mousedown", this.handler, false);
});

Template.dynamicTableSelect2ValueEditor.helpers({
  inputClass() {
    return Template.instance().selectId;
  }
});

Template.dynamicTableSelect2ValueEditor.events({
  "select2:close select"(e, templInstance) {
    const target = e.currentTarget;
    if (templInstance.waiting) {
      clearTimeout(templInstance.waiting);
    }
    const data = templInstance.$("select").data("select2").data();
    templInstance.waiting = setTimeout(() => {
      if (!templInstance.data.multiple) {
        if (!this.bulkEdit) {
          inlineSave(templInstance, $(target).val(), data);
        }
      }
    }, 100);
  }
});
