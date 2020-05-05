import { BlazeComponent } from "meteor/znewsham:blaze-component";
import { FilterComponent } from "../filterComponent/filterComponent.js";

import "./filterModal.html";
import "./filterModal.css";

function closeModal() {
  const filterModalWrapper = $("#dynamic-table-filter-modal")[0];
  if (filterModalWrapper) {
    Blaze.remove(filterModalWrapper.__blazeTemplate);
    filterModalWrapper.innerHTML = "";
  }
}

export class FilterModal extends FilterComponent {
  static HelperMap() {
    return FilterComponent.HelperMap();
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
    this.currentSpec.set("type", $(e.currentTarget).val());
  }
  handleFilterEditIsArrayClick(e) {
    this.currentSpec.set("isArray", $(e.currentTarget).is(":checked"));
  }
  handleFilterEditSearchableClick(e) {
    let indexedNumber = this.nonReactiveData().field.edit.spec.indexedNumber;
    indexedNumber = indexedNumber === false ? "new" : indexedNumber;
    this.currentSpec.set("indexedNumber", $(e.currentTarget).is(":checked") ? indexedNumber : false);
  }
  handleCancelClick(e) {
    this.editing.set(false);
  }
  handleSaveClick(e) {
    this.$(".btn-dynamic-table-save").attr("disabled", "disabled");
    this.nonReactiveData().data.field.edit.callback(e, this).then((newSpec) => {
      this.$(".btn-dynamic-table-save").removeAttr("disabled");
      this.updateSpec(newSpec);
    }).catch(err => console.log(err));
  }
  handleFilterEditBtnClick() {
    this.editing.set(true);
  }
  handleRemoveClick() {
    this.nonReactiveData().data.callback([], "$in", undefined, false);
    this.nonReactiveData().data.removeColumn();
    closeModal();
  }
  handleClearClick() {
    this.search.set(undefined);
    this.selectedOptions.set([]);
    this.$(".input-dynamic-table-search").val("");
  }
  handleSortClick(e) {
    this.sortDirection.set($(e.currentTarget).data("direction"));
  }
  handleInputOperatorChange(e) {
    const options = this.options.get();
    const hasOptions = options && options.length;
    let operator = $(e.currentTarget).val();
    if (operator === "$in") {
      if (!hasOptions) {
        operator = "$regex";
      }
      if (this.$(".btn-dynamic-table-operator.btn-dynamic-table-selected").data("modifier") === "$all") {
        operator = "$all";
      }
    }
    if (operator === "$nin") {
      if (!hasOptions) {
        operator = "$not";
      }
    }
    this.operator.set(operator);
  }
  handleSettingsClick() {
    this.showOperators.set(!this.showOperators.get());
  }
  handleSelectOperatorChange(e) {
    this.updateOperator(this.$(e.currentTarget).val());
    this.$(".input-dynamic-table-search").trigger("change");
  }
  handleSelectedClick(e) {
    this.updateSelectedOptions($(e.currentTarget).data("value"), false);
  }
  handleOptionClick(e) {
    this.updateSelectedOptions($(e.currentTarget).val(), $(e.currentTarget).is(":checked"));
  }
  handleSearchKeyUp(e) {
    const value = $(e.currentTarget).val();
    const data = this.nonReactiveData();
    const fieldType = this.fieldType.get();
    if (fieldType === Date || fieldType === "time" || fieldType === Number) {
      this.doSearch(value);
      return;
    }
    if (_.isArray(data.filter.options)) {
      this.search.set(value);
    }
    else {
      this.searching.set(true);
      this.throttledUpdate(this.search, value);
    }
  }
  handleSearchChange(e) {
    this.doSearch($(e.currentTarget).val());
  }

  rendered() {
    this.autorun(() => {
      if (this.editing.get()) {
        Tracker.afterFlush(() => {
          if ($.fn.select2) {
            this.$(".dynamic-table-filter-edit-group").select2({
              tags: true,
              placeholder: "Select a Group",
              allowClear: true,
              data: _.union(
                [{ id: "", value: "" }],
                this.nonReactiveData().data.groupNames.map(g => ({ id: g, text: g }))
              )
            });
            this.$(".dynamic-table-filter-edit-group").val(this.editableField.get().groupName).trigger("change");
          }
        });
      }
    });
    /**
   * When filter modal is open over any existing bootstrap modal,
   * input element i.e search field of filter modal is not clickable,
   * To fix it, we get rid of focus on bootstrap modal
   */
    $(document).off("focusin.modal");
  }
}
BlazeComponent.register(Template.dynamicTableFilterModal, FilterModal);
