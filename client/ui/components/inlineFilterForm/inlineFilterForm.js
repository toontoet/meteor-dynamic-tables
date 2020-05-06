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

export class InlineFilterForm extends FilterComponent {
  static HelperMap() {
    return _.union(FilterComponent.HelperMap(), [
      "getActions"
    ]);
  }

  static EventMap() {
    return {
    };
  }

  rendered() {
    this.autorun(() => {
      this.options.get();
      Meteor.defer(() => {
        this.$("select2").select2("destroy");
        this.$(".select2").select2({
          placeholder: "Search..."
        });
      });
    });
  }

  getActions() {
    const fieldType = this.fieldType.get();
    const action = actionMapping.find(value => [].concat(value.type).includes(fieldType));
    return action ? action.options : [];
  }
}
BlazeComponent.register(Template.dynamicTableInlineFilterForm, InlineFilterForm);
