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
  hasFooter() {
    return this.filter.enabled || !this.filter.required;
  },
  checkedIfWithValue() {
    return ["$between", "$in", "$all", "$regex"].includes(this.filter.operator.selected) ? { checked: "checked" } : {};
  },
  checkedIfGteValue() {
    return this.filter.operator.selected === "$gte" ? { checked: "checked" } : {};
  },
  checkedIfLteValue() {
    return this.filter.operator.selected === "$lte" ? { checked: "checked" } : {};
  },
  checkedIfWithoutValue() {
    return ["$nin", "$not$all", "$not"].includes(this.filter.operator.selected) ? { checked: "checked" } : {};
  },
  isAny() {
    return ["$in", "$nin"].includes(Template.instance().operator.get());
  },
  isAll() {
    return ["$all", "$not$all"].includes(Template.instance().operator.get());
  },
  isNumericOrDate() {
    const fieldType = this.field && this.field.type && (this.field.type[0] || this.field.type);
    return fieldType && (fieldType === "time" || fieldType === Number || fieldType === Date);
  },
  isTime() {
    const fieldType = this.field && this.field.type && (this.field.type[0] || this.field.type);
    return fieldType && (fieldType === "time");
  },
  isNumber() {
    const fieldType = this.field && this.field.type && (this.field.type[0] || this.field.type);
    return fieldType && (fieldType === Number);
  },
  isDate() {
    const fieldType = this.field && this.field.type && (this.field.type[0] || this.field.type);
    return fieldType && (fieldType === Date);
  },
  isStringOrCustom() {
    const type = _.isArray(this.field.type) ? this.field.type[0] : this.field.type;
    return type === String || (type !== Number && type !== Date && type !== "time");
  },
  isString() {
    return this.field && this.field.type && (this.field.type === String || this.field.type[0] === String);
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
    const search = Template.instance().search.get();
    const selectedOptions = Template.instance().selectedOptions.get().map(o => _.findWhere(options, { value: o }));
    return selectedOptions.filter(option => option && (!search || option.label.match(new RegExp(search, "i")))).map(o => _.extend({ _id: o.value }, o));
  },
  searching() {
    return Template.instance().searching.get();
  },
  loading() {
    return Template.instance().data.dataTable && Template.instance().data.dataTable.loading.get();
  },
  isArrayField() {
    return Template.instance().data.field && _.isArray(Template.instance().data.field.type);
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
  }
});

function doSearch(e, templInstance) {
  const elem = $(e.currentTarget);
  const data = Template.instance().data;
  if (data.field.type === Date || data.field.type[0] === Date) {
    const date = new Date(elem.val());
    if (!Number.isNaN(date.getTime())) {
      templInstance.search.set(date);
    }
    else {
      templInstance.search.set(undefined);
    }
  }
  else if (data.field.type === Number || data.field.type[0] === Number) {
    templInstance.search.set(parseInt(templInstance.$(".input-dynamic-table-search").val()));
  }
  else if (data.field.type === "time" || data.field.type[0] === "time") {
    const mins = parseInt($(templInstance.$(".input-dynamic-table-search")[0]).val(), 10) || 0;
    const secs = parseInt($(templInstance.$(".input-dynamic-table-search")[1]).val(), 10) || 0;
    templInstance.search.set((mins * 60) + secs);
  }
}


Template.dynamicTableFilterModal.events({
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
  "click .btn-dynamic-table-operator"(e, templInstance) {
    const options = Template.instance().options.get();
    const hasOptions = options && options.length;
    let operator = templInstance.$(".input-dynamic-table-operator:checked").val();
    if (operator === "$in") {
      if (!hasOptions) {
        operator = "$regex";
      }
      if ($(e.currentTarget).data("modifier") === "$all") {
        operator = "$all";
      }
    }
    if (operator === "$nin") {
      if (!hasOptions) {
        operator = "$not";
      }
      if ($(e.currentTarget).data("modifier") === "$all") {
        operator = "$not$all";
      }
    }
    templInstance.operator.set(operator);
  },
  "click .input-dynamic-table-option,.input-dynamic-table-option-selected"(e, templInstance) {
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
    if (data.field.type === Date || data.field.type[0] === Date || data.field.type === "time" || data.field.type[0] === "time" || data.field.type === Number || data.field.type[0] === Number) {
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

Template.dynamicTableFilterModal.onCreated(function onCreated() {
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
    const initSearch = data.filter.selectedOptions && data.filter.selectedOptions.length ? data.filter.selectedOptions : undefined;
    const options = data.filter.options(data, initSearch, (asyncOptions) => {
      this.asyncOptions.set(true);
      this.allOptions.set(asyncOptions.map(o => (typeof o) === "object" ? o : { label: o, value: o }));
      this.searching.set(false);
    });
    if (options instanceof Promise) {
      options.then((asyncOptions) => {
        this.asyncOptions.set(true);
        this.allOptions.set(asyncOptions.map(o => (typeof o) === "object" ? o : { label: o, value: o }));
        this.searching.set(false);
      });
    }
    else if (options) {
      this.allOptions.set(options.map(o => (typeof o) === "object" ? o : { label: o, value: o }));
      this.searching.set(false);
    }
  }
  else if (data.filter && _.isArray(data.filter.options)) {
    this.allOptions.set(data.filter.options.map(o => (typeof o) === "object" ? o : { label: o, value: o }));
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
  if (data.filter && data.filter.options) {
    this.autorun(() => {
      const search = this.search.get();
      if (_.isFunction(data.filter.options)) {
        const options = data.filter.options(data, search, (asyncOptions) => {
          this.options.set(asyncOptions.map(o => (typeof o) === "object" ? o : { label: o, value: o }));
          this.searching.set(false);
        });
        if (options instanceof Promise) {
          options.then((asyncOptions) => {
            this.options.set(asyncOptions.map(o => (typeof o) === "object" ? o : { label: o, value: o }));
            this.searching.set(false);
          });
        }
        else if (options) {
          this.options.set(options.map(o => (typeof o) === "object" ? o : { label: o, value: o }));
          this.searching.set(false);
        }
      }
      else if (_.isArray(data.filter.options)) {
        if (search) {
          this.options.set(data.filter.options.map(o => (typeof o) === "object" ? o : { label: o, value: o }).filter(o => o.label.match(new RegExp(search, "i"))));
        }
        else {
          this.options.set(data.filter.options.map(o => (typeof o) === "object" ? o : { label: o, value: o }));
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
      if (this.data.field.type === Date || this.data.field.type[0] === Date || this.data.field.type === "time" || this.data.field.type[0] === "time" || this.data.field.type === Number || this.data.field.type[0] === Number) {
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

      Tracker.nonreactive(() => callback(selectedOptions, operator, direction, false));
    });
  }
});
