import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { nextId } from "../../helpers.js";

import "./filtersModal.html";
import "./filtersModal.css";

export class FiltersModal extends BlazeComponent {
  static HelperMap() {
    return [
      "getFilterGroups",
      "getColumns",
      "getCollection",
      "hasFilterGroups",
      "removeFilterGroupCallback",
      "requiresDelimiter"
    ];
  }

  static EventMap() {
    return {
      "click .dynamic-table-filters-add-filter-group": "handleAddFilterGroupClick",
      "click .dynamic-table-filters-clear": "handleClearClick",
      "click .dynamic-table-filters-apply": "handleApplyClick",
      "click .dynamic-table-filters-cancel": "handleCancelClick"
    }
  }

  getFilterGroups() {
    return this.filterGroups.get();
  }

  handleAddFilterGroupClick() {
    this.addFilterGroup();
  }

  handleClearClick() {
    this.filterGroups.set([]);
  }

  handleCancelClick() {
    this.hideModal();
  }

  handleApplyClick() {
    
  }

  hideModal() {
    this.$("#dynamicTableFiltersModal").modal("hide");
  }

  getColumns() {
    return this.columns.get();
  }

  getCollection() {
    return this.collection.get();
  }

  hasFilterGroups() {
    return this.filterGroups.get().length
  }
  
  requiresDelimiter(filterGroup) {
    const filterGroups = this.filterGroups.get();
    return filterGroups.findIndex(val => val.id === filterGroup.id) < filterGroups.length - 1;
  }

  addFilterGroup() {
    const filterGroups = this.filterGroups.get();
    this.filterGroups.set([...filterGroups, { 
      id: nextId(filterGroups.map(filter => filter.id))
    }]);
    console.log(filterGroups);
  }

  removeFilterGroup(id) {
    const filterGroups = this.filterGroups.get();
    filterGroups.splice(filterGroups.findIndex(filterGroup => filterGroup.id === id), 1);
    this.filterGroups.set(filterGroups);
  }

  removeFilterGroupCallback() {
    return (id) => this.removeFilterGroup(id);
  }

  init() {
    this.filterGroups = new ReactiveVar([]);
    this.columns = new ReactiveVar([]);
    this.collection = new ReactiveVar(null);
    this.advancedSearch = new ReactiveVar(null);
    this.autorun(() => {
      const data = this.reactiveData();
      this.columns.set(data.columns);
      this.collection.set(data.collection);
      this.advancedSearch.set(data.advancedSearch);
    });
  }
}
BlazeComponent.register(Template.dynamicTableFiltersModal, FiltersModal);
