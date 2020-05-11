import { BlazeComponent } from "meteor/znewsham:blaze-component";

import "../filterSelector/filterSelector.js";

import "./filterGroup.html";
import "./filterGroup.css";

export class FilterGroup extends BlazeComponent {
  static HelperMap() {
    return [
      "getColumns",
      "getCollection",
      "getFilters",
      "removeFilter"
    ];
  }

  static EventMap() {
    return {
      "click .add-filter": "addFilter"
    }
  }

  getFilters() {
    return this.filters.get();
  }

  getColumns() {
    return this.columns.get();
  }

  getCollection() {
    return this.collection.get();
  }

  addFilter() {
    const filters = this.filters.get();
    this.filters.set([...filters, {index: filters.length}]);
  }

  removeFilter() {
    const self = this;
    return index => {
      const filters = self.filters.get();
      filters.splice(index, 1);
      self.filters.set(filters);
    }
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
