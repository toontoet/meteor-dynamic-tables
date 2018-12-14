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
    return ["$in", "$all", "$regex"].includes(this.filter.operator.selected) ? { checked: "checked" } : {};
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
    return fieldType && (fieldType === Number || fieldType === Date);
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
    const options = Template.instance().options.get();
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
    const search = Template.instance().search.get();
    return Template.instance().selectedOptions.get().map(o => _.findWhere(options, { value: o })).filter(option => !search || option.label.match(new RegExp(search, "i"))).map(o => _.extend({ _id: o.value }, o));
  },
  searching() {
    return Template.instance().searching.get();
  },
  loading() {
    return Template.instance().data.dataTable && Template.instance().data.dataTable.loading.get();
  },
  isArrayField() {
    return Template.instance().data.field && _.isArray(Template.instance().data.field.type);
  }
});


Template.dynamicTableFilterModal.events({
  "click .btn-dynamic-table-remove"(e, templInstance) {
    templInstance.data.callback([], "$in", undefined, false);
    templInstance.data.removeColumn();
    closeModal();
  },
  "click .btn-dynamic-table-clear"(e, templInstance) {
    templInstance.data.callback([], "$in", undefined, false);
  },
  "click .btn-dynamic-table-sort"(e, templInstance) {
    templInstance.sortDirection.set($(e.currentTarget).data("direction"));
  },
  "change .input-dynamic-table-operator"(e, templInstance) {
    let operator = $(e.currentTarget).val();
    if (operator === "$in") {
      if (!templInstance.data.filter.options) {
        operator = "$regex";
      }
      if (templInstance.$(".btn-dynamic-table-operator.btn-dynamic-table-selected").data("modifier") === "$all") {
        operator = "$all";
      }
    }
    if (operator === "$nin") {
      if (!templInstance.data.filter.options) {
        operator = "$not";
      }
      if (templInstance.$(".btn-dynamic-table-operator.btn-dynamic-table-selected").data("modifier") === "$all") {
        operator = "$not$all";
      }
    }
    templInstance.operator.set(operator);
  },
  "click .btn-dynamic-table-operator"(e, templInstance) {
    let operator = templInstance.$(".input-dynamic-table-operator:checked").val();
    if (operator === "$in") {
      if (!templInstance.data.filter.options) {
        operator = "$regex";
      }
      if ($(e.currentTarget).data("modifier") === "$all") {
        operator = "$all";
      }
    }
    if (operator === "$nin") {
      if (!templInstance.data.filter.options) {
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
    if (_.isArray(data.filter.options) || !data.filter.options) {
      templInstance.search.set(elem.val());
    }
    else {
      templInstance.searching.set(true);
      templInstance.throttledUpdate(templInstance.search, elem.val());
    }
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
    const options = data.filter.options(data, undefined, (asyncOptions) => {
      this.allOptions.set(asyncOptions.map(o => (typeof o) === "object" ? o : { label: o, value: o }));
      this.searching.set(false);
    });
    if (options instanceof Promise) {
      options.then((asyncOptions) => {
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
  if (callback) {
    this.autorun((comp) => {
      this.searchChanged.depend();
      let selectedOptions = this.selectedOptions.get();
      if (!this.data.filter || !this.data.filter.options) {
        selectedOptions = this.search.get();
      }
      const direction = this.sortDirection.get();
      if (comp.firstRun) {
        return;
      }
      const operator = this.operator.get();
      callback(selectedOptions, operator, direction, false);
    });
  }
});
