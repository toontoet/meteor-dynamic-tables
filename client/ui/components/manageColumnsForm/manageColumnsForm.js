
import "./manageColumnsForm.html";


import { Template } from "meteor/templating";
import { BlazeComponent } from "meteor/znewsham:blaze-component";


export class ManageColumnsForm extends BlazeComponent {
  static HelperMap() {
    return {
      select2: "select2",
      selectedIfEquals: "selectedIfEquals",
      checkedIfTrue: "checkedIfTrue",
      isDynamicFieldForm: "isDynamicFieldForm",
      types: "types"
    }
  }

  isDynamicFieldForm() {
    const edit = this.nonReactiveData().manageFieldsEditContext;
    return edit && edit.dynamicFieldForm;
  }

  select2() {
    return $.fn.select2;
  }

  selectedIfEquals(val1, val2) {
    return val1 == val2 ? { selected: "selected" } : {};
  }

  checkedIfTrue(val) {
    return val || val === 0 ? { checked: "checked" } : {};
  }

  types() {
    const types = this.nonReactiveData().manageFieldsEditContext.types || [];
    return types.map((t) => {
      if (_.isObject(t)) {
        return t;
      }
      return {
        value: t,
        label: t
      };
    });
  }

  rendered() {
    const data = this.nonReactiveData();
    if ($.fn.select2) {
      this.$(".dynamic-table-manage-fields-edit-group").select2({
        tags: true,
        placeholder: "Select a Group",
        allowClear: true,
        data: _.union(
          [{ id: "", value: "" }],
          data.groupNames.map(g => ({ id: g, text: g }))
        )
      });
      if (data.editableField) {
        this.$(".dynamic-table-manage-fields-edit-group").val(data.editableField.groupName).trigger("change");
      }
    }
  }
}

BlazeComponent.register(Template.manageColumnsForm, ManageColumnsForm);
