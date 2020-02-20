import "./manageOrderModal.css";
import "./manageOrderModal.html";

import { Random } from "meteor/random";

Template.dynamicTableManageOrderModal.onCreated(function onCreated() {
  this.newColumns = new ReactiveVar([]);
  this.order = new ReactiveVar(JSON.parse(JSON.stringify(this.data.order)));
});

Template.dynamicTableManageOrderModal.onRendered(function onRendered() {
  this.updateOrder = (newOrder) => {
    this.newColumns.set([]);
    this.order.set(newOrder);
    this.data.changeCallback(newOrder);
  };
});

Template.dynamicTableManageOrderModal.helpers({
  label(field) {
    return field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title;
  },
  orders() {
    const orders = [].concat(Template.instance().order.get(), Template.instance().newColumns.get());
    return orders.length ? orders : [{ order: "asc" }];
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
    const currentOrder = Template.instance().order.get()[index] || {};
    if (! order) {
      return "nah";
    }
    return currentOrder.order === order ? "active" : "nah";
  }
});

Template.dynamicTableManageOrderModal.events({
  "click .btn.order"(e, templInstance) {
    const target = $(e.currentTarget);
    const order = JSON.parse(JSON.stringify(templInstance.order.get()));
    const index = target.data("index");
    if (target.hasClass("active")) {
      return;
    }

    if (! order[index]) {
      Notifications.error("No Value Selected", "Select column before sorting by it.", { timeout: 8000 });
      return;
    }

    order[index].order = target.hasClass("asc") ? "asc" : "desc";
    templInstance.updateOrder(order);
  },
  "change select"(e, templInstance) {
    const target = $(e.currentTarget);
    const index = target.data("index");
    const order = JSON.parse(JSON.stringify(templInstance.order.get()));
    if (! order[index]) {
      order[index] = { order: "asc" };
    }

    const data = target.val();
    if (data) {
      const column = _.find(this.availableColumns, c => c.data === data);
      order[index].data = column.data;
      order[index].id = column.id; // not sure if id is needed
    }
    else {
      order.splice(index, 1);
    }

    templInstance.updateOrder(order);
  },
  "click .add-order"(e, templInstance) {
    templInstance.newColumns.get().push({ data: Random.id() });
    templInstance.newColumns.dep.changed();
  },
  "click .remove-order"(e, templInstance) {
    const target = $(e.currentTarget);
    const index = target.data("index");
    const order = templInstance.order.get();
    if (index >= order.length) {
      templInstance.newColumns.get().splice(index - order.length, 1);
      templInstance.newColumns.dep.changed();
    }
    else {
      order.splice(index, 1);
      templInstance.updateOrder(order);
    }
  }
});
