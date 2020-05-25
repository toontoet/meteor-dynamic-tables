import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { nextId, jQueryData, arraysEqual } from "../../helpers.js";
import { changed } from "../../../inlineSave.js";

import "./filtersModal.html";
import "./filtersModal.css";

const opMap = {
  all: {
    id: "all",
    label: "is...",
    operators: ["$all"]
  },
  notAll: {
    id: "notAll",
    label: "is not...",
    operators: ["$not", "$all"]
  },
  in: {
    id: "in",
    label: "is any of...",
    operators: ["$in"]
  },
  notIn: {
    id: "notIn",
    label: "is none of...",
    operators: ["$nin"]
  },
  empty: {
    id: "empty",
    label: "is empty",
    operators: ["$not", "$exists"]
  },
  notEmpty: {
    id: "notEmpty",
    label: "is not empty",
    operators: ["$exists"]
  },
  equals: {
    id: "equals",
    label: "=",
    operators: ["$eq"],
    singleValue: true
  },
  notEquals: {
    id: "notEquals",
    label: "≠",
    operators: ["$ne"],
    singleValue: true
  },
  greaterThan: {
    id: "greaterThan",
    label: ">",
    operators: ["$gt"],
    singleValue: true
  },
  lessThan: {
    id: "lessThan",
    label: "<",
    operators: ["$lt"],
    singleValue: true
  },
  lessThanEqual: {
    id: "lessThanEqual",
    label: "≤",
    operators: ["$lte"],
    singleValue: true
  },
  greaterThanEqual: {
    id: "greaterThanEqual",
    label: "≥",
    operators: ["$gte"],
    singleValue: true
  },
  isBefore: {
    id: "isBefore",
    label: "is before...",
    operators: ["$lt"],
    singleValue: true
  },
  isAfter: {
    id: "isAfter",
    label: "is after...",
    operators: ["$gt"],
    singleValue: true
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
      opMap.isBefore,
      opMap.isAfter,
      opMap.empty,
      opMap.notEmpty
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
    const filterGroups = this.filterGroups.get();
    filterGroups.forEach(filterGroup => {
      filterGroup.filters.forEach(filter => {
        filter.query = this.toQuery(filter.operator, filter.selectedOptions);
        if(filter.column.search) {
          const toExtend = {};
          if(filter.column.searchOptions) {
            toExtend.$options = filter.column.searchOptions;
          }
          filter.query = filter.column.search(_.extend({}, filter.query, toExtend), false);
        } else {
          const field = (filter.column.filterModal && filter.column.filterModal.field && filter.column.filterModal.field.name) || filter.column.data;
          filter.query = {[field]: filter.query};
        }
      });
    });
    let newFilter = {
      $or: filterGroups.filter(filterGroup => filterGroup.filters && filterGroup.filters.length).map(filterGroup => {
        return filterGroup.filters.length == 1 && filterGroups.length == 1 ? filterGroup.filters[0].query : {
          $and: filterGroup.filters.map(filter => filter.query)
        };
      })
    };

    // Original format for filtering.
    if(newFilter.$or.length <= 1) {
      newFilter = newFilter.$or[0] || {};
    }

    this.triggerUpdateFilter(newFilter);
    $("#dynamicTableFiltersModal").modal("hide");
  }

  loadQuery(query) {

    // Original format for filtering.
    if(!query.$or && !query.$and) {
      query = {
        $or: [{
          $and: [query]
        }]
      }
    } else if(!query.$or) {
      query = {
        $or: [query]
      }
    }

    const filterGroups = [];

    query.$or.forEach(queryOrGroup => {
      if(queryOrGroup.$and) {
        const filters = [];
        queryOrGroup.$and.forEach(query => {
          newFilter = this.fromQuery(query);
          if(newFilter) {
            filters.push(newFilter);
          }
        });
        if(filters.length) {
          filterGroups.push(filters);
        }
      }
    });

    const sequencePromises = (items, promiseFunc, i = 0) => {
      if(i < items.length) {
        promiseFunc(items[i]).then(() => sequencePromises(items, val => promiseFunc(val), i+1));
      }
    }

    sequencePromises(filterGroups, val => this.addFilterGroup(val));
  }

  toQuery(operator, options) {
    query = {};
    let currentItem = query;
    let index;
    let value = options;
    if(this.requiresNoValue(operator)) {
      value = true;
    }
    if(operator.singleValue) {
      value = value[0] || "";
    }
    operator.operators.forEach((val, i) => {
      currentItem[val] = i == operator.operators.length - 1 ? value : {};
      currentItem = currentItem[val];
    });
    return query;
  }

  fromQuery(query) {
    let item = this.getFirstKey(query);
    if(item) {
      query = item.value;

      const columnId = item.key;

      let collecting = true;
      const operators = [];

      while(collecting) {
        item = this.getFirstKey(query);
        if(item && this.isAnOperator(item.key)) {
          operators.push(item.key);
          query = item.value;
        } else {
          collecting = false;
        }
      }

      const column = this.columns.find(val => val.data === columnId || 
        (val.filterModal && val.filterModal.field && val.filterModal.field.name === columnId));
      const selectedOptions = [].concat(query);

      if(column) {
        const possibleOperators = this.getOperators(this.getType(column));
        if(possibleOperators) {
          const operator = possibleOperators.find(val => arraysEqual(val.operators, operators));
          return {
            column,
            operator,
            operators,
            selectedOptions
          }
        }
      }
    }
  }

  isAnOperator(key) {
    return _.contains(Object.keys(opMap).flatMap(val => opMap[val].operators), key);
  }

  getFirstKey(item) {
    const keys = Object.keys(item);
    if(keys && keys.length) {
      return {
        key: keys[0],
        value: item[keys[0]]
      }
    }
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

  createFilter(id, column, type, operator, selectedOptions, operators) {
    return {
      _id: `${id}`,
      id: id,
      column,
      type,
      operator,
      selectedOptions,
      operators
    };
  }

  addFilter(groupId) {
    const filters = this.getFilters(groupId);
    if (filters) {
      column = this.columns.find(column => !filters.map(filter => filter.column.data).includes(column.data));
      const newId = nextId(filters.map(filter => filter.id));
      const type = this.getType(column);
      if (this.columns.length > filters.length) {
        const filter = this.createFilter(newId, column, type, this.getOperators(type)[0]);
        this.getOptions(filter).then(filterWithOptions => {
          filters.push(filterWithOptions);
          this.setFilters(groupId, filters);
        });
      }
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

  getOptions(filter) {
    return new Promise(resolve => {
      if(filter) {
        delete filter.options
        const optionsCallback = (options) => {
          filter.options = this.formatOptions(options);
          if(filter.options.length > 0) {
            filter.type = Array;

            // Selected options could be loaded in as values so adjust if needed.
            if(filter.selectedOptions && filter.selectedOptions.length) {
              filter.selectedOptions = filter.selectedOptions.map(option => {
                const selected = filter.options.find(val => val.value === option || val.label === option)
                return (selected && selected.label) || option;
              });
            }

            // Possible for options to affect possible operators so update those
            if(filter.operators) {
              filter.operator = this.getOperators(filter.type).find(val => arraysEqual(val.operators, filter.operators))
            }
          }
          resolve(filter);
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
        } else {
          resolve(filter);
        }
      }
    });
  }

  updateColumn(groupId, id, columnId) {
    const filter = this.getFilter(groupId, id);
    if (filter && filter.column.data !== columnId) {
      filter.column = this.columns.find(val => val.data === columnId);
      filter.type = this.getType(filter.column);
      this.getOptions(filter).then(filterWithOptions => this.setFilter(groupId, id, filterWithOptions));
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
          return currentOption && currentOption.value;
        }
        return option;
      });
    }
  }

  getFiltersData(groupId) {
    const filters = this.getFilters(groupId);
    if (filters) {
      const usedColumns = filters.filter(filter => filter.column.data).map(filter => filter.column.data);
      return filters.map(filter => _.extend({}, filter, {
        columns: this.columns.filter(column => !usedColumns.includes(column.data) || column.data === filter.column.data)
      }));
    }
  }

  getType(column) {
    if(column.isArray) {
      return Array;
    }
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

  addFilterGroup(filters) {
    return new Promise(resolve => {
      const filterGroups = this.filterGroups.get();
      const newId = nextId(filterGroups.map(val => val.id));
      const filterGroup = {
        id: newId,
        _id: `${newId}`,
        filters: []
      };
      if(!filters) {
        this.filterGroups.set([...filterGroups, filterGroup]);
        this.addFilter(newId);
        resolve();
      } else {
        const promises = [];
        filters.forEach((filter, i) => {
          promises.push(this.getOptions(this.createFilter(
            i, filter.column, 
            this.getType(filter.column), 
            filter.operator, filter.selectedOptions,
            filter.operators
          )));
        });
        Promise.all(promises).then(filters => {
          filterGroup.filters = filters;
          this.filterGroups.set([...filterGroups, filterGroup]);
          resolve();
        });
      }
    });
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
    
    const { columns, collection, triggerUpdateFilter, filter } = this.nonReactiveData("columns", "collection", "triggerUpdateFilter", "filter");

    this.columns = columns.filter(column => column && column.filterModal);
    this.collection = collection;
    this.triggerUpdateFilter = triggerUpdateFilter;

    this.loadQuery(filter);
  }
}
BlazeComponent.register(Template.dynamicTableFiltersModal, FiltersModal);
