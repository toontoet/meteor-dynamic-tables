import { Random } from "meteor/random";
import "./manageGroupFieldsModal.css";
import "./manageGroupFieldsModal.html";


Template.dynamicTableManageGroupFieldsModal.onCreated(function onCreated() {
  this.newColumns = new ReactiveVar([]);
});
Template.dynamicTableManageGroupFieldsModal.onRendered(function onRendered() {
  this.maybeCallback = () => {
    const newFields = _.compact(_.toArray(this.$("select")).map(elem => $(elem).val()));
    const oldFields = this.data.selectedColumns.map(c => c.field);
    if (!_.isEqual(newFields, oldFields)) {
      const cols = _.object(this.data.availableColumns.map(c => c.field), this.data.availableColumns);
      this.data.changeCallback(newFields.map(f => cols[f]));
    }
  };
});

Template.dynamicTableManageGroupFieldsModal.events({
  "change select"(e, templInstance) {
    templInstance.maybeCallback();
  },
  "click .add-group"(e, templInstance) {
    templInstance.newColumns.get().push({ _id: Random.id() });
    templInstance.newColumns.dep.changed();
  },
  "click .remove-group"(e, templInstance) {
    const index = parseInt($(e.currentTarget).data("index"), 10);
    const selectedLength = Math.max(1, templInstance.data.selectedColumns.length);
    if (index >= selectedLength) {
      templInstance.newColumns.get().splice(index - selectedLength, 1);
      templInstance.newColumns.dep.changed();
    }
    else {
      $(e.currentTarget).closest("div").remove();
    }
    templInstance.maybeCallback();
  }
});
Template.dynamicTableManageGroupFieldsModal.helpers({
  selectedColumns() {
    const selectedColumns = this.selectedColumns.length ? this.selectedColumns : [{ _id: Random.id() }];
    return [].concat(selectedColumns, Template.instance().newColumns.get());
  },
  selected(field, selectedField) {
    return field.field === selectedField.field ? { selected: "selected" } : {};
  },
  availableColumns() {
    const availableColumns = Template.instance().data.availableColumns;
    return availableColumns;
  }
});
