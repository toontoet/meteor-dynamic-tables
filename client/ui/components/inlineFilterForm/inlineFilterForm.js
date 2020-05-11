import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { FilterComponent } from "../filterComponent/filterComponent.js";

import "./inlineFilterForm.html";
import "./inlineFilterForm.css";

const actionMapping = [
  {
    type: String,
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

export class InlineFilterForm extends FilterComponent {
  static HelperMap() {
    return _.union(FilterComponent.HelperMap(), [
      "getActions",
      "isControlDisabled"
    ]);
  }

  static EventMap() {
    return {
      "change .input-dynamic-table-search": "handleSearchChange",
      "change .input-dynamic-table-action": "handleActionChange"
    };
  }

  rendered() {
    this.autorun(() => {
      const options = this.options.get();
      Meteor.defer(() => {
        const select2Component = this.$(".dynamic-table-select2");
        this.$(".dynamic-table-select2-section").children("span").remove();
        if(_.isArray(options)) { 
          select2Component.select2({
            placeholder: "Search...",
            data: this.options.get().map(option => ({
              text: option.label,
              id: option.label
            }))
          });
          select2Component.val(options.filter(option => this.isSelected(option.value)).map(option => option.label));
          select2Component.trigger('change');
        }
      });
    });
  }

  getActions() {
    const fieldType = this.fieldType.get();
    const action = actionMapping.find(value => [].concat(value.type).includes(fieldType));
    return action ? action.options.map(option => ({
      option,
      value: operatorMapping[option],
      isSelected: operatorMapping[option] === this.operator.get()
    })) : [];
  }

  isControlDisabled() {
    return this.operator.get().indexOf("$exists") !== -1 ? "disabled" : "";
  }

  handleSearchChange(e) {
    const value = $(e.currentTarget).val();
    const fieldType = this.fieldType.get();
    if (fieldType === Date || fieldType === "time" || fieldType === Number) {
      if (fieldType === "time") {
        const minutes = $(".minutes").val();
        const seconds = $(".seconds").val();
        this.doSearch(minutes, seconds);
      }
      else {
        this.doSearch(value);
      }
      return;
    }
    if (_.isArray(value)) {
      this.selectedOptions.set(value);
    }
    else {
      this.searching.set(true);
      this.throttledUpdate(this.search, value);
    }
  }

  handleActionChange(e) {
    const operator = this.operator.get();
    this.updateOperator($(e.currentTarget).val());
    if(operator.indexOf("$exists") !== -1) {
      this.selectedOptions.set([]);
    }
  }
}
BlazeComponent.register(Template.dynamicTableInlineFilterForm, InlineFilterForm);
