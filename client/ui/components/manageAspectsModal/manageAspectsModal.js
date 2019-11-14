import "./manageAspectsModal.css";
import "./manageAspectsModal.html";

import { Random } from "meteor/random";

Template.dynamicTableManageAspectsModal.onCreated(function onCreated() {
  this.newColumns = new ReactiveVar([]);

  const aspects = this.data.aspects || [];
  this.aspects = new ReactiveVar(aspects.length ? aspects : [{ _id: Random.id() }]);
});

Template.dynamicTableManageAspectsModal.onRendered(function onRendered() {
  // this.maybeCallback = () => {
  //   const newFields = _.compact(_.toArray(this.$("select")).map(elem => $(elem).val()));
  //   const oldFields = (Tracker.nonreactive(() => this.selectedColumns.get()) || []).map(c => c.field);// NOTE: intentionally non-reactive
  //   if (!_.isEqual(newFields, oldFields)) {
  //     const cols = _.object(this.data.availableColumns.map(c => c.field), this.data.availableColumns);
  //     const newCols = newFields.map(f => cols[f]);
  //     this.selectedColumns.curValue = newCols; // NOTE: intentionally non-reactive
  //     this.newColumns.set([]);
  //     this.data.changeCallback(newCols);
  //   }
  // };
});

Template.dynamicTableManageAspectsModal.helpers({
  label(field) {
    return field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title;
  },
  aspects() {
    return [].concat(Template.instance().aspects.get(), Template.instance().newColumns.get());
  },
  selected(field, selectedField) {
    return field.field === selectedField.field ? { selected: "selected" } : {};
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

Template.dynamicTableManageAspectsModal.events({
  "change select"(e, templInstance) {
    console.log("SELECT CHANGED: ", e)
    // templInstance.maybeCallback();
  },
  "click .add-aspect"(e, templInstance) {
    console.log("ADD ASPECT CLICK: ", e)
    // templInstance.newColumns.get().push({ _id: Random.id() });
    // templInstance.newColumns.dep.changed();
  },
  "click .remove-aspect"(e, templInstance) {
    console.log("REMOVE ASPECT CLICK: ", e)
    // const index = parseInt($(e.currentTarget).data("index"), 10);
    // const selectedLength = Math.max(1, templInstance.data.selectedColumns.length);
    // if (index >= selectedLength) {
    //   templInstance.newColumns.get().splice(index - selectedLength, 1);
    //   templInstance.newColumns.dep.changed();
    // }
    // else {
    //   $(e.currentTarget).closest("div").remove();
    // }
    // templInstance.maybeCallback();
  }
});