import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { EJSON } from "meteor/ejson";

import "./filterSelector.html";
import "./filterSelector.css";

export class FilterSelector extends BlazeComponent {
  static HelperMap() {
    return [
      "curColumns",
      "getFilter",
      "getField",
      "callback"
    ];
  }

  static EventMap() {
    return {
      "change .input-dynamic-table-column": "handleColumnChange",
      "click .btn-remove": "handleRemoveClick"
    }
  }

  handleColumnChange(e) {
    const updateColumnCallback = this.updateColumnCallback.get();
    const columnId = $(e.currentTarget).val();
    this.column.set(this.columns.get().find(val => val.id === columnId));
    if(_.isFunction(updateColumnCallback)) {
      updateColumnCallback(this.id.get(), columnId);
    }
  }

  getFilter() {
    const column = this.column.get();
    return {
        enabled: column.filter && typeof column.filter.enabled === "boolean" ? column.filter.enabled : true,
        search: {
          enabled: true
        },
        options: column.filterModal.options,
        selectedOptions: [],
        operator: {
          enabled: true,
          selected: "$in"
        }
      }
  }

  getField() {
    const column = this.column.get();
    const collection = this.collection.get();
    const name = (column.filterModal.field && column.filterModal.field.name) || column.data;
    const obj = collection._c2 && collection._c2._simpleSchema && collection._c2._simpleSchema.schema(name);
    let type = (obj && obj.type) || String;
    return _.extend({
      name,
      type,
      required: column.required,
      label: column.title || column.id
    }, column.filterModal.field || {})
  }

  curColumns() {
    return this.columns.get();
  }

  handleRemoveClick() {
    const removeFilterCallback = this.removeFilterCallback.get();
    const id = this.id.get();
    if(_.isFunction(removeFilterCallback)) {
      removeFilterCallback(id);
    }
  }

  updateFilter(...args) {
    const updateFilterCallback = this.updateFilterCallback.get();
    if(_.isFunction(updateFilterCallback)) {
      updateFilterCallback(this.id.get(), ...args);
    }
  }

  callback() {
    return (...args) => this.updateFilter(...args);
  }

  init() {
    this.allColumns = new ReactiveVar([]);
    this.columns = new ReactiveVar([]);
    this.column = new ReactiveVar(null);
    this.collection = new ReactiveVar(null);
    this.id = new ReactiveVar(null);
    this.updateFilterCallback = new ReactiveVar(null);
    this.updateColumnCallback = new ReactiveVar(null);
    this.removeFilterCallback = new ReactiveVar(null);
    this.columnId = new ReactiveVar(null);

    this.autorun(() => {
      const data = this.nonReactiveData();
      this.allColumns.set(data.columns);
      this.collection.set(data.collection);
      this.updateFilterCallback.set(data.updateFilterCallback);
      this.updateColumnCallback.set(data.updateColumnCallback);
      this.removeFilterCallback .set(data.removeFilterCallback);
    });

    this.autorun(() => {
      const filter = this.reactiveData().filter;
      
      this.id.set(filter.id);
      this.columns.set(this.allColumns.get().filter(column => 
        column && column.filterModal && (
          !filter.usedColumns.includes(column.id) || column.id === filter.columnId)
        ).map((column, i) => {
          column.isSelected = column.id === filter.columnId;
          if(column.isSelected) {
            this.column.set(column);
          }
          return column;
      }));
    });
  }
}
BlazeComponent.register(Template.dynamicTableFilterSelector, FilterSelector);
