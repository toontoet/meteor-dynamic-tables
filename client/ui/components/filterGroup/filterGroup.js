import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { nextId } from "../../helpers.js";

import "../filterSelector/filterSelector.js";

import "./filterGroup.html";
import "./filterGroup.css";

export class FilterGroup extends BlazeComponent {
  static HelperMap() {
    return [
      "getFilters",
      "getColumns",
      "getCollection",
      "updateFilterCallback",
      "removeFilterCallback",
      "updateColumnCallback",
      "requiresDelimiter",
      "canAddFilters"
    ];
  }

  static EventMap() {
    return {
      "click .dynamic-table-filter-group-add-filter": "handleAddFilterClick"
    }
  }

  handleAddFilterClick() {
    this.addFilter();
  }

  getColumns() {
    return this.columns.get();
  }

  getCollection() {
    return this.collection.get();
  }

  getFilters() {
    const filters = this.filters.get();
    const columns = this.columns.get();
    const usedColumns = filters.filter(filter => filter.columnId).map(filter => filter.columnId);
    return filters.map(filter => _.extend({}, filter, {
      usedColumns
    }))
  }

  requiresDelimiter(filter) {
    const filters = this.filters.get();
    return filters.findIndex(val => val.id === filter.id) < filters.length - 1;
  }

  addFilter() {
    const useableFilters = this.useableFilters();
    const filters = this.filters.get();
    if(useableFilters.length > filters.length) {
      this.filters.set([...filters, { 
        id: nextId(filters.map(filter => filter.id)),
        columnId: useableFilters.filter(filter => !filters.map(filter => filter.columnId).includes(filter.id))[0].id
      }]);
    }
  }

  useableFilters() {
    return this.columns.get().filter(column => column && column.filterModal);
  }

  canAddFilters() {
    const useableFilters = this.useableFilters();
    const filters = this.filters.get();
    return useableFilters.length > filters.length;
  }

  updateColumn(id, columnId) {
    const filters = this.filters.get();
    const filter = filters.find(filter => filter.id === id);
    filter.columnId = columnId;
    this.filters.set(filters);
  }

  updateFilter(id, selectedOptions, operator) {
    const filters = this.filters.get();
    const filter = filters.find(filter => filter.id === id);
    filter.selectedOptions = selectedOptions;
    filter.operator = operator;
    this.filters.set(filters);
  }

  removeFilter(id) {
    const removeFilterGroupCallback = this.removeFilterGroupCallback.get();
    const filters = this.filters.get();
    filters.splice(filters.findIndex(filter => filter.id === id), 1);
    if(_.isFunction(removeFilterGroupCallback) && !filters.length) {
      removeFilterGroupCallback(this.id.get());
    }
    this.filters.set(filters);
  }

  updateFilterCallback() {
    return (id, ...args) => this.updateFilter(id, ...args);
  }

  updateColumnCallback() {
    return (id, columnId) => this.updateColumn(id, columnId);
  }

  removeFilterCallback() {
    return (id) => this.removeFilter(id);
  }

  init() {
    this.id = new ReactiveVar(null);
    this.filters = new ReactiveVar([]);
    this.updatedFilters = new ReactiveVar([]);
    this.collection = new ReactiveVar(null);
    this.columns = new ReactiveVar([]);
    this.removeFilterGroupCallback = new ReactiveVar(null);
    this.firstRun = true;
    this.autorun(() => {
      const data = this.reactiveData();
      this.id.set(data.id);
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
