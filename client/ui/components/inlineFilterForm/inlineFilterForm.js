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
      "change .dynamic-table-filter-edit-type": "handleFilterEditTypeChange",
      "click .dynamic-table-filter-edit-isArray": "handleFilterEditIsArrayClick",
      "click .dynamic-table-filter-edit-searchable": "handleFilterEditSearchableClick",
      "click .btn-dynamic-table-cancel": "handleCancelClick",
      "click .btn-dynamic-table-save": "handleSaveClick",
      "click .dynamic-table-filter-edit-btn": "handleFilterEditBtnClick",
      "click .btn-dynamic-table-remove": "handleRemoveClick",
      "click .btn-dynamic-table-clear": "handleClearClick",
      "click .btn-dynamic-table-sort": "handleSortClick",
      "change .input-dynamic-table-operator": "handleInputOperatorChange",
      "click .fa-cog": "handleSettingsClick",
      "change .select-dynamic-table-operator": "handleSelectOperatorChange",
      "click .label-dynamic-table-selected": "handleSelectedClick",
      "click .input-dynamic-table-option": "handleOptionClick",
      "keyup .input-dynamic-table-search": "handleSearchKeyUp",
      "change .input-dynamic-table-search": "handleSearchChange"
    };
  }

  getActions() {
    const fieldType = this.fieldType.get();
    const action = actionMapping.find(value => [].concat(value.type).includes(fieldType));
    return action ? action.options : [];
  }
}
BlazeComponent.register(Template.dynamicTableInlineFilterForm, InlineFilterForm);
