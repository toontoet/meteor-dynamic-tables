import { BlazeComponent } from "meteor/znewsham:blaze-component";

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
      "updateColumnCallback"
    ];
  }

  static EventMap() {
    return {
      "click .add-filter": "addFilter"
    }
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

  addFilter() {
    const useableFilters = this.columns.get().filter(column => column && column.filterModal);
    const filters = this.filters.get();
    if(useableFilters.length > filters.length) {
      this.filters.set([...filters, { 
        id: this.filterIndex(filters.map(filter => filter.id)),
        columnId: useableFilters.filter(filter => !filters.map(filter => filter.columnId).includes(filter.id))[0].id
      }]);
    }
  }

  filterIndex(values) {
    let found = false;
    let i = 0;
    while(!found) {
      if(!values.includes(i)) {
        found = true;
      }
      if(!found) {
        i++;
      }
    }
    console.log(i);
    return i;
  };

  updateColumn(id, columnId) {
    const filters = this.filters.get();
    const filter = filters.find(filter => filter.id === id);
    filter.columnId = columnId;
    this.filters.set(filters);
  }

  updateFilter(id, ...args) {
    const filters = this.filters.get();
    const filter = filters.find(filter => filter.id === id);
    console.log(filter, ...args);
  }

  removeFilter(id) {
    const filters = this.filters.get();
    filters.splice(filters.findIndex(filter => filter.id === id), 1);
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
    this.filters = new ReactiveVar([]);
    this.collection = new ReactiveVar(null);
    this.columns = new ReactiveVar([]);
    this.autorun(() => {
      const data = this.reactiveData();
      this.columns.set(data.columns);
      this.collection.set(data.collection);
    });
  }
}
BlazeComponent.register(Template.dynamicTableFilterGroup, FilterGroup);
