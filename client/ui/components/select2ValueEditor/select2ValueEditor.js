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
        success({ results });
        if (results.length && !hadResults) {
          self.$("select").empty();
          results.forEach((result) => {
            self.$("select").append($("<option>").text(result.text).val(result.id));
          });
          self.$("select").val(val).trigger("change");
          hadResults = true;
        }
      });
    }
  };
}
Template.dynamicTableSelect2ValueEditor.onRendered(function onRendered() {
  let options = this.data.options;
  const val = this.data.value || getValue(this.data.doc, this.data.column.data) || [];
  const origOptions = options;
  if (_.isFunction(options)) {
    options = options(this.data.doc, this.data.column, val);
  }
  this.$("select").select2({
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
      text: "Add tags"
    }
  });
  this.$("select").val(val);
  this.$("select").trigger("change");
  this.$("select").select2("open");
  if (this.handler) {
    document.removeEventListener("mousedown", this.handler, false);
  }
  this.handler = (e) => {
    try {
      const container = this.$("select").data("select2").$container;
      if (!container.has($(e.target)).length) {
        inlineSave(this, this.$("select").val(), this.$("select").data("select2").data());
      }
    }
    catch (e1) {
      document.removeEventListener("mousedown", this.handler, false);
    }
  };
  document.addEventListener("mousedown", this.handler, false);
});
Template.dynamicTableSelect2ValueEditor.onDestroyed(function onDestroyed() {
  this.$("select").select2("destroy");
  document.removeEventListener("mousedown", this.handler, false);
});

Template.dynamicTableSelect2ValueEditor.events({
  "select2:close select"(e, templInstance) {
    const target = e.currentTarget;
    if (templInstance.waiting) {
      clearTimeout(templInstance.waiting);
    }
    templInstance.waiting = setTimeout(() => {
      if (!templInstance.data.multiple) {
        inlineSave(templInstance, $(target).val(), templInstance.$("select").data("select2").data());
      }
    }, 100);
  }
});
