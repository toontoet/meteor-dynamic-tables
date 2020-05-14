import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { nextId } from "../../helpers.js";

import "../filterSelector/filterSelector.js";

import "./filterGroup.html";
import "./filterGroup.css";

export class FilterGroup extends BlazeComponent {
  static HelperMap() {
    return [
      "getFilters",
      "getFilter",
      "requiresDelimiter",
      "canAddFilters",
      "getField",
      "callback",
      "isSelected"
    ];
  }

  static EventMap() {
    return {
      "click .dynamic-table-filter-group-add-filter": "handleAddFilterClick",
      "click .dynamic-table-filter-group-remove-filter": "handleRemoveFilterClick",
      "change .dynamic-table-filter-group-column": "handleColumnChange"
    }
  }

  handleAddFilterClick() {
    this.addFilter();
  }

  handleRemoveFilterClick(e) {
    this.removeFilter($(e.currentTarget).data("id"));
  }

  handleColumnChange(e) {
    this.updateColumn($(e.currentTarget).data("id"), $(e.currentTarget).val());
  }

  isSelected(column, filter) {
    return column.id === filter.columnId;
  }

  getFilters() {
    const filters = Tracker.guard(() => this.filters.get());
    const columns = this.useableColumns();
    const usedColumns = filters.filter(filter => filter.columnId).map(filter => filter.columnId);
    return filters.map(filter => _.extend({}, filter, {
      columns: columns.filter(column => !usedColumns.includes(column.id) || column.id === filter.columnId)
    }))
  }

  getFilter(filter) {
    const column = this.columns.get().find(column => column.id === filter.columnId);
    return {
        enabled: column.filter && typeof column.filter.enabled === "boolean" ? column.filter.enabled : true,
        search: {
          enabled: true
        },
        options: column.filterModal.options,
        selectedOptions: filter.selectedOptions,
        operator: {
          enabled: true,
          selected: filter.operator
        }
      }
  }

  requiresDelimiter(filter) {
    const filters = this.filters.get();
    return filters.findIndex(val => val.id === filter.id) < filters.length - 1;
  }

  addFilter() {
    const useableColumns = this.useableColumns();
    const filters = this.filters.get();
    const newId = nextId(filters.map(filter => filter.id));
    if(useableColumns.length > filters.length) {
      this.filters.set([...filters, { 
        _id: `${newId}`,
        id: newId,
        columnId: useableColumns.filter(column => !filters.map(filter => filter.columnId).includes(column.id))[0].id
      }]);
    }
  }

  useableColumns() {
    return this.columns.get().filter(column => column && column.filterModal);
  }

  canAddFilters() {
    const useableColumns = this.useableColumns();
    const filters = this.filters.get();
    return useableColumns.length > filters.length;
  }

  updateColumn(id, columnId) {
    const filters = this.filters.get();
    const filter = filters.find(val => val.id === id);
    filter.columnId = columnId;
    this.filters.set(filters);
  }

  removeFilter(id) {
    const removeFilterGroupCallback = this.removeFilterGroupCallback.get();
    const filters = this.filters.get();
    filters.splice(filters.findIndex(filter => filter.id === id), 1);
    if(_.isFunction(removeFilterGroupCallback) && !filters.length) {
      removeFilterGroupCallback(this.id);
    }
    this.filters.set(filters);
  }

  getField(filter) {
    const column = this.columns.get().find(column => column.id === filter.columnId);
    const collection = this.collection.get();
    const name = (column.filterModal.field && column.filterModal.field.name) || column.data;
    const obj = collection._c2 && collection._c2._simpleSchema && collection._c2._simpleSchema.schema(name);
    let type = (obj && obj.type) || String;
    return _.extend({
      name,
      type,
      required: column.required,
      label: column.title || column.id
    }, column.filterModal.field || {});
  }

  updateFilter(id, selectedOptions, operator, direction, sort, originalOperator) {
    const filters = this.filters.get();
    const filter = filters.find(val => val.id === id);
    if(!_.isEqual(filter.selectedOptions, selectedOptions) || filter.operator !== operator) {
      filter.selectedOptions = selectedOptions;
      filter.operator = originalOperator;
      self.filters.set(filters);
    }
  }

  callback(id) {
    return () => (...args) => this.updateFilter(id, ...args)
  }

  init() {
    this.filters = new ReactiveVar([]);
    this.updatedFilters = new ReactiveVar([]);
    this.collection = new ReactiveVar(null);
    this.columns = new ReactiveVar([]);
    this.removeFilterGroupCallback = new ReactiveVar(null);
    this.firstRun = true;
    this.autorun(() => {
      const data = this.nonReactiveData();
      this.id = data.id;
      this.columns.set(data.columns);
      this.collection.set(data.collection);
      this.removeFilterGroupCallback.set(data.removeFilterGroupCallback);

      if(this.firstRun) {
        this.firstRun = false;
        this.addFilter();
      }
    });
  }
}
BlazeComponent.register(Template.dynamicTableFilterGroup, FilterGroup);
