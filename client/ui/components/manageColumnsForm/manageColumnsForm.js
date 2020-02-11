
import "./manageColumnsForm.html";


import { Template } from "meteor/templating";
import { BlazeComponent } from "meteor/znewsham:blaze-component";


export class ManageColumnsForm extends BlazeComponent {
  static HelperMap() {
    return [
      "select2",
      "selectedIfEquals",
      "checkedIfTrue",
      "isDynamicFieldForm",
      "types",
      "selectedType",
      "configContext"
    ];
  }

  static EventMap() {
    return {
      "change .dynamic-table-manage-fields-edit-type": "changeType"
    };
  }

  configContext(selectedType, context) {
    if (context.manageFieldsEditContext.configContext) {
      return context.manageFieldsEditContext.configContext(selectedType, context);
    }
    return context;
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

  selectedType() {
    return this.get("selectedType");
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

  init() {
    const data = this.nonReactiveData();
    if (data.editableField && data.editableField.type) {
      const type = this.types().find(t => t.value === data.editableField.type);
      this.set("selectedType", type);
    }
  }

  changeType(e) {
    const value = $(e.currentTarget).val();
    const type = this.types().find(t => t.value === value);
    this.set("selectedType", type);
  }
}

BlazeComponent.register(Template.manageColumnsForm, ManageColumnsForm);
