import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { nextId } from "../../helpers.js";

import "./filtersModal.html";
import "./filtersModal.css";

const actionMapping = [
  {
    type: [Array, String],
    options: [
      "is...",
      "is not...",
      "is any of...",
      "is none of...",
      "is empty",
      "is not empty"
    ]
  },
  {
    type: [Date, "time"],
    options: [
      "is...",
      "is not...",
      "is before...",
      "is after...",
      "is empty",
      "is not empty"
    ]
  },
  {
    type: Number,
    options: [
      "=",
      "≠",
      ">",
      "<",
      "≤",
      "≥",
      "is empty",
      "is not empty"
    ]
  },
  {
    type: Boolean,
    options: [
      "is...",
      "is not...",
      "is empty",
      "is not empty"
    ]
  }
];

const operatorMapping = {
  "is...": "$all",
  "is not...": "$not$all",
  "is any of...": "$in",
  "is none of...": "$nin",
  "is empty": "$not$exists",
  "is not empty": "$exists",
  "=": "$eq",
  "≠": "$ne",
  ">": "$gt",
  "<": "$lt",
  "≤": "$lte",
  "≥": "$gte",
  "is before...": "$lt",
  "is after...": "$gt"
};

export class FiltersModal extends BlazeComponent {
  static HelperMap() {
    return [
      "getFilterGroups",
      "hasFilterGroups",

      "requiresDelimiter",
      "canAddFilters",
      "getFiltersData",
      "getActions",
      "hasOptions",

      "isTime",
      "isNumber",
      "isDate",
      "isString",
      "isStringOrCustom",
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
      "change .dynamic-table-filters-column": "handleColumnChange",
      "click .dynamic-table-filters-clear": "handleClearClick",
      "click .dynamic-table-filters-apply": "handleApplyClick",
      "click .dynamic-table-filters-cancel": "handleCancelClick",
      "change .dynamic-table-filters-search": "handleSearchChange",
      "change .dynamic-table-filters-action": "handleActionChange"
    };
  }

  handleSearchChange(e) {
    let value = $(e.currentTarget).val();
    if($(e.currentTarget).hasClass("minutes") || $(e.currentTarget).hasClass("seconds")) {
      value = $(".minutes").val() * 60 + $(".seconds").val();
    }
    this.updateFilter($(e.currentTarget).data("group"), $(e.currentTarget).data("id"), [...value]);
  }

  handleActionChange(e){
    this.updateOperator($(e.currentTarget).data("group"), $(e.currentTarget).data("id"), $(e.currentTarget).val());
  }

  handleColumnChange(e) {
    this.updateColumn($(e.currentTarget).data("group"), $(e.currentTarget).data("id"), $(e.currentTarget).val());
  }

  handleAddFilterGroupClick() {
    this.addFilterGroup();
  }

  handleRemoveFilterClick(e) {
    this.removeFilter($(e.currentTarget).data("group"), $(e.currentTarget).data("id"));
  }

  handleAddFilterClick(e) {
    this.addFilter($(e.currentTarget).data("group"));
  }

  handleClearClick() {
    this.filterGroups.set([]);
  }

  handleCancelClick() {
    $("#dynamicTableFiltersModal").modal("hide");
  }

  handleApplyClick() {

  }

  isStringOrCustom(filter) {
    return filter.type === String ||
      (filter.type !== Number && filter.type !== Date && filter.type !== "time" && filter.type !== Boolean);
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
    return filter && filter.search && filter.search.value;
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
    return !filter.operator || filter.operator.indexOf("$exists") !== -1 ? "disabled" : "";
  }

  addFilter(groupId) {
    const filters = this.getFilters(groupId);
    if (filters) {
      const collection = this.collection.get();
      const columns = this.columns.get();
      const column = columns.find(column => !filters.map(filter => filter.column.id).includes(column.id));
      const type = this.getType(collection, column);
      const newId = nextId(filters.map(filter => filter.id));
      if (columns.length > filters.length) {
        filters.push({
          _id: `${newId}`,
          id: newId,
          column,
          type,
          operator: "$in"
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
      const collection = this.collection.get();
      filter.column = this.columns.get().find(val => val.id === columnId);
      filter.type = this.getType(collection, filter.column)
      delete filter.options
      this.setFilter(groupId, id, filter);
      this.getOptions(groupId, id);
    }
  }

  updateOperator(groupId, id, operator) {
    const filter = this.getFilter(groupId, id);
    if (filter) {
      filter.operator = operator;
      this.setFilter(groupId, id, filter)
    }
  }

  updateFilter(groupId, id, selectedOptions) {
    const filter = this.getFilter(groupId, id);
    if (filter) {
      filter.selectedOptions = selectedOptions;
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
      const columns = this.columns.get();
      const usedColumns = filters.filter(filter => filter.column.id).map(filter => filter.column.id);
      const collection = this.collection.get();
      return filters.map(filter => _.extend({}, filter, {
        columns: columns.filter(column => !usedColumns.includes(column.id) || column.id === filter.column.id)
      }));
    }
  }

  getType(collection, column) {
    const name = (column.filterModal.field && column.filterModal.field.name) || column.data;
    const obj = collection._c2 && collection._c2._simpleSchema && collection._c2._simpleSchema.schema(name);
    let type = (obj && obj.type) || String;
    if(_.isArray(type.choices)) {
      type = actionMapping.flatMap(action => action.type).find(val => type.choices.includes(val));
    }
    return type;
  }

  getActions(groupId, id) {
    const filter = this.getFilter(groupId, id);
    if(filter) {
      const action = actionMapping.find(value => [].concat(value.type).includes(filter.type));
      return action ? action.options.map(option => ({
        option,
        value: operatorMapping[option],
        isSelected: operatorMapping[option] === filter.operator
      })) : [];
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
    const columns = this.columns.get();
    const filters = this.getFilters(groupId);
    return filters && columns.length > filters.length;
  }

  getFilterGroups() {
    return this.filterGroups.get();
  }

  hasFilterGroups() {
    return this.filterGroups.get().length;
  }

  requiresDelimiter(collection, id) {
    return collection.findIndex(val => val.id === id) < collection.length - 1;
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

  rendered() {
    this.autorun(() => {
      const filterGroups = this.filterGroups.get();
      Meteor.defer(() => {
        const select2Components = $(".dynamic-table-filters-select2");
        if(select2Components.length) {
          [...select2Components].forEach(val => {
            const component = $(val);
            const filter = this.getFilter(component.data("group"), component.data("id"));
            const options = component.data("options");
            if(!_.isEqual(filter.options, options)) {
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
              if(!_.isEqual(selectedOptions, filter.selectedOptions)) {
                component.val(filter.selectedOptions);
                component.trigger("change");
              }
            } else {
              component.val(null);
              component.trigger("change");
            }
          });
        }
      });
    });
  }

  init() {
    this.filterGroups = new ReactiveVar([]);
    this.columns = new ReactiveVar([]);
    this.collection = new ReactiveVar(null);
    this.autorun(() => {
      const { columns, collection } = this.nonReactiveData("columns", "collection");
      this.columns.set(columns.filter(column => column && column.filterModal));
      this.collection.set(collection);
    });
  }
}
BlazeComponent.register(Template.dynamicTableFiltersModal, FiltersModal);
