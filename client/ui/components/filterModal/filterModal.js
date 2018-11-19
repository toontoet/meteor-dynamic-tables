import _ from "underscore";
import "./filterModal.html";
import "./filterModal.css";

Template.dynamicTableFilterModal.helpers({
  isNumeric() {
    return this.field && this.field.type && (this.field.type === Number || this.field.type[0] === Number);
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
  hasOptions() {
    const options = Template.instance().options.get();
    return options && options.length;
  },
  options() {
    return Template.instance().options.get();
  },
  hasSelectedOptions() {
    const options = Template.instance().selectedOptions.get();
    return options && options.length;
  },
  selectedOptions() {
    return Template.instance().selectedOptions.get();
  },
  searching() {
    return Template.instance().searching.get();
  }
});


Template.dynamicTableFilterModal.events({
  "click .btn-dynamic-table-sort"(e, templInstance) {
    templInstance.sortDirection.set($(e.currentTarget).data("direction"));
  },
  "change .input-dynamic-table-operator"(e, templInstance) {
    templInstance.searchChanged.changed();
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
    if (_.isArray(data.filter.options)) {
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
  this.search = new ReactiveVar();
  this.searching = new ReactiveVar(false);
  this.selectedOptions = new ReactiveVar([]);
  this.searchChanged = new Tracker.Dependency();
  this.sortDirection = new ReactiveVar(this.data.sort && this.data.sort.direction);
  this.throttledUpdate = _.throttle(
    (reactiveVar, val) => {
      reactiveVar.set(val);
    },
    this.data.filter && this.data.filter.throttle ? this.data.filter.throttle.wait : 1000,
    this.data.filter && this.data.filter.throttle ? this.data.filter.throttle.options : undefined
  );

  const data = this.data;
  if (data.filter && data.filter.selectedOptions) {
    if (_.isFunction(data.filter.selectedOptions)) {
      const selectedOptions = data.filter.selectedOptions(data, (asyncOptions) => {
        this.selectedOptions.set(asyncOptions);
      });
      if (selectedOptions instanceof Promise) {
        selectedOptions.then((asyncOptions) => {
          this.options.set(asyncOptions);
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
          this.options.set(asyncOptions);
          this.searching.set(false);
        });
        if (options instanceof Promise) {
          options.then((asyncOptions) => {
            this.options.set(asyncOptions);
            this.searching.set(false);
          });
        }
        else if (options) {
          this.options.set(options);
          this.searching.set(false);
        }
      }
      else if (_.isArray(data.filter.options)) {
        if (search) {
          this.options.set(data.filter.options.filter(o => o.match(new RegExp(search))));
        }
        else {
          this.options.set(data.filter.options);
        }
      }
    });
  }

  const callback = this.data.callback;
  if (callback) {
    this.autorun((comp) => {
      this.searchChanged.depend();
      const selectedOptions = this.selectedOptions.get();
      const direction = this.sortDirection.get();
      if (comp.firstRun) {
        return;
      }
      const operator = this.$("input.input-dynamic-table-operator:checked").val();
      callback(selectedOptions, operator, direction);
    });
  }
});
