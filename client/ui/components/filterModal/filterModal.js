import { ReactiveDict } from "meteor/reactive-dict";
import _ from "underscore";
import "./filterModal.html";
import "./filterModal.css";

function closeModal() {
  const filterModalWrapper = $("#dynamic-table-filter-modal")[0];
  if (filterModalWrapper) {
    Blaze.remove(filterModalWrapper.__blazeTemplate);
    filterModalWrapper.innerHTML = "";
  }
}
Template.dynamicTableFilterModal.helpers({
  select2() {
    return $.fn.select2;
  },
  showOperators() {
    return Template.instance().showOperators.get();
  },
  hasFooter() {
    return this.filter && (this.filter.enabled || !this.filter.required);
  },
  types() {
    const types = this.field.edit.types || [];
    return types.map((t) => {
      if (_.isObject(t)) {
        return t;
      }
      return {
        value: t,
        label: t
      };
    });
  },
  selectedIfEquals(val1, val2) {
    return val1 == val2 ? { selected: "selected" } : {};
  },
  checkedIfTrue(val) {
    return val || val === 0 ? { checked: "checked" } : {};
  },
  checkedIfWithValue() {
    return ["$between", "$in", "$regex"].includes(this.filter.operator.selected) ? { selected: "selected" } : {};
  },
  checkedIfWithAllValue() {
    return ["$all"].includes(this.filter.operator.selected) ? { selected: "selected" } : {};
  },
  checkedIfGteValue() {
    return this.filter.operator.selected === "$gte" ? { selected: "selected" } : {};
  },
  checkedIfLteValue() {
    return this.filter.operator.selected === "$lte" ? { selected: "selected" } : {};
  },
  checkedIfWithoutValue() {
    return ["$nin"].includes(this.filter.operator.selected) ? { selected: "selected" } : {};
  },
  checkedIfWithoutAllValue() {
    return ["$not$all"].includes(this.filter.operator.selected) ? { selected: "selected" } : {};
  },
  searchEnabled() {
    if (this.filter.options) {
      return this.filter.search && this.filter.search.enabled;
    }
    return this.filter.search === undefined || this.filter.search.enabled !== false;
  },
  isAny() {
    return ["$in", "$nin"].includes(Template.instance().operator.get());
  },
  isAll() {
    return ["$all", "$not$all"].includes(Template.instance().operator.get());
  },
  isNumericOrDateAndNoOptions() {
    const fieldType = Template.instance().fieldType.get();
    const isNumericOrDate = fieldType && (fieldType === "time" || fieldType === Number || fieldType === Date);

    return isNumericOrDate && Template.instance().allOptions.get().length === 0;
  },
  isNumericOrDate() {
    const fieldType = Template.instance().fieldType.get();
    return fieldType && (fieldType === "time" || fieldType === Number || fieldType === Date);
  },
  isTime() {
    const fieldType = Template.instance().fieldType.get();
    return fieldType && (fieldType === "time");
  },
  isNumber() {
    const fieldType = Template.instance().fieldType.get();
    return fieldType && (fieldType === Number);
  },
  isDate() {
    const fieldType = Template.instance().fieldType.get();
    return fieldType && (fieldType === Date);
  },
  isStringOrCustom() {
    const fieldType = Template.instance().fieldType.get();
    return fieldType === String || (fieldType !== Number && fieldType !== Date && fieldType !== "time");
  },
  isString() {
    const fieldType = Template.instance().fieldType.get();
    return fieldType === String;
  },
  sortDirection(direction) {
    return Template.instance().sortDirection.get() === direction;
  },
  checkedIf(opA, opB) {
    if (_.isArray(opA)) {
      return opA.includes(opB) ? { checked: "checked" } : {};
    }
    return opA === opB ? { checked: "checked" } : {};
  },
  checkedIfSelected(value) {
    return Template.instance().selectedOptions.get().includes(value) ? { checked: "checked" } : {};
  },
  hasOptions() {
    if (Template.instance().asyncOptions.get()) {
      return true;
    }
    const options = Template.instance().allOptions.get();
    return options && options.length;
  },
  options() {
    return Template.instance().options.get().map(o => _.extend({ _id: o.value }, o));
  },
  hasSelectedOptions() {
    const options = Template.instance().selectedOptions.get();
    return options && options.length;
  },
  selectedOptions() {
    const options = Template.instance().allOptions.get();
    if (!options) {
      return [];
    }
    const selectedOptions = Template.instance().selectedOptions.get().map(o => _.find(options, { value: o }));
    return selectedOptions.map(o => _.extend({ _id: o.value }, o));
  },
  searching() {
    return Template.instance().searching.get();
  },
  loading() {
    return Template.instance().data.dataTable && Template.instance().data.dataTable.loading.get();
  },
  isArrayField() {
    return Template.instance().isArrayField.get();
  },
  dateValue() {
    const date = Template.instance().data.filter.search.value;
    if (date) {
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }
  },
  numberValue() {
    return Template.instance().data.filter.search.value;
  },
  minuteValue() {
    const time = Template.instance().data.filter.search.value;
    if (time) {
      return Math.floor(time / 60);
    }
  },
  secondValue() {
    const time = Template.instance().data.filter.search.value;
    if (time) {
      return time % 60;
    }
  },
  editing() {
    return Template.instance().editing.get();
  },
  isChanged(field) {
    const newValue = Template.instance().currentSpec.get(field);

    return newValue !== undefined && newValue !== Template.instance().editableField.get()[field];
  },
  editableField() {
    return Template.instance().editableField.get();
  },
  fieldLabel() {
    return Template.instance().fieldLabel.get();
  }
});

function doSearch(e, templInstance) {
  const elem = $(e.currentTarget);
  const fieldType = templInstance.fieldType.get();
  if (fieldType === Date) {
    const date = new Date(elem.val());
    if (!Number.isNaN(date.getTime())) {
      templInstance.search.set(date);
    }
    else {
      templInstance.search.set(undefined);
    }
  }
  else if (fieldType === Number) {
    templInstance.search.set(parseInt(templInstance.$(".input-dynamic-table-search").val(), 10));
  }
  else if (fieldType === "time") {
    const mins = parseInt($(templInstance.$(".input-dynamic-table-search")[0]).val(), 10) || 0;
    const secs = parseInt($(templInstance.$(".input-dynamic-table-search")[1]).val(), 10) || 0;
    templInstance.search.set((mins * 60) + secs);
  }
}


Template.dynamicTableFilterModal.events({
  "change .dynamic-table-filter-edit-type"(e, templInstance) {
    templInstance.currentSpec.set("type", $(e.currentTarget).val());
  },
  "click .dynamic-table-filter-edit-isArray"(e, templInstance) {
    templInstance.currentSpec.set("isArray", $(e.currentTarget).is(":checked"));
  },
  "click .dynamic-table-filter-edit-searchable"(e, templInstance) {
    templInstance.currentSpec.set("indexedNumber", $(e.currentTarget).is(":checked") ? (this.field.edit.spec.indexedNumber === false ? "new" : this.field.edit.spec.indexedNumber) : false);
  },
  "click .btn-dynamic-table-cancel"(e, templInstance) {
    templInstance.editing.set(false);
  },
  "click .btn-dynamic-table-save"(e, templInstance) {
    templInstance.$(".btn-dynamic-table-save").attr("disabled", "disabled");
    templInstance.data.field.edit.callback(e, templInstance)
    .then((newFieldSpec) => {
      templInstance.$(".btn-dynamic-table-save").removeAttr("disabled");
      templInstance.editableField.set(newFieldSpec);
      let fieldType = newFieldSpec.type;
      if (fieldType === "string") {
        fieldType = String;
      }
      else if (fieldType === "number") {
        fieldType = Number;
      }
      else if (fieldType === "date") {
        fieldType = Date;
      }
      templInstance.isArrayField.set(newFieldSpec.isArray);
      templInstance.fieldType.set(fieldType);
      templInstance.fieldLabel.set(newFieldSpec.label);
      templInstance.editing.set(false);
      templInstance.data.editFieldCallback(newFieldSpec);
    })
    .catch((err) => {
      console.error(err);
    });
  },
  "click .dynamic-table-filter-edit-btn"(e, templInstance) {
    templInstance.editing.set(true);
  },
  "click .btn-dynamic-table-remove"(e, templInstance) {
    templInstance.data.callback([], "$in", undefined, false);
    templInstance.data.removeColumn();
    closeModal();
  },
  "click .btn-dynamic-table-clear"(e, templInstance) {
    templInstance.search.set(undefined);
    templInstance.selectedOptions.set([]);
    templInstance.$(".input-dynamic-table-search").val("");
    // templInstance.data.callback([], "$in", undefined, false);
  },
  "click .btn-dynamic-table-sort"(e, templInstance) {
    templInstance.sortDirection.set($(e.currentTarget).data("direction"));
  },
  "change .input-dynamic-table-operator"(e, templInstance) {
    const options = Template.instance().options.get();
    const hasOptions = options && options.length;
    let operator = $(e.currentTarget).val();
    if (operator === "$in") {
      if (!hasOptions) {
        operator = "$regex";
      }
      if (templInstance.$(".btn-dynamic-table-operator.btn-dynamic-table-selected").data("modifier") === "$all") {
        operator = "$all";
      }
    }
    if (operator === "$nin") {
      if (!hasOptions) {
        operator = "$not";
      }
      if (templInstance.$(".btn-dynamic-table-operator.btn-dynamic-table-selected").data("modifier") === "$all") {
        operator = "$not$all";
      }
    }
    templInstance.operator.set(operator);
  },
  "click .fa-cog"(e, templInstance) {
    templInstance.showOperators.set(!templInstance.showOperators.get());
  },
  "change .select-dynamic-table-operator"(e, templInstance) {
    const options = Template.instance().options.get();
    const hasOptions = options && options.length;
    let operator = $(e.currentTarget).val();
    if (operator === "$in") {
      if (!hasOptions) {
        operator = "$regex";
      }
    }
    if (operator === "$nin") {
      if (!hasOptions) {
        operator = "$not";
      }
      operator = "$not$all";
    }
    templInstance.operator.set(operator);
  },
  "click .label-dynamic-table-selected"(e, templInstance) {
    const selectedOptions = templInstance.selectedOptions.get();
    const newOption = $(e.currentTarget).data("value");
    templInstance.selectedOptions.set(_.without(selectedOptions, newOption));
  },
  "click .input-dynamic-table-option"(e, templInstance) {
    const selectedOptions = templInstance.selectedOptions.get();
    const newOption = $(e.currentTarget).val();
    if ($(e.currentTarget).is(":checked")) {
      templInstance.selectedOptions.set(_.union(selectedOptions, [newOption]));
    }
    else {
      templInstance.selectedOptions.set(_.without(selectedOptions, newOption));
    }
  },
  "keyup .input-dynamic-table-search"(e, templInstance) {
    const elem = $(e.currentTarget);
    const data = Template.instance().data;
    const fieldType = templInstance.fieldType.get();
    if (fieldType === Date || fieldType === "time" || fieldType === Number) {
      doSearch(e, templInstance);
      return;
    }
    if (_.isArray(data.filter.options) || !data.filter.options) {
      templInstance.search.set(elem.val());
    }
    else {
      templInstance.searching.set(true);
      templInstance.throttledUpdate(templInstance.search, elem.val());
    }
  },
  "change .input-dynamic-table-search"(e, templInstance) {
    doSearch(e, templInstance);
  }
});
Template.dynamicTableFilterModal.onRendered(function onRendered() {
  Tracker.autorun(() => {
    if (this.editing.get()) {
      Tracker.afterFlush(() => {
        if ($.fn.select2) {
          this.$(".dynamic-table-filter-edit-group").select2({
            tags: true,
            placeholder: "Select a Group",
            allowClear: true,
            data: _.union(
              [{ id: "", value: "" }],
              this.data.groupNames.map(g => ({ id: g, text: g }))
            )
          });
          this.$(".dynamic-table-filter-edit-group").val(this.editableField.get().groupName).trigger("change");
        }
      });
    }
  });
});

Template.dynamicTableFilterModal.onCreated(function onCreated() {
  this.editableField = new ReactiveVar(this.data.field && this.data.field.edit && this.data.field.edit.spec);
  this.isArrayField = new ReactiveVar(false);
  this.fieldLabel = new ReactiveVar(this.data.field && this.data.field.label);
  this.fieldType = new ReactiveVar(this.data.field && this.data.field.type);
  if (this.data.field && this.data.field.type && _.isArray(this.data.field && this.data.field.type)) {
    this.fieldType.set(this.data.field.type[0]);
    this.isArrayField.set(true);
  }
  this.currentSpec = new ReactiveDict();
  this.editing = new ReactiveVar(false);
  this.showOperators = new ReactiveVar(this.data.filter && this.data.filter.operator && this.data.filter.operator.selected && !["$in", "$regex", "$between"].includes(this.data.filter.operator.selected));
  this.options = new ReactiveVar();
  this.allOptions = new ReactiveVar([]);
  this.search = new ReactiveVar(this.data.filter && this.data.filter.search && this.data.filter.search.value);
  this.searching = new ReactiveVar(false);
  this.selectedOptions = new ReactiveVar([]);
  this.searchChanged = new Tracker.Dependency();
  this.sortDirection = new ReactiveVar(this.data.sort && this.data.sort.direction);
  this.asyncOptions = new ReactiveVar(false);
  this.operator = new ReactiveVar(this.data.filter && this.data.filter && this.data.filter.operator && this.data.filter.operator.selected);
  this.throttledUpdate = _.throttle(
    (reactiveVar, val) => {
      reactiveVar.set(val);
    },
    this.data.filter && this.data.filter.throttle ? this.data.filter.throttle.wait : 1000,
    this.data.filter && this.data.filter.throttle ? this.data.filter.throttle.options : { leading: false }
  );

  const data = this.data;
  if (data.filter && _.isFunction(data.filter.options)) {
    const initSearch = data.filter.selectedOptions && !_.isArray(data.filter.selectedOptions) && data.filter.selectedOptions.length ? data.filter.selectedOptions : undefined;
    const options = data.filter.options(data, initSearch, (asyncOptions) => {
      this.asyncOptions.set(true);
      this.allOptions.set(asyncOptions.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
      this.options.set(asyncOptions.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
      this.searching.set(false);
    });
    if (options instanceof Promise) {
      options.then((asyncOptions) => {
        this.asyncOptions.set(true);
        this.allOptions.set(asyncOptions.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
        this.options.set(asyncOptions.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
        this.searching.set(false);
      });
    }
    else if (options) {
      this.allOptions.set(options.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
      this.options.set(options.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
      this.searching.set(false);
    }
  }
  else if (data.filter && _.isArray(data.filter.options)) {
    this.allOptions.set(data.filter.options.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
    this.options.set(data.filter.options.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
  }
  if (data.filter && data.filter.selectedOptions) {
    if (_.isFunction(data.filter.selectedOptions)) {
      const selectedOptions = data.filter.selectedOptions(data, (asyncOptions) => {
        this.selectedOptions.set(asyncOptions);
      });
      if (selectedOptions instanceof Promise) {
        selectedOptions.then((asyncOptions) => {
          this.selectedOptions.set(asyncOptions);
        });
      }
      else if (selectedOptions) {
        this.selectedOptions.set(selectedOptions);
      }
    }
    else if (_.isArray(data.filter.selectedOptions)) {
      this.selectedOptions.set(data.filter.selectedOptions);
    }
  }
  let lastSearch;
  if (data.filter && data.filter.options) {
    this.autorun(() => {
      const search = this.search.get();
      if (search === lastSearch) {
        return;
      }
      lastSearch = search;
      if (_.isFunction(data.filter.options)) {
        const options = data.filter.options(data, search, (asyncOptions) => {
          this.options.set(asyncOptions.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
          this.searching.set(false);
        });
        if (options instanceof Promise) {
          options.then((asyncOptions) => {
            this.options.set(asyncOptions.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
            this.searching.set(false);
          });
        }
        else if (options) {
          this.options.set(options.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
          this.searching.set(false);
        }
      }
      else if (_.isArray(data.filter.options)) {
        if (search) {
          this.options.set(data.filter.options.map(o => ((typeof o) === "object" ? o : { label: o, value: o })).filter(o => o.label.match(new RegExp(search, "i"))));
        }
        else {
          this.options.set(data.filter.options.map(o => ((typeof o) === "object" ? o : { label: o, value: o })));
        }
      }
    });
  }

  const callback = this.data.callback;
  if (callback && this.data.filter && this.data.filter.enabled) {
    this.autorun((comp) => {
      let selectedOptions = this.selectedOptions.get();
      let operator = this.operator.get();
      const options = this.allOptions.get();
      const fieldType = this.fieldType.get();
      if (selectedOptions.length === 0 && (fieldType === Date || fieldType === "time" || fieldType === Number)) {
        selectedOptions = this.search.get();
        const numericSearches = [
          "$gt",
          "$lt",
          "$gte",
          "$lte",
          "$between"
        ];
        if (!numericSearches.includes(operator)) {
          operator = "$between";
        }
        if (operator === "$between" && selectedOptions instanceof Date) {
          selectedOptions = [
            selectedOptions,
            new Date(selectedOptions.getTime() + (24 * 60 * 60 * 1000))
          ];
        }
        else if (operator === "$between" && (typeof selectedOptions) === "number") {
          // HACK: to handle equality of numbers
          selectedOptions = [
            selectedOptions,
            selectedOptions
          ];
        }
      }
      else if (!options || !options.length && !this.asyncOptions.get()) {
        selectedOptions = this.search.get();
        if (operator === "$in" || operator === "$all") {
          operator = "$regex";
        }
        else if (operator === "$nin" || operator === "$not$all") {
          operator = "$not";
        }
      }
      const direction = this.sortDirection.get();
      if (comp.firstRun) {
        return;
      }

      if (fieldType === Number) {
        if (_.isArray(selectedOptions)) {
          selectedOptions = selectedOptions.map(v => (typeof v === "number" ? v : (v.includes(".") ? parseFloat(v) : parseInt(v, 10))));
        }
      }
      if (fieldType === Date) {
        if (_.isArray(selectedOptions)) {
          selectedOptions = selectedOptions.map(v => new Date(v));
        }
      }
      Tracker.nonreactive(() => callback(selectedOptions, operator, direction, false));
    });
  }
});
