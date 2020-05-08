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
      "getActions"
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
        if(this.$(".select2").hasClass("select2-hidden-accessible")) {
          this.$(".select2").select2("destroy");
        }
        if(_.isArray(options)) {
          options.forEach(option => {
            const selected = this.isSelected(option.value);
            const newOption = new Option(option.label, option.label, selected, selected);
            this.$(".select2").append(newOption);
          });
          this.$(".select2").select2({
            placeholder: "Search..."
          });
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
    this.updateOperator($(e.currentTarget).val());
    if(operator.indexOf("$exists") !== -1) {}
  }
}
BlazeComponent.register(Template.dynamicTableInlineFilterForm, InlineFilterForm);
