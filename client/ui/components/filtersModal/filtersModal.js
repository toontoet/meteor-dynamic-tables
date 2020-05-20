import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { nextId, jQueryData, arraysEqual } from "../../helpers.js";
import { changed } from "../../../inlineSave.js";

import "./filtersModal.html";
import "./filtersModal.css";

const opMap = {
  all: {
    id: "all",
    label: "is...",
    toQuery: options => ({$all: options})
  },
  notAll: {
    id: "notAll",
    label: "is not...",
    toQuery: options => ({$not: {$all: options}})
  },
  in: {
    id: "in",
    label: "is any of...",
    toQuery: options => ({$in: options})
  },
  notIn: {
    id: "notIn",
    label: "is none of...",
    toQuery: options => ({$not: {$in: options}})
  },
  empty: {
    id: "empty",
    label: "is empty",
    toQuery: () => ({$exists: false})
  },
  notEmpty: {
    id: "notEmpty",
    label: "is not empty",
    toQuery: () => ({$exists: true})
  },
  equals: {
    id: "equals",
    label: "=",
    toQuery: options => ({$eq: options[0]})
  },
  notEquals: {
    id: "notEquals",
    label: "≠",
    toQuery: options => ({$ne: options[0]})
  },
  greaterThan: {
    id: "greaterThan",
    label: ">",
    toQuery: options => ({$gt: options[0]})
  },
  lessThan: {
    id: "lessThan",
    label: "<",
    toQuery: options => ({$lt: options[0]})
  },
  lessThanEqual: {
    id: "lessThanEqual",
    label: "≤",
    toQuery: options => ({$lte: options[0]})
  },
  greaterThanEqual: {
    id: "greaterThanEqual",
    label: "≥",
    toQuery: options => ({$gte: options[0]})
  },
  isBefore: {
    id: "isBefore",
    label: "is before...",
    toQuery: options => ({$lt: options[0]})
  },
  isAfter: {
    id: "isAfter",
    label: "is after...",
    toQuery: options => ({$lt: options[0]})
  }
};

const typeMap = [
  {
    type: [Array],
    operators: [
      opMap.all,
      opMap.notAll,
      opMap.in,
      opMap.notIn,
      opMap.empty,
      opMap.notEmpty
    ]
  },
  {
    type: [String],
    operators: [
      opMap.all,
      opMap.notAll,
      opMap.empty,
      opMap.notEmpty
    ]
  },
  {
    type: [Date, "time"],
    operators: [
      opMap.all,
      opMap.notAll,
      opMap.empty,
      opMap.notEmpty,
      opMap.isBefore,
      opMap.isAfter
    ]
  },
  {
    type: Number,
    operators: [
      opMap.equals,
      opMap.notEquals,
      opMap.lessThan,
      opMap.lessThanEqual,
      opMap.greaterThan,
      opMap.greaterThanEqual,
      opMap.empty,
      opMap.notEmpty
    ]
  },
  {
    type: Boolean,
    operators: [
      opMap.all,
      opMap.notAll,
      opMap.empty,
      opMap.notEmpty
    ]
  }
];

export class FiltersModal extends BlazeComponent {
  static HelperMap() {
    return [
      "getFilterGroups",
      "hasFilterGroups",

      "requiresDelimiter",
      "canAddFilters",
      "getFiltersData",
      "getOperatorOptions",
      "hasOptions",

      "isComplexDataType",
      "isTime",
      "isNumber",
      "isDate",
      "isString",
      "isBoolean",
      "isControlDisabled",

      "dateValue",
      "minuteValue",
      "secondValue",
      "searchValue"
    ];
  }

  static EventMap() {
    return {
      "click .dynamic-table-filters-add-filter-group": "handleAddFilterGroupClick",
      "click .dynamic-table-filters-add-filter": "handleAddFilterClick",
      "click .dynamic-table-filters-remove-filter": "handleRemoveFilterClick",
      "click .dynamic-table-filters-clear": "handleClearClick",
      "click .dynamic-table-filters-apply": "handleApplyClick",
      "click .dynamic-table-filters-cancel": "handleCancelClick",
      "change .dynamic-table-filters-search": "handleSearchChange",
      "change .dynamic-table-filters-operator": "handleOperatorChange",
      "change .dynamic-table-filters-column": "handleColumnChange"
    };
  }

  handleSearchChange(e) {
    let value = $(e.currentTarget).val();
    if($(e.currentTarget).hasClass("minutes") || $(e.currentTarget).hasClass("seconds")) {
      value = $(".minutes").val() * 60 + $(".seconds").val();
    }
    this.updateFilter(...jQueryData(e, "group", "id"), [].concat(value));
  }

  handleOperatorChange(e){
    this.updateOperator(...jQueryData(e, "group", "id"), $(e.currentTarget).val());
  }

  handleColumnChange(e) {
    this.updateColumn(...jQueryData(e, "group", "id"), $(e.currentTarget).val());
  }

  handleAddFilterGroupClick() {
    this.addFilterGroup();
  }

  handleRemoveFilterClick(e) {
    this.removeFilter(...jQueryData(e, "group", "id"));
  }

  handleAddFilterClick(e) {
    this.addFilter(...jQueryData(e, "group"));
  }

  handleClearClick() {
    this.filterGroups.set([]);
  }

  handleCancelClick() {
    $("#dynamicTableFiltersModal").modal("hide");
  }

  handleApplyClick() {
    this.filterGroups.get().forEach(filterGroup => {
      filterGroup.filters.forEach(filter => {
        filter.query = filter.operator.toQuery(filter.selectedOptions);
      });
    });
  }

  isComplexDataType(filter) {
    return filter.type === Date || filter.type === "time" || filter.type === Boolean
  }

  isTime(filter) {
    return filter.type && (filter.type === "time");
  }

  isNumber(filter) {
    return filter.type && (filter.type === Number);
  }

  isDate(filter) {
    return filter.type && (filter.type === Date);
  }

  isBoolean(filter) {
    return filter.type === Boolean;
  }

  searchValue(filter) {
    return filter.selectedOptions && filter.selectedOptions.length ? filter.selectedOptions[0] : "";
  }

  dateValue(filter) {
    const searchValue = this.searchValue(filter);
    const date = (searchValue instanceof Date) ? searchValue : new Date(searchValue);
    if (date) {
      if (!searchValue || date === "Invalid Date") {
        return "";
      }
      return date.toISOString().split("T")[0];
    }
  }

  minuteValue(filter) {
    const time = this.searchValue(filter);
    return time ? Math.floor(time / 60) : 0;
  }

  secondValue(filter) {
    const time = this.searchValue(filter);
    return time ? time % 60 : 0;
  }

  isControlDisabled(filter) {
    return !filter.operator || this.requiresNoValue(filter.operator) ? "disabled" : "";
  }

  addFilter(groupId) {
    const filters = this.getFilters(groupId);
    if (filters) {
      const column = this.columns.find(column => !filters.map(filter => filter.column.id).includes(column.id));
      const newId = nextId(filters.map(filter => filter.id));
      const type = this.getType(column);
      if (this.columns.length > filters.length) {
        filters.push({
          _id: `${newId}`,
          id: newId,
          column,
          type,
          operator: this.getOperators(type)[0]
        });
        this.setFilters(groupId, filters);
        this.getOptions(groupId, newId);
      }
    }
  }

  formatOptions(options) {
    return options.map((o) => {
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
  }

  hasOptions(filter) {
    return filter.options && filter.options.length;
  }

  getOptions(groupId, id) {
    const filter = this.getFilter(groupId, id);
    if(filter) {

      const optionsCallback = (options) => {
        const filter = this.getFilter(groupId, id);
        filter.options = this.formatOptions(options);
        if(filter.options.length > 0) {
          filter.type = Array;
        } else if(filter.type === Array) {
          filter.type = String;
        }
        this.setFilter(groupId, id, filter);
      }

      const options = filter.column.filterModal.options;
      const initSearch = filter.selectedOptions &&
        !_.isArray(filter.selectedOptions) &&
        filter.selectedOptions.length ? filter.selectedOptions : undefined;

      if(_.isFunction(options)) {
        const result = options(filter, initSearch, asyncOptions => optionsCallback(asyncOptions));
        if(result instanceof Promise) {
          result.then(asyncOptions => optionsCallback(asyncOptions));
        } else if(result) {
          optionsCallback(result);
        }
      } else if(_.isArray(options)) {
        optionsCallback(options);
      }
    }
  }

  updateColumn(groupId, id, columnId) {
    const filter = this.getFilter(groupId, id);
    if (filter) {
      filter.column = this.columns.find(val => val.id === columnId);
      filter.type = this.getType(filter.column)
      delete filter.options
      this.setFilter(groupId, id, filter);
      this.getOptions(groupId, id);
    }
  }

  requiresNoValue(operator) {
    return _.contains([opMap.empty, opMap.notEmpty], operator);
  }

  updateOperator(groupId, id, operatorId) {
    const filter = this.getFilter(groupId, id);
    if (filter) {
      filter.operator = opMap[operatorId];
      if(this.requiresNoValue(filter.operator)) {
        filter.selectedOptions = [];
      }
      this.setFilter(groupId, id, filter)
    }
  }

  updateFilter(groupId, id, selectedOptions) {
    const filter = this.getFilter(groupId, id);
    if (filter) {
      filter.selectedOptions = selectedOptions.map(option => {
        if(filter.options) {
          const currentOption = filter.options.find(item => item.label === option);
          return currentOption && currentOption.value && currentOption.value.toString();
        }
      });
        
    }
  }
  
  removeFilter(groupId, id) {
    const filters = this.getFilters(groupId);
    if (filters) {
      filters.splice(filters.findIndex(filter => filter.id === id), 1);
      this.setFilters(groupId, filters);
      if (!filters.length) {
        this.removeFilterGroup(groupId);
      }
    }
  }

  getFiltersData(groupId) {
    const filters = this.getFilters(groupId);
    if (filters) {
      const usedColumns = filters.filter(filter => filter.column.id).map(filter => filter.column.id);
      return filters.map(filter => _.extend({}, filter, {
        columns: this.columns.filter(column => !usedColumns.includes(column.id) || column.id === filter.column.id)
      }));
    }
  }

  getType(column) {
    const name = (column.filterModal && column.filterModal.field && column.filterModal.field.name) || column.data;
    const obj = this.collection._c2 && this.collection._c2._simpleSchema && this.collection._c2._simpleSchema.schema(name);
    let type = (obj && obj.type) || String;
    if(_.isArray(type.choices)) {
      type = typeMap.flatMap(val => val.type).find(val => type.choices.includes(val));
    }
    return type;
  }

  getOperators(type) {
    return typeMap.find(value => [].concat(value.type).includes(type)).operators;
  }

  getOperatorOptions(groupId, id) {
    const filter = this.getFilter(groupId, id);
    if(filter) {
      const opList = this.getOperators(filter.type);
      if(opList) {
        return opList ? opList.map(operator => ({
          option: operator.label,
          value: operator.id,
          isSelected: operator === filter.operator
        })) : [];
      }
    }
    return [];
  }

  getFilters(groupId) {
    const filterGroups = this.filterGroups.get().find(val => val.id === groupId);
    return filterGroups && filterGroups.filters;
  }

  getFilter(groupId, id) {
    const filters = this.getFilters(groupId);
    return filters && filters.find(val => val.id === id);
  }

  setFilters(groupId, filters) {
    const filterGroups = this.filterGroups.get();
    const groupIndex = filterGroups.findIndex(val => val.id === groupId);
    filterGroups[groupIndex].filters = filters;
    this.filterGroups.set(filterGroups);
  }

  setFilter(groupId, id, filter) {
    const filterGroups = this.filterGroups.get();
    const groupIndex = filterGroups.findIndex(val => val.id === groupId);
    const filterIndex = filterGroups[groupIndex].filters.findIndex(val => val.id === id);
    filterGroups[groupIndex].filters[filterIndex] = filter;
    this.filterGroups.set(filterGroups);
  }

  canAddFilters(groupId) {
    const filters = this.getFilters(groupId);
    return filters && this.columns.length > filters.length;
  }

  getFilterGroups() {
    return this.filterGroups.get();
  }

  hasFilterGroups() {
    return this.filterGroups.get().length;
  }

  requiresDelimiter(items, id) {
    return items.findIndex(val => val.id === id) < items.length - 1;
  }

  addFilterGroup() {
    const filterGroups = this.filterGroups.get();
    const newId = nextId(filterGroups.map(val => val.id));
    this.filterGroups.set([...filterGroups, {
      id: newId,
      _id: `${newId}`,
      filters: []
    }]);
    this.addFilter(newId);
  }

  removeFilterGroup(groupId) {
    const filterGroups = this.filterGroups.get();
    filterGroups.splice(filterGroups.findIndex(filterGroup => filterGroup.id === groupId), 1);
    this.filterGroups.set(filterGroups);
  }

  updateSelect2Components() {
    const filterGroups = this.filterGroups.get();
    const components = $(".dynamic-table-filters-select2");
    if(components.length == filterGroups.flatMap(filterGroup => filterGroup.filters)
      .filter(filter => filter.options && filter.options.length).length) {
        [...components].forEach(val => {
          const component = $(val);
          const filter = this.getFilter(...jQueryData(component, "group", "id"));
          const options = component.data("options");
          if(!arraysEqual(filter.options, options)) {
            component.empty().select2({
              placeholder: "Search...",
              data: filter.options.map(option => ({
                text: option.label,
                id: option.label
              }))
            });
            component.data("options", filter.options);
          }
          const selectedOptions = component.val();
          if(!this.isControlDisabled(filter)) {
            if(!arraysEqual(selectedOptions, filter.selectedOptions)) {
              component.val(filter.selectedOptions);
              component.trigger("change");
            }
          } else {
            component.val(null);
            component.trigger("change");
          }
        });
    } else {
      Meteor.defer(() => this.updateSelect2Components());
    }
  }

  updateInputComponents() {
    const components = $("input.dynamic-table-filters-search");
    if(components.length) {
      [...components].forEach(val => {
        const component = $(val);
        const filter = this.getFilter(...jQueryData(component, "group", "id"));
        if(filter && (!filter.selectedOptions || !filter.selectedOptions.length)) {
          component.val("");
          component.trigger("change");
        }
      });
    }
  }

  rendered() {
    this.autorun(() => {
      this.filterGroups.get();
      this.updateSelect2Components();
      this.updateInputComponents();
    });
  }

  init() {
    this.filterGroups = new ReactiveVar([]);
    this.autorun(() => {
      const { columns, collection } = this.nonReactiveData("columns", "collection");
      this.columns = columns.filter(column => column && column.filterModal).map(column => {
        column.id = column.id || column.name;
        return column;
      });
      this.collection = collection;
    });
  }
}
BlazeComponent.register(Template.dynamicTableFiltersModal, FiltersModal);
