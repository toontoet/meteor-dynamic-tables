import { Random } from "meteor/random";
import "./manageGroupFieldsModal.css";
import "./manageGroupFieldsModal.html";


Template.dynamicTableManageGroupFieldsModal.onCreated(function onCreated() {
  this.dynamicTableSpec = this.data.dynamicTableSpec;
  this.groupedBy = this.data.groupedBy;
});

Template.dynamicTableManageGroupFieldsModal.onRendered(function onRendered() {
  this.maybeCallback = () => {
    const newGrouping = this.$("select").val();
    const oldGrouping = this.groupedBy.get();
    if (newGrouping !== oldGrouping) {
      const cols = _.object(this.dynamicTableSpec.groupableFields.map(c => c.field), this.dynamicTableSpec.groupableFields);
      const newCol = cols[newGrouping];
      this.data.changeCallback(newCol);
    }
  };
});

Template.dynamicTableManageGroupFieldsModal.events({
  "change select"(e, templInstance) {
    templInstance.maybeCallback();
  },
});
Template.dynamicTableManageGroupFieldsModal.helpers({
  label(field) {
    return field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title;
  },
  fieldId(field) {
    return field.field;
  },
  selected(field) {
    const anySelected = field.field === Template.instance().groupedBy.get();
    return anySelected ? { selected: "selected" } : {};
  },
  groups() {
    const availableColumns = Template.instance().dynamicTableSpec.groupableFields;
    const groups = _.groupBy(availableColumns, "group");
    delete groups[undefined];
    return _.sortBy(_.map(groups, (columns, title) => ({
      title,
      columns: _.sortBy(columns, field => field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title)
    })), "title");
  },
  ungroupedColumns() {
    const availableColumns = Template.instance().dynamicTableSpec.groupableFields;
    const groups = _.groupBy(availableColumns, "group");
    return _.sortBy(groups.undefined || [], field => field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title);
  }
});
