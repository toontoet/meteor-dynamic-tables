import "./manageAspectsModal.css";
import "./manageAspectsModal.html";

import { Random } from "meteor/random";

Template.dynamicTableManageAspectsModal.onCreated(function onCreated() {
  this.newColumns = new ReactiveVar([]);
  this.aspects = new ReactiveVar(this.data.aspects);
});

Template.dynamicTableManageAspectsModal.onRendered(function onRendered() {
  this.updateOrder = (newAspects) => {
    this.newColumns.set([]);
    this.aspects.set(newAspects);
    this.data.changeCallback(newAspects);
  };
});

Template.dynamicTableManageAspectsModal.helpers({
  label(field) {
    return field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title;
  },
  aspects() {
    const aspects = [].concat(Template.instance().aspects.get(), Template.instance().newColumns.get());
    return aspects.length ? aspects : [{ order: "asc" }];
  },
  selected(field, selectedField) {
    if (! selectedField.data) {
      return {};
    }
    return field.data === selectedField.data ? { selected: "selected" } : {};
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
  },
  activeOrder(order, index) {
    const aspect = Template.instance().aspects.get()[index];
    if (! aspect) {
      return "nah";
    }
    return aspect.order === order ? "active" : "nah";
  }
});

Template.dynamicTableManageAspectsModal.events({
  "click .btn.order"(e, templInstance) {
    const target = $(e.currentTarget);
    const aspects = JSON.parse(JSON.stringify(templInstance.aspects.get()));
    const index = target.data("index");
    if (target.hasClass("active")) {
      return;
    }

    if (! aspects[index]) {
      Notifications.error("No Value Selected", "Select column before sorting by it.", { timeout: 8000 });
      return;
    }

    aspects[index].order = target.hasClass("asc") ? "asc" : "desc";
    templInstance.updateOrder(aspects);
  },
  "change select"(e, templInstance) {
    const target = $(e.currentTarget);
    const index = target.data("index");
    const aspects = JSON.parse(JSON.stringify(templInstance.aspects.get()));
    if (! aspects[index]) {
      aspects[index] = { order: "asc" };
    }

    const data = target.val();
    if (data) {
      const column = _.find(this.availableColumns, c => c.data === data);
      aspects[index].data = column.data;
      aspects[index].id = column.id; // not sure if id is needed
    }
    else {
      aspects.splice(index, 1);
    }

    templInstance.updateOrder(aspects);
  },
  "click .add-aspect"(e, templInstance) {
    templInstance.newColumns.get().push({ data: Random.id() });
    templInstance.newColumns.dep.changed();
  },
  "click .remove-aspect"(e, templInstance) {
    const target = $(e.currentTarget);
    const index = target.data("index");
    const aspects = templInstance.aspects.get();
    if (index >= aspects.length) {
      templInstance.newColumns.get().splice(index - aspects.length, 1);
      templInstance.newColumns.dep.changed();
    }
    else {
      aspects.splice(index, 1);
      templInstance.updateOrder(aspects);
    }
  }
});