import "./select2ValueEditor.html";
import { getValue, inlineSave } from "../../../inlineSave.js";

Template.dynamicTableSelect2ValueEditor.onRendered(function onRendered() {
  let options = this.data.options;
  if (_.isFunction(options)) {
    options = options(this.data.doc, this.data.column);
  }
  const val = this.data.value || getValue(this.data.doc, this.data.column.data) || [];
  this.$("select").select2({
    minimumResultsForSearch: -1,
    multiple: !!this.data.multiple,
    allowClear: true,
    tags: this.data.tags || !options,
    createTag: this.data.createTag || ((params) => {
      const term = $.trim(params.term);

      if (term === "") {
        return null;
      }

      return {
        id: term,
        text: term
      };
    }),
    data: [{
      id: [],
      text: "",
      search: "",
      hidden: false
    }].concat(options),
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
        inlineSave(this, this.$("select").val());
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
    if (!templInstance.data.multiple) {
      inlineSave(templInstance, $(e.currentTarget).val());
    }
  }
});
