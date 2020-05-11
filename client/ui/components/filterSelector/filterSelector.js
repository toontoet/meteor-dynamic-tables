import { BlazeComponent } from "meteor/znewsham:blaze-component";

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
      "change .input-dynamic-table-column": "updateColumn"
    }
  }

  updateColumn(e) {
    this.column.set(this.columns.get().find(val => val.id === $(e.currentTarget).val()));
  }

  getFilter() {
    return {
        enabled: true,
        search: {
          enabled: true
        },
        options: this.column.get().filterModal.options,
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
    if(type.choices) {
      type = type.choices.indexOf(String) !== -1 || !type.choices.length ? String : type.choices[0];
    }
    debugger;
    return _.extend({
      name,
      type,
      required: column.required,
      label: column.title
    }, column.filterModal.field || {})
  }

  curColumns() {
    return this.columns.get();
  }

  init() {
    this.columns = new ReactiveVar([]);
    this.column = new ReactiveVar(null);
    this.collection = new ReactiveVar(null);
    this.autorun(() => {
      const data = this.reactiveData();
      this.collection.set(data.collection);
      this.columns.set(data.columns
        .filter(column => column.filterModal && column.filterModal.options).map((column, i) => {
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
