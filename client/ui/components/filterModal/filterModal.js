import { BlazeComponent } from "meteor/znewsham:blaze-component";

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

const fieldTypeMapping = {
  string: String,
  number: Number,
  date: Date,
  boolean: Boolean
};

export class FilterModal extends BlazeComponent {
  static HelperMap() {
    return [
      "dateValue",
      "minuteValue",
      "secondValue",
      "searchValue",

      "manageFieldsEditContext",
      "isLoading",
      "hasOptions",
      "getOptions",
      "hasSelectedOptions",
      "hasFilter",
      "hasFooter",
      "searchEnabled",
      "checkedIfSortDirection",

      "checkedIf",
      "checkedIfWithValue",
      "checkedIfSelected",
      "checkedIfWithAllValue",
      "checkedIfGteValue",
      "checkedIfLteValue",
      "checkedIfWithoutValue",
      "checkedIfWithoutAllValue",
      "checkedIfEmptyValue",
      "checkedIfNotEmptyValue",

      "isNumericOrDate",
      "isNumericOrDateAndNoOptions",
      "isTime",
      "isNumber",
      "isDate",
      "isString",
      "isStringOrCustom",
      "isBoolean",
      "isSelected",
      "isBooleanSelected",
      "isControlDisabledForParent",
      "shouldShowControl",

      "curIsParentFilter",
      "curParentFilterLabel",
      "curSelectedOptions",
      "curShowOperators",
      "curSearching",
      "curIsArrayField",
      "curEditing",
      "curEditableField",
      "curFieldLabel"
    ];
  }

  static EventMap() {
    return {
      "change .dynamic-table-filter-edit-type": "handleFilterEditTypeChange",
      "click .dynamic-table-filter-edit-isArray": "handleFilterEditIsArrayClick",
      "click .dynamic-table-filter-edit-searchable": "handleFilterEditSearchableClick",
      "click .btn-dynamic-table-cancel": "handleCancelClick",
      "click .btn-dynamic-table-save": "handleSaveClick",
      "click .dynamic-table-filter-edit-btn": "handleFilterEditBtnClick",
      "click .btn-dynamic-table-remove": "handleRemoveClick",
      "click .btn-dynamic-table-clear": "handleClearClick",
      "click .btn-dynamic-table-sort": "handleSortClick",
      "change .input-dynamic-table-operator": "handleInputOperatorChange",
      "click .fa-cog": "handleSettingsClick",
      "change .select-dynamic-table-operator": "handleSelectOperatorChange",
      "click .label-dynamic-table-selected": "handleSelectedClick",
      "click .input-dynamic-table-option": "handleOptionClick",
      "click .input-dynamic-table-filters-modal": "handleFiltersModalClick",
      "keyup .input-dynamic-table-search": "handleSearchKeyUp",
      "change .input-dynamic-table-search": "handleSearchChange"
    };
  }

  handleFilterEditTypeChange(e) {
    this.currentSpec.set("type", $(e.currentTarget).val());
  }

  handleFilterEditIsArrayClick(e) {
    this.currentSpec.set("isArray", $(e.currentTarget).is(":checked"));
  }

  handleFilterEditSearchableClick(e) {
    let indexedNumber = this.nonReactiveData().field.edit.spec.indexedNumber;
    indexedNumber = indexedNumber === false ? "new" : indexedNumber;
    this.currentSpec.set("indexedNumber", $(e.currentTarget).is(":checked") ? indexedNumber : false);
  }

  handleFiltersModalClick() {
    if(_.isFunction(this.triggerOpenFiltersModal.get())) {
      this.triggerOpenFiltersModal.get()();
      closeModal();
    }
  }

  handleCancelClick(e) {
    this.editing.set(false);
  }

  handleSaveClick(e) {
    this.$(".btn-dynamic-table-save").attr("disabled", "disabled");
    this.nonReactiveData().data.field.edit.callback(e, this).then((newSpec) => {
      this.$(".btn-dynamic-table-save").removeAttr("disabled");
      this.updateSpec(newSpec);
    }).catch(err => console.log(err));
  }

  handleFilterEditBtnClick() {
    this.editing.set(true);
  }

  handleRemoveClick() {
    this.nonReactiveData().data.callback([], "$in", undefined, false);
    this.nonReactiveData().data.removeColumn();
    closeModal();
  }

  handleClearClick() {
    this.search.set(undefined);
    this.selectedOptions.set([]);
    if(!!~this.operator.get().indexOf("$exists")) {
      // By changing the operator in this case, it triggers the filter to properly reset.
      this.operator.set("$in");
    }
    this.$(".input-dynamic-table-search").val("");
  }

  handleSortClick(e) {
    this.sortDirection.set($(e.currentTarget).data("direction"));
  }

  handleInputOperatorChange(e) {
    const options = this.options.get();
    const hasOptions = options && options.length;
    let operator = $(e.currentTarget).val();
    if (operator === "$in") {
      if (!hasOptions) {
        operator = "$regex";
      }
      if (this.$(".btn-dynamic-table-operator.btn-dynamic-table-selected").data("modifier") === "$all") {
        operator = "$all";
      }
    }
    if (operator === "$nin") {
      if (!hasOptions) {
        operator = "$not";
      }
    }
    if (!!~operator.indexOf("$exists")) {
      this.search.set(true);
      this.selectedOptions.set([]);
    }
    this.operator.set(operator);
  }

  handleSettingsClick() {
    this.showOperators.set(!this.showOperators.get());
  }

  handleSelectOperatorChange(e) {
    this.updateOperator(this.$(e.currentTarget).val());
    this.$(".input-dynamic-table-search").trigger("change");
  }

  handleSelectedClick(e) {
    if(!this.isParentFilter.get()) {
      this.updateSelectedOptions($(e.currentTarget).data("value"), false);
    }
  }

  handleOptionClick(e) {
    this.updateSelectedOptions($(e.currentTarget).val(), $(e.currentTarget).is(":checked"));
  }

  handleSearchKeyUp(e) {
    const value = $(e.currentTarget).val();
    const data = this.nonReactiveData();
    const fieldType = this.fieldType.get();
    if (fieldType === Date || fieldType === "time" || fieldType === Number) {
      this.doSearch(value);
      return;
    }
    if (_.isArray(data.filter.options)) {
      this.search.set(value);
    }
    else {
      this.searching.set(true);
      this.throttledUpdate(this.search, value);
    }
  }

  handleSearchChange(e) {
    this.doSearch($(e.currentTarget).val());
  }

  rendered() {
    this.autorun(() => {
      if (this.editing.get()) {
        Tracker.afterFlush(() => {
          if ($.fn.select2) {
            this.$(".dynamic-table-filter-edit-group").select2({
              tags: true,
              placeholder: "Select a Group",
              allowClear: true,
              data: _.union(
                [{ id: "", value: "" }],
                this.nonReactiveData().data.groupNames.map(g => ({ id: g, text: g }))
              )
            });
            this.$(".dynamic-table-filter-edit-group").val(this.editableField.get().groupName).trigger("change");
          }
        });
      }
    });
    /**
   * When filter modal is open over any existing bootstrap modal,
   * input element i.e search field of filter modal is not clickable,
   * To fix it, we get rid of focus on bootstrap modal
   */
    $(document).off("focusin.modal");
  }

  checkedIfWithValue() {
    const { filter } = this.nonReactiveData("filter");
    return ["$between", "$in", "$regex"].includes(filter.operator.selected) ? { selected: "selected" } : {};
  }

  checkedIfWithAllValue() {
    const { filter } = this.nonReactiveData("filter");
    return ["$all"].includes(filter.operator.selected) ? { selected: "selected" } : {};
  }

  checkedIfGteValue() {
    const { filter } = this.nonReactiveData("filter");
    return filter.operator.selected === "$gte" ? { selected: "selected" } : {};
  }

  checkedIfLteValue() {
    const { filter } = this.nonReactiveData("filter");
    return filter.operator.selected === "$lte" ? { selected: "selected" } : {};
  }

  checkedIfWithoutValue() {
    const { filter } = this.nonReactiveData("filter");
    return ["$nin"].includes(filter.operator.selected) ? { selected: "selected" } : {};
  }

  checkedIfWithoutAllValue() {
    const { filter } = this.nonReactiveData("filter");
    return ["$not$all"].includes(filter.operator.selected) ? { selected: "selected" } : {};
  }

  checkedIfNotEmptyValue() {
    const { filter } = this.nonReactiveData("filter");
    return ["$exists"].includes(filter.operator.selected) ? { selected: "selected" } : {};
  }

  checkedIfEmptyValue() {
    const { filter } = this.nonReactiveData("filter");
    return ["$not$exists"].includes(filter.operator.selected) ? { selected: "selected" } : {};
  }

  checkedIf(valA, valB) {
    const found = _.isArray(valA) ? valA.includes(valB) : valA === valB;
    return found ? { checked: "checked" } : {};
  }

  isBooleanSelected(value) {
    const data = this.nonReactiveData();
    const search = (data.filter && data.filter.search && data.filter.search.value);
    const selectedOption = data.filter.selectedOptions && [].concat(data.filter.selectedOptions)[0];
    const searchValue = _.isUndefined(search) ? selectedOption : search;
    return value === search ? { selected: "selected" } : {};
  }

  checkedIfSelected(o) {
    return this.isSelected(o) ? { checked: "checked", selected: "selected" } : {};
  }

  isSelected(o) {
    return _.find(this.selectedOptions.get(), value =>
      (value instanceof Date ? new Date(o).getTime() === new Date(value).getTime() : value.toString() === o.toString()));
  }

  checkedIfSortDirection(sortDirection) {
    return this.sortDirection.get() === sortDirection;
  }

  hasFooter() {
    const { filter } = this.nonReactiveData("filter");
    return filter && (filter.enabled || !filter.required);
  }

  searchEnabled() {
    const { filter } = this.nonReactiveData("filter");
    if (filter.options) {
      return filter.search && filter.search.enabled;
    }
    return filter.search === undefined || filter.search.enabled !== false;
  }

  isNumericOrDate() {
    const fieldType = this.fieldType.get();
    return fieldType && (fieldType === "time" || fieldType === Number || fieldType === Date);
  }

  isNumericOrDateAndNoOptions() {
    const fieldType = this.fieldType.get();
    const isNumericOrDate = fieldType && (fieldType === "time" || fieldType === Number || fieldType === Date);

    return isNumericOrDate && this.allOptions.get().length === 0;
  }

  isTime() {
    const fieldType = this.fieldType.get();
    return fieldType && (fieldType === "time");
  }

  isNumber() {
    const fieldType = this.fieldType.get();
    return fieldType && (fieldType === Number);
  }

  isDate() {
    const fieldType = this.fieldType.get();
    return fieldType && (fieldType === Date);
  }

  isString() {
    const fieldType = this.fieldType.get();
    return fieldType === String;
  }

  isStringOrCustom() {
    const fieldType = this.fieldType.get();
    return fieldType === String ||
      (fieldType !== Number && fieldType !== Date && fieldType !== "time" && fieldType !== Boolean);
  }

  isBoolean() {
    const fieldType = this.fieldType.get();
    return fieldType === Boolean;
  }

  searchValue() {
    const data = this.nonReactiveData();
    return data.filter && data.filter.search && data.filter.search.value;
  }

  dateValue() {
    const searchValue = this.searchValue();
    const date = (searchValue instanceof Date) ? searchValue : new Date(searchValue);
    if (date) {
      if (!searchValue || date === "Invalid Date") {
        return "";
      }
      return date.toISOString().split("T")[0];
    }
  }

  minuteValue() {
    const time = this.searchValue();
    return time ? Math.floor(time / 60) : 0;
  }

  secondValue() {
    const time = this.searchValue();
    return time ? time % 60 : 0;
  }

  manageFieldsEditContext() {
    const data = this.nonReactiveData();
    return data.field.edit;
  }

  isLoading() {
    const data = this.nonReactiveData();
    return data.dataTable && data.dataTable.loading.get();
  }

  hasOptions() {
    if (this.asyncOptions.get()) {
      return !this.isParentFilter.get() && !~this.operator.get().indexOf("$exists");
    }

    const options = this.allOptions.get();
    return options && options.length && !this.isParentFilter.get() && !~this.operator.get().indexOf("$exists");
  }

  shouldShowControl() {
    const searchValue = this.searchValue();
    return (!this.isParentFilter.get() || searchValue && searchValue.length) && !~this.operator.get().indexOf("$exists");
  }

  getOptions() {
    const options = this.options.get();
    return options && options.map(o => _.extend({ _id: o.value instanceof Date ? o.value.toString() : o.value }, o));
  }

  hasSelectedOptions() {
    const options = this.selectedOptions.get();
    return options && options.length;
  }

  curSelectedOptions() {
    const options = this.allOptions.get();
    if (!options) {
      return [];
    }
    const compareValues = (a, b) => (a instanceof Date ? a.getTime() === new Date(b).getTime() : a === b);
    const selectedOptions = _.compact(this.selectedOptions.get().map(o => _.find(options, ({ label, value }) =>
      compareValues(label, o) || compareValues(value, o))));
    return selectedOptions.map(o => _.extend({ _id: o.value instanceof Date ? o.value.toString() : o.value }, o));
  }

  curShowOperators() {
    return this.showOperators.get() || (this.isParentFilter.get() && !this.isComplexFilter.get());
  }

  curSearching() {
    return this.searching.get();
  }

  curIsArrayField() {
    return this.isArrayField.get();
  }

  curEditing() {
    return this.editing.get();
  }

  curEditableField() {
    return this.editableField.get();
  }

  curFieldLabel() {
    return this.fieldLabel.get();
  }

  curIsParentFilter() {
    return this.isParentFilter.get();
  }

  curParentFilterLabel() {
    return this.parentFilterLabel.get();
  }

  isControlDisabledForParent() {
    return this.isParentFilter.get() ? "disabled" : ""
  }

  updateSpec(spec) {
    const data = this.nonReactiveData();
    Tracker.nonreactive(() => {
      this.editableField.set(spec);
    });
    this.fieldType.set(fieldTypeMapping[spec.type]);
    this.fieldLabel.set(spec.label);
    this.editing.set(false);
    if (_.isFunction(data.editFieldCallback)) {
      data.editFieldCallback(spec);
    }
  }

  updateOperator(operator) {
    const options = this.options.get();
    if (!_.isArray(options)) {
      switch (operator) {
      case "$in":
        operator = "$regex";
        break;
      case "$nin":
        operator = "$not";
        break;
      default:
      }
    }
    if (!!~operator.indexOf("$exists")) {
      this.search.set(true);
      this.selectedOptions.set([]);
    }
    this.operator.set(operator);
  }

  updateSelectedOptions(newOption, checked) {
    const selectedOptions = this.selectedOptions.get();
    newOption = newOption.toString();
    if (checked) {
      this.selectedOptions.set(_.union(selectedOptions, [newOption]));
    }
    else {
      this.selectedOptions.set(selectedOptions.filter(f => f !== newOption));
    }
  }

  doSearch(...values) {
    const fieldType = this.fieldType.get();
    switch (fieldType) {
    case Date:
      this.searchDate(...values);
      break;
    case Number:
      this.searchNumber(...values);
      break;
    case "time":
      this.searchTime(...values);
      break;
    case Boolean:
      this.searchBoolean(...values);
      break;
    default:
    }
  }

  searchDate(rawDate) {
    const date = new Date(rawDate);
    this.search.set(!Number.isNaN(date.getTime()) ? date : undefined);
  }

  searchNumber(rawNumber) {
    try {
      this.search.set(parseInt(rawNumber === "" ? 0 : rawNumber, 10));
    }
    catch (e) {
      console.error(e);
      this.search.set(undefined);
    }
  }

  searchTime(rawMinutes, rawSeconds) {
    try {
      const minutes = parseInt(rawMinutes === "" ? 0 : rawMinutes, 10);
      const seconds = parseInt(rawSeconds === "" ? 0 : rawSeconds, 10);
      this.search.set((minutes * 60) + seconds);
    }
    catch (e) {
      console.error(e);
      this.search.set(undefined);
    }
  }

  searchBoolean(rawBoolean) {
    if (_.contains(["true", "false"], rawBoolean)) {
      this.search.set(rawBoolean === "true");
    }
    else {
      console.error("Expected a value of 'true' or 'false' for a boolean type.");
      this.search.set(undefined);
    }
  }

  init() {
    this.editableField = new ReactiveVar(null);
    this.isArrayField = new ReactiveVar(false);
    this.fieldLabel = new ReactiveVar(null);
    this.fieldType = new ReactiveVar(null);
    this.currentSpec = new ReactiveDict();
    this.editing = new ReactiveVar(false);
    this.showOperators = new ReactiveVar(false);
    this.options = new ReactiveVar(null);
    this.allOptions = new ReactiveVar([]);
    this.search = new ReactiveVar(null);
    this.searching = new ReactiveVar(false);
    this.selectedOptions = new ReactiveVar([]);
    this.searchChanged = new Tracker.Dependency();
    this.sortDirection = new ReactiveVar(null);
    this.asyncOptions = new ReactiveVar(false);
    this.operator = new ReactiveVar(null);
    this.isParentFilter = new ReactiveVar(false);
    this.isComplexFilter = new ReactiveVar(false);
    this.parentFilterLabel = new ReactiveVar(null);
    this.triggerOpenFiltersModal = new ReactiveVar(null);

    this.autorun(() => {
      const data = this.nonReactiveData();

      // If this value is set, then the filter being shown is
      // from a parent component and can't be changed by this filter.
      if(data.parentFilterData) {
        this.isParentFilter.set(true);
        this.parentFilterLabel.set(data.parentFilterData.label);
        this.triggerOpenFiltersModal.set(data.parentFilterData.triggerOpenFiltersModal);

        // If this is a filter with multiple OR groups, just return and do nothing.
        if(data.parentFilterData.isComplexFilter) {
          this.isComplexFilter.set(true);
          return;
        }
      }

      this.editableField.set(data.field && data.field.edit && data.field.edit.spec);
      this.isArrayField.set(false);
      this.fieldLabel.set(data.field && data.field.label);
      this.fieldType.set(data.field && data.field.type);

      if (data.field && data.field.type && _.isArray(data.field && data.field.type)) {
        this.fieldType.set(data.field.type[0]);
        this.isArrayField.set(true);
      }

      this.currentSpec = new ReactiveDict();
      this.editing.set(false);
      this.showOperators.set(data.filter &&
        data.filter.operator &&
        data.filter.operator.selected &&
        !["$in", "$regex", "$between"].includes(data.filter.operator.selected));

      this.options.set();
      this.allOptions.set([]);
      this.search.set(data.filter && data.filter.search && data.filter.search.value);
      this.searching.set(false);
      this.selectedOptions.set([]);
      this.searchChanged = new Tracker.Dependency();
      this.sortDirection.set(data.sort && data.sort.direction);
      this.asyncOptions.set(false);
      this.operator.set(data.filter &&
        data.filter &&
        data.filter.operator &&
        data.filter.operator.selected);
      this.throttledUpdate = _.throttle(
        (reactiveVar, val) => {
          reactiveVar.set(val);
        },
        data.filter && data.filter.throttle ? data.filter.throttle.wait : 1000,
        data.filter && data.filter.throttle ? data.filter.throttle.options : { leading: false }
      );

      const formatOptions = options => options.map((o) => {
        if (typeof (o) === "object") {
          if (o.value && o.label) {
            return {
              value: o.value,
              label: o.label.toString()
            };
          }
          return o;
        }

        return {
          value: o,
          label: o.toString()
        };
      });

      if (data.filter && _.isArray(data.filter.selectedOptions)) {
        data.filter.selectedOptions = data.filter.selectedOptions.map(x => x.toString());
      }

      if (data.filter && _.isFunction(data.filter.options)) {
        const optionsCallback = (options) => {
          const formattedOptions = formatOptions(options);
          this.allOptions.set(formattedOptions);
          this.options.set(formattedOptions);
          this.asyncOptions.set(true);
          this.searching.set(false);
        };

        const initSearch = data.filter.selectedOptions &&
          !_.isArray(data.filter.selectedOptions) &&
          data.filter.selectedOptions.length ? data.filter.selectedOptions : undefined;
        const options = data.filter.options(data, initSearch, asyncOptions => optionsCallback(asyncOptions));
        if (options instanceof Promise) {
          options.then(asyncOptions => optionsCallback(asyncOptions));
        }
        else if (options) {
          const formattedOptions = formatOptions(options);
          this.allOptions.set(formattedOptions);
          this.options.set(formattedOptions);
          this.searching.set(false);
        }
      }
      else if (data.filter && _.isArray(data.filter.options)) {
        const formattedOptions = formatOptions(data.filter.options);
        this.allOptions.set(formattedOptions);
        this.options.set(formattedOptions);
      }

      if (data.filter && data.filter.selectedOptions) {
        if (_.isFunction(data.filter.selectedOptions)) {
          const selectedOptions = data.filter.selectedOptions(data, asyncOptions => this.selectedOptions.set(asyncOptions));
          if (selectedOptions instanceof Promise) {
            selectedOptions.then(asyncOptions => this.selectedOptions.set(asyncOptions));
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
          const optionsCallback = (options) => {
            const formattedOptions = formatOptions(options);
            this.options.set(formattedOptions);
            this.searching.set(false);
          };
          const search = this.search.get();
          if (search === lastSearch) {
            return;
          }
          lastSearch = search;
          if (_.isFunction(data.filter.options)) {
            const options = data.filter.options(
              data, search, this.operator.get(),
              asyncOptions => optionsCallback(asyncOptions)
            );
            if (options instanceof Promise) {
              options.then(asyncOptions => optionsCallback(asyncOptions));
            }
            else if (options) {
              const formattedOptions = formatOptions(options);
              this.options.set(formattedOptions);
              this.searching.set(false);
            }
          }
          else if (_.isArray(data.filter.options)) {
            if (search) {
              this.options.set(formatOptions(data.filter.options).filter(o => o.label.match(new RegExp(search, "i"))));
            }
            else {
              this.options.set(formatOptions(data.filter.options));
            }
          }
        });
      }

      const callback = data.callback;
      if (callback && data.filter && data.filter.enabled) {
        this.autorun((comp) => {
          let selectedOptions = this.selectedOptions.get();
          let operator = this.operator.get();
          const originalOperator = operator;
          const options = this.allOptions.get();
          const fieldType = this.fieldType.get();
          const trackOptions = options.length;
          if (selectedOptions.length === 0 &&
            ((!trackOptions && fieldType === Date) || fieldType === "time" || fieldType === Number)) {
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
              selectedOptions = selectedOptions.map(v =>
                ((typeof v === "number" && v) || v.includes(".") ? parseFloat(v) : parseInt(v, 10)));
            }
          }
          if (fieldType === Date) {
            if (_.isArray(selectedOptions)) {
              selectedOptions = selectedOptions.map(v => new Date(v));
            }
            if (trackOptions) {
              operator = "$in";
            }
          }
          if (fieldType === Boolean) {
            operator = "$eq";
          }

          Tracker.nonreactive(() => callback(_.isArray(selectedOptions) ? selectedOptions.map(option => options.find(item => item.label.toString() === option.toString() || item.value.toString() === option.toString()).value) : selectedOptions, operator, direction, false, originalOperator));
        });
      }
    });
  }
}
BlazeComponent.register(Template.dynamicTableFilterModal, FilterModal);
