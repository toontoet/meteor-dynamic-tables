import { Random } from "meteor/random";
import "./manageGroupFieldsModal.css";
import "./manageGroupFieldsModal.html";


Template.dynamicTableManageGroupFieldsModal.onCreated(function onCreated() {
  this.newColumns = new ReactiveVar([]);
  this.selectedColumns = this.data.selectedColumns || [];
});

Template.dynamicTableManageGroupFieldsModal.onRendered(function onRendered() {
  this.maybeCallback = () => {
    const newFields = _.compact(_.toArray(this.$("select")).map(elem => $(elem).val()));
    const oldFields = (Tracker.nonreactive(() => this.selectedColumns) || []).map(c => c.field);
    if (!_.isEqual(newFields, oldFields)) {
      this.selectedColumns = newFields;
      this.newColumns.set([]);
      this.data.changeCallback(newFields);
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
    const selectedLength = Math.max(1, templInstance.selectedColumns.length);
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
  label(field) {
    return field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title;
  },
  selectedColumns() {
    const selectedColumns = Template.instance().selectedColumns;
    const allColumns = [].concat(selectedColumns, Template.instance().newColumns.get());
    return allColumns.length ? allColumns : [{ _id: Random.id() }];
  },
  selected(field, selectedField) {
    return field.field === selectedField ? { selected: "selected" } : {};
  },
  availableColumns() {
    const availableColumns = Template.instance().data.availableColumns;
    return availableColumns;
  },
  groups() {
    const availableColumns = Template.instance().data.availableColumns;
    const groups = _.groupBy(availableColumns, "group");
    delete groups[undefined];
    return _.sortBy(_.map(groups, (columns, title) => ({
      title,
      columns: _.sortBy(columns, field => field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title)
    })), "title");
  },
  ungroupedColumns() {
    const availableColumns = Template.instance().data.availableColumns;
    const groups = _.groupBy(availableColumns, "group");
    return _.sortBy(groups.undefined || [], field => field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title);
  }
});
