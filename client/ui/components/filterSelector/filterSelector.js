import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { EJSON } from "meteor/ejson";

import "./filterSelector.html";
import "./filterSelector.css";

export class FilterSelector extends BlazeComponent {
  static HelperMap() {
    return [
      "curColumns",
      "getFilter",
      "getField"
    ];
  }

  static EventMap() {
    return {
      "change .input-dynamic-table-column": "updateColumn",
      "click .btn-remove": "handleRemoveClick"
    }
  }

  updateColumn(e) {
    this.column.set(this.columns.get().find(val => val.id === $(e.currentTarget).val()));
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
    const removeCallback = this.removeCallback.get();
    const id = this.id.get();
    if(_.isFunction(removeCallback)) {
      removeCallback(id);
    }
  }

  init() {
    this.columns = new ReactiveVar([]);
    this.column = new ReactiveVar(null);
    this.collection = new ReactiveVar(null);
    this.id = new ReactiveVar(null);
    this.removeCallback = new ReactiveVar(null);

    this.autorun(() => {
      const data = this.reactiveData();
      this.collection.set(data.collection);
      this.removeCallback.set(data.removeCallback);
      this.id.set(data.id);
      this.columns.set(data.columns.filter(column => column.filterModal).map((column, i) => {
        column.isSelected = !i;
        if(column.isSelected) {
          this.column.set(column);
        }
        return column;
      }));
    })
  }
}
BlazeComponent.register(Template.dynamicTableFilterSelector, FilterSelector);
