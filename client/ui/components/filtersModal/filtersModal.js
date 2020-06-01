import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { nextId, jQueryData, arraysEqual, formatQuery, getColumnFields } from "../../helpers.js";
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
  },
  contains: {
    id: "contains",
    label: "is...",
    operators: ["$regex"]
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
      opMap.contains,
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
      "canAddFilterGroups",
      "getFiltersData",
      "getOperatorOptions",
      "hasOptions",
      "getFilterLabel",

      "isComplexDataType",
      "isTime",
      "isNumber",
      "isDate",
      "isString",
      "isBoolean",
      "isControlDisabled",
      "isFilterDisabled",

      "dateValue",
      "minuteValue",
      "secondValue",
      "searchValue"
    ];
  }

  static EventMap() {
    return {
      "click .dynamic-table-filters-add-filter-group": "handleAddFilterGroupClick",
      "click .dynamic-table-filters-open-filters-modal": "handleOpenFiltersModalClick",
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

  handleOpenFiltersModalClick(e) {
    const filter = this.getFilter(...jQueryData(e, "group", "id"));
    if(_.isFunction(filter.triggerOpenFiltersModal)) {
      $('#dynamicTableFiltersModal').on('hidden.bs.modal', function (e) {
        $(e.currentTarget).unbind();
        filter.triggerOpenFiltersModal();
      });
      $("#dynamicTableFiltersModal").modal("hide");
    }
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
    const filterGroups = this.filterGroups.get();
    if(filterGroups.length >= 1 && filterGroups[0].filters.filter(val => val.disabled).length) {
      filterGroups[0].filters = filterGroups[0].filters.filter(val => val.disabled);
      this.filterGroups.set([filterGroups[0]]);
    } else {
      this.filterGroups.set([]);
    }
  }

  handleCancelClick() {
    $("#dynamicTableFiltersModal").modal("hide");
  }

  handleApplyClick() {
    const filterGroups = this.filterGroups.get();
    filterGroups.forEach(filterGroup => {
      filterGroup.filters.forEach(filter => {
        filter.query = this.toQuery(filter);
      });
    });
    let newFilter = {
      $or: filterGroups.filter(filterGroup => filterGroup.filters && filterGroup.filters.length).map(filterGroup => {

        // If the query has multiple fields, it should be in an $or group.
        const filters = filterGroup.filters.filter(filter => !filter.disabled)
          .map(filter => filter.query.length && filter.query.length > 1 ? {$or: filter.query} : filter.query);
        if(!filters.length) {
          return undefined;
        }

        // If there's a nested OR group for a single field, wrap it in an AND group
        // to avoid being interpreted by the filters modal as an actual OR group.
        return filters.length == 1 && !filters[0].$or ? filters[0] : {
          $and: filters
        };
      }).filter(filterGroup => filterGroup)
    };

    // Original format for filtering.
    if(newFilter.$or.length <= 1) {
      newFilter = newFilter.$or[0] || {};
    }

    this.triggerUpdateFilter(newFilter);
    $("#dynamicTableFiltersModal").modal("hide");
  }

  loadQuery(filter, parentFilters) {

    let filterGroups = [];

    // If any parent filters are present, the user can never add extra OR groups
    if(parentFilters && parentFilters.length) {
      filterGroups = this.formatQueries(filterGroups, true, ...parentFilters);

      // If there's one filter group, disable OR groups, if there's more, disable AND groups.
      if(filterGroups.length) {
        this.disableOrGroups.set(true);
      } 
      
      if(filterGroups.length > 1) {
        this.disableAndGroups.set(true);
      }
    }

    filterGroups = this.formatQueries(filterGroups || [], false, filter)

    // The final step of creating the filter groups is to resolve all the options, which is an asynchronous process.
    // Because the filter groups aren't updated until the options for all its filters are resolved, we need to make
    // sure that the promises for each filter group being created are done sequentially as the ids used for the filter
    // groups are dependant on the previous groups that were created.
    const sequencePromises = (items, promiseFunc, i = 0) => {
      if(i < items.length) {
        promiseFunc(items[i]).then(() => sequencePromises(items, val => promiseFunc(val), i+1));
      }
    }

    sequencePromises(filterGroups, val => this.addFilterGroup(val));
  }

  // Formats the queries within the filters and returns a list of filter groups and filters
  // which contain the arguments used by methods that create values used by the filters modal.
  formatQueries(filterGroups, isParent, ...filters) {

    // filterGroups is passed in here because the filters that get created can be placed in the
    // proper OR group when created. E.i. if there's multiple parent filters, all their queries will appear
    // in the first filter group.

    if(filters && filters.length) {
      filters.forEach(item => {

        // Ensures there's always an $or level and $and level.
        query = formatQuery(item.query);
        query.$or.forEach((queryAndGroup, i) => {
          if(queryAndGroup.$and.length) {
            // Format these filters into objects this modal can interpret. Sometimes, there's nested $or groups.
            // Also make sure the returned filters are unique by checking the field it's affecting.
            const filters = _.uniq(queryAndGroup.$and.flatMap(query => {
              // If a field is an OR group, (like in the case of name), we want to flatten those nested fields.
              // If it's not, we don't want any changes to the field so we can just stick the query in an array
              // and have it flattened as well.
              return query.$or ? query.$or : [query];
            }).map(query => 
              this.fromQuery(query, isParent)).filter(filter => !_.isUndefined(filter)), filter => filter.column.data);

            if(filters.length) {

              // Only set the parent filters modal link for the first filter of the first filter group.
              if(isParent && i == 0) {
                // Apply the label and callback to the first filter item so it appears once for a set of filters at the beginning.
                filters[0].label = item.label;
                filters[0].triggerOpenFiltersModal = item.triggerOpenFiltersModal;
              }
              if(!filterGroups[i]) {
                filterGroups[i] = []
              }
              filterGroups[i] = filterGroups[i].concat(filters);
            }
          }
        });
      });
    }

    return filterGroups;
  }

  toQuery(filter) {
    query = {};
    let currentItem = query;
    let index;
    let value = filter.selectedOptions;

    if(filter.operator.singleValue) {
      value = value[0] || "";
      if(filter.type === Number) {
        try {
          value = parseFloat(value);
        } catch(e) {
          // Couldn't parse as a number. This would only happen if the input control was manually changed from a number. Set it to 0.
          value = 0;
        }
      }
    }
    if(_.contains(filter.operator.operators, "$exists")) {
      value = true;
    }
    if(_.contains(filter.operator.operators, "$regex")) {
      value = `^${value[0] || ""}`;
    }

    filter.operator.operators.forEach((val, i) => {
      currentItem[val] = i == filter.operator.operators.length - 1 ? value : {};
      currentItem = currentItem[val];
    });

    if(filter.column.search) {
      const toExtend = {};
      if(filter.column.searchOptions) {
        toExtend.$options = filter.column.searchOptions;
      }
      return filter.column.search(_.extend({}, query, toExtend), false);
    } else {
      const field = (filter.column.filterModal && filter.column.filterModal.field && filter.column.filterModal.field.name) || filter.column.data;
      return {[field]: query};
    }
  }

  fromQuery(query, disabled) {
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

      // The unique identifier for distinguishing which operator is being used is a combination
      // of the order of operators and the column type. This is why "not exists" operator is a combination of $not and $exists
      // instead of just $exists: false so it's distinguishable from "exists" and it can be resolved without adding a special case
      // to check the value if the operator is $exists: true or $exists: false.
      const column = this.columns.find(val => _.contains(getColumnFields(val), columnId));
      if(_.contains(operators, "$regex")) {
        query = query.substr(1);
      }
      const selectedOptions = [].concat(query);

      if(column) {
        const possibleOperators = this.getOperators(this.getType(column));
        if(possibleOperators) {
          const operator = possibleOperators.find(val => arraysEqual(val.operators, operators));
          return {
            column,
            operator,

            // We want to keep track of the operators list (which is just the combination of values like [$not, $in] from the original query)
            // because there's cases where the type is marked as String, 
            // for example, but once the options are resolved (which can be asynchronous), it could end up
            // being an Array instead if a list of options are returned. 
            // At that point the operators list is needed to find the proper operator.
            operators,
            selectedOptions,

            // This value is used when the filter comes from a parent filter. The user would need to open the parent filters modal to change that filter's value.
            disabled
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
    return !filter.operator || _.contains(filter.operator.operators, "$exists") ? "disabled" : "";
  }

  isFilterDisabled(filter) {
    return filter.disabled ? "disabled" : "";
  }

  createFilter(id, column, type, operator, selectedOptions, operators, disabled = false, triggerOpenFiltersModal, label) {

    // Remove selected options if the filter doesn't require any selected value.
    if(_.contains(operator && operator.operators || {}, "$exists")) {
      selectedOptions = [];
    }

    return {
      _id: `${id}`,
      id: id,
      column,
      type,
      operator,
      selectedOptions,
      operators,

      // These fields are used for parent filters.
      disabled,
      triggerOpenFiltersModal,
      label
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
    const filter = filters.find(val => val.id === id);
    if (filters && !filter.disabled) {
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

            // Possible for options to affect possible operators so update those.
            if(filter.operators) {
              filter.operator = this.getOperators(filter.type).find(val => arraysEqual(val.operators, filter.operators))
            }
          }
          resolve(filter);
        }

        // There's multiple ways for the options to appear in the column, the logic below should cover every case.
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

  updateOperator(groupId, id, operatorId) {
    const filter = this.getFilter(groupId, id);
    if (filter) {
      filter.operator = opMap[operatorId];
      if(_.contains(filter.operator.operators, "$exists")) {
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

  getFilterLabel() {
    return this.label;
  }

  getFiltersData(groupId) {
    const filters = this.getFilters(groupId);
    if (filters) {
      const usedColumns = filters.filter(filter => filter.column.data).map(filter => filter.column.data);

      // Takes the original list of filters and includes a list of columns the filters can choose from.
      // This list changes as the user changes other filters, so it needs to be reactive to that.
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

  // Returns objects that the select list for options uses.
  getOperatorOptions(groupId, id) {
    const filter = this.getFilter(groupId, id);
    if(filter) {
      const opList = this.getOperators(filter.type);
      if(opList) {
        return opList ? opList.map(operator => ({
          label: operator.label,
          value: operator.id,
          isSelected: operator === filter.operator
        })) : [];
      }
    }
    return [];
  }

  // The following getFilters, getFilter, setFilters and setFilter are the only methods that make changes to
  // the filters of their filter groups
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
    return filters && this.columns.length > filters.length && !this.disableAndGroups.get();
  }

  canAddFilterGroups() {
    return !this.disableOrGroups.get();
  }

  getFilterGroups() {
    return this.filterGroups.get();
  }

  hasFilterGroups() {
    return this.filterGroups.get().length;
  }

  requiresDelimiter(items, id) {
    return items.findIndex(val => val.id === id) > 0;
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
            i, 
            filter.column, 
            this.getType(filter.column), 
            filter.operator, 
            filter.selectedOptions,
            filter.operators, 
            filter.disabled,
            filter.triggerOpenFiltersModal,
            filter.label
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
    
    // Using this method instead of the select2 template gives more control over when the select2
    // components are refreshed when the options of a specific filter change.
    const filterGroups = this.filterGroups.get();
    const components = $(".dynamic-table-filters-select2");

    // We only want to refresh the select2 components when the expected count of filters
    // using the select2 components matches the count we find from the jQuery results.
    // If this is being called, we know that the select2 components need to be refreshed,
    // but we need to wait for the page to render the components before we initialize them
    // as select2 components or else some components will get rendered after the logic below.
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
              component.val((filter.selectedOptions || []).map(option => filter.options.find(val => val.value === option || val.label === option).label));
              component.trigger("change");
            }
          } else {
            component.val(null);
            component.trigger("change");
          }
        });
    } else {

      // We know the select2 components need to be refreshed so defer and try again.
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

    // The filterGroups variable pretty much handles all reactivity for the modal.
    this.filterGroups = new ReactiveVar([]);
    this.disableOrGroups = new ReactiveVar(false);
    this.disableAndGroups = new ReactiveVar(false);
    
    const { columns, collection, triggerUpdateFilter, filter, parentFilters } = 
      this.nonReactiveData("columns", "collection", "triggerUpdateFilter", "filter", "parentFilters");

    // All of these values shouldn't change while the modal is open so they don't need to be reactive.
    this.columns = columns.filter(column => column && column.filterModal);
    this.collection = collection;
    this.triggerUpdateFilter = triggerUpdateFilter;
    this.label = filter.label;

    this.loadQuery(filter, parentFilters);
  }
}
BlazeComponent.register(Template.dynamicTableFiltersModal, FiltersModal);
