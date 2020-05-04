import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { FilterComponent } from "../filterComponent/filterComponent.js";

import "./filterModal.html";
import "./filterModal.css";

export class FilterModal extends FilterComponent {
  static HelperMap() {
    return _.union(FilterComponent.HelperMap(), [

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

  handleFilterEditTypeChange(e) {
    console.log(e);
  }
  handleFilterEditIsArrayClick(e) {
    console.log(e);
  }
  handleFilterEditSearchableClick(e) {
    console.log(e);
  }
  handleCancelClick(e) {
    console.log(e);
  }
  handleSaveClick(e) {
    console.log(e);
  }
  handleFilterEditBtnClick(e) {
    console.log(e);
  }
  handleRemoveClick(e) {
    console.log(e);
  }
  handleClearClick(e) {
    console.log(e);
  }
  handleSortClick(e) {
    console.log(e);
  }
  handleInputOperatorChange(e) {
    console.log(e);
  }
  handleSettingsClick(e) {
    console.log(e);
  }
  handleSelectOperatorChange(e) {
    console.log(e);
  }
  handleSelectedClick(e) {
    console.log(e);
  }
  handleOptionClick(e) {
    console.log(e);
  }
  handleSearchKeyUp(e) {
    console.log(e);
  }
  handleSearchChange(e) {
    console.log(e);
  }
}
BlazeComponent.register(Template.dynamicTableFilterModal, FilterModal);
