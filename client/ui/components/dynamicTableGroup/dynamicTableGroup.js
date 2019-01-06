import "./dynamicTableGroup.html";
import "./dynamicTableGroup.css";
import { getGroupedInfoCollection } from "../../../db.js";

function selectorToId(selector) {
  return JSON.stringify(selector)
  .replace(/:/g, "")
  .replace(/,/g, "")
  .replace(/\./g, "-")
  .replace(/\{/g, "")
  .replace(/"/g, "")
  .replace(/'/g, "")
  .replace(/\[/g, "")
  .replace(/\]/g, "")
  .replace(/\}/g, "")
  .replace(/\$/g, "");
}

function getCount(value, selector) {
  const tableId = this.data.customTableSpec.id + selectorToId(selector);
  let count = value.count;
  if (_.isFunction(value.count)) {
    count = value.count(tableId, selector);
  }
  this.counts.set(tableId, count);
}

Template.dynamicTableGroup.events({
  "click .dynamic-table-header"(e, templInstance) {
    e.stopImmediatePropagation(); // QUESTION: why is this required? Without it this event handler gets called multiple times
    const index = parseInt($(e.currentTarget).data("index"), 10);
    templInstance.stickyEnabled.set(index, true);
    if ($(e.currentTarget).siblings(".dynamic-table-content").css("display") === "block") {
      $(e.currentTarget).siblings(".dynamic-table-content").css("display", "none");
    }
    else {
      $(e.currentTarget).siblings(".dynamic-table-content").css("display", "block");
    }
  }
});

Template.dynamicTableGroup.onCreated(function onCreated() {
  this.stickyEnabled = new ReactiveDict();
  this.counts = new ReactiveDict();
  this.groupInfo = getGroupedInfoCollection(this.data.customTableSpec.table.collection._connection);
  this.autorun(() => {
    const data = Template.currentData();
    const current = data.groupChain[data.index];
    const values = current.values.slice(0, current.values.length);
    if (current.undefined) {
      values.push({
        label: current.undefined === true ? "Uncategorized" : current.undefined,
        query: { $not: { $in: values.map(v => v.query) } },
        count: true
      });
    }
    const ids = values.filter(v => v.count === true)
    .map((value) => {
      const selector = _.extend({ [current.field]: value.query }, data.selector);
      return this.data.customTableSpec.id + selectorToId(selector);
    });
    const counts = this.groupInfo.find({ _id: { $in: ids } });
    counts.forEach((count) => {
      this.counts.set(count._id, count.count);
    });
  });
  this.autorun(() => {
    const data = Template.currentData();
    const current = data.groupChain[data.index];
    const values = current.values.slice(0, current.values.length);
    if (current.undefined) {
      values.push({
        label: current.undefined === true ? "Uncategorized" : current.undefined,
        query: { $not: { $in: values.map(v => v.query) } },
        count: true
      });
    }
    const currentSelector = data.selector;
    values.filter(v => v.count === true)
    .forEach((value) => {
      const selector = _.extend({ [current.field]: value.query }, currentSelector);
      const tableId = this.data.customTableSpec.id + selectorToId(selector);
      this.subscribe("simpleTablePublicationCount", tableId, data.customTableSpec.table.publication, selector, current.options || {});
    });
    values.filter(v => v.count !== true)
    .forEach((value) => {
      this.autorun(() => {
        getCount.call(this, value, _.extend({ [current.field]: value.query }, currentSelector));
      });
    });
  });
});

Template.dynamicTableGroup.helpers({
  shouldDisplaySection(value, selector) {
    if (value.alwaysShow || value.count === undefined) {
      return true;
    }
    const tableId = this.customTableSpec.id + selectorToId(selector);
    const count = Template.instance().counts.get(tableId);
    return count;
  },
  hasCount(value) {
    return value.count;
  },
  count(value, selector) {
    const tableId = this.customTableSpec.id + selectorToId(selector);
    return Template.instance().counts.get(tableId);
  },
  shouldDisplayTable(index) {
    return Template.instance().stickyEnabled.get(index);
  },
  newSelector(value, currentSelector) {
    const current = this.groupChain[this.index];
    return _.extend({ [current.field]: value.query }, currentSelector);
  },
  table(newSelector) {
    return _.extend(
      {},
      this.customTableSpec,
      { selector: newSelector, id: this.customTableSpec.id + selectorToId(newSelector) }
    );
  },
  lastLevel() {
    return this.index + 1 === this.groupChain.length;
  },
  nextIndex() {
    return this.index + 1;
  },
  currentGroupLabel() {
    return this.groupChain[this.index].label;
  },
  currentGroupValues() {
    const current = this.groupChain[this.index];
    const values = current.values.slice(0, current.values.length);
    if (current.undefined) {
      values.push({
        label: this.groupChain[this.index].undefined === true ? "Uncategorized" : this.groupChain[this.index].undefined,
        query: { $not: { $in: values.map(v => v.query) } },
        count: true
      });
    }
    return values;
  }
});
