import "./dynamicTableGroup.html";
import "./dynamicTableGroup.css";
import { getGroupedInfoCollection } from "../../../db.js";
import { changed, getCustom } from "../../../inlineSave.js";



function selectorToId(selector, tableIdSuffix) {
  if (tableIdSuffix) {
    return tableIdSuffix;
  }
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
  .replace(/\$/g, "")
  .replace(/ /g, "");
}

/** @this = root data context */
function getTableIdSuffix(value) {
  const current = this.groupChain[this.index];
  const nextSuffix = selectorToId({ [current.field]: value.query }, value.tableIdSuffix);

  const nextParts = (this.tableIdSuffixChain || []).slice(0);
  nextParts.push(nextSuffix);
  return nextParts.join("");
}

/** @this = template instance */
function getCount(value, selector) {
  const tableId = this.data.customTableSpec.id + getTableIdSuffix.call(this.data, value);
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
    let open = false;
    templInstance.stickyEnabled.set(index, true);
    if ($(e.currentTarget).siblings(".dynamic-table-content").css("display") === "block") {
      $(e.currentTarget).siblings(".dynamic-table-content").css("display", "none");
      open = false;
    }
    else {
      $(e.currentTarget).siblings(".dynamic-table-content").css("display", "block");
      open = true;
    }

    const values = templInstance.values.get();
    const tableId = templInstance.data.customTableSpec.id + getTableIdSuffix.call(this, values[index]);
    changed(templInstance.data.customTableSpec.custom, { changeOpenGroups: { [tableId]: open } });
  }
});

Template.dynamicTableGroup.onRendered(function onRendered() {
  this.autorun(() => {
    const values = this.values.get();
    const custom = this.custom.get();
    Tracker.afterFlush(() => {
      if (custom) {
        values.forEach((value, index) => {
          const tableId = this.data.customTableSpec.id + getTableIdSuffix.call(this.data, value);
          if (custom.openGroups && custom.openGroups.includes(tableId)) {
            this.stickyEnabled.set(index, true);
            this.$(`.dynamic-table-panel:nth-child(${index + 1}) > .dynamic-table-content`).css("display", "block");
          }
        });
      }
    });
  });
});

function addUndefined(current, values) {
  if (_.isObject(current.undefined)) {
    values.push({
      label: current.undefined.label || "Uncategorized",
      query: current.undefined.query || { $not: { $in: values.map(v => v.query) } },
      count: current.undefined.count === undefined ? current.count : current.undefined.count,
      alwaysShow: current.undefined.alwaysShow || current.alwaysShow
    });
  }
  else if (current.undefined) {
    values.push({
      label: current.undefined === true ? "Uncategorized" : current.undefined,
      query: { $not: { $in: values.map(v => v.query) } },
      count: current.count,
      alwaysShow: current.alwaysShow
    });
  }
}
Template.dynamicTableGroup.onCreated(function onCreated() {
  this.stickyEnabled = new ReactiveDict();
  this.counts = new ReactiveDict();
  this.values = new ReactiveVar([]);
  this.groupInfo = getGroupedInfoCollection(this.data.customTableSpec.table.collection._connection);
  this.custom = new ReactiveVar();
  getCustom(this.data.customTableSpec.custom, (custom) => {
    this.custom.set(custom);
  });

  this.autorun(() => {
    const data = Template.currentData();
    const current = data.groupChain[data.index];
    let values = [];
    if (_.isArray(current.values)) {
      values = current.values.slice(0, current.values.length);
      addUndefined(current, values);
    }
    else if (current.values) {
      values = current.values(data.selector);
      addUndefined(current, values);
    }
    else {
      Meteor.call("dynamicTableDistinctValuesForField", data.customTableSpec.id, data.customTableSpec.table.publication, data.selector, current.valuesField || current.field, (err, distinctValues) => {
        const asyncValues = current.transformDistinctValues ? current.transformDistinctValues(distinctValues) : distinctValues.map(v => ({ label: v, query: v }));
        addUndefined(current, asyncValues);
        this.values.set(asyncValues);
      });
    }
    this.values.set(values);
  });
  this.autorun(() => {
    const data = Template.currentData();
    const current = data.groupChain[data.index];
    const values = this.values.get();
    if (data.expandAll) {
      values.forEach((v, index) => {
        this.stickyEnabled.set(index, true);
      });
    }
    const ids = values.filter(v => v.count === true || (v.count === undefined && current.count === true))
    .map(value => this.data.customTableSpec.id + getTableIdSuffix.call(data, value));
    const counts = this.groupInfo.find({ _id: { $in: ids } });
    counts.forEach((count) => {
      this.counts.set(count._id, count.count);
    });
  });
  this.autorun(() => {
    const data = Template.currentData();
    const current = data.groupChain[data.index];
    const values = this.values.get();
    const currentSelector = data.selector;
    values.filter(v => v.count === true || (v.count === undefined && current.count === true))
    .forEach((value) => {
      let selector;
      if (value.selector) {
        selector = { $and: [currentSelector, selector] };
      }
      if (value.query) {
        selector = _.extend({ [current.field]: value.query }, currentSelector);
      }
      const tableId = this.data.customTableSpec.id + getTableIdSuffix.call(data, value);
      this.subscribe("simpleTablePublicationCount", tableId, data.customTableSpec.table.publication, selector, current.options || {});
    });
    values.filter(v => v.count !== true && v.count !== undefined)
    .forEach((value) => {
      this.autorun(() => {
        getCount.call(this, value, _.extend({ [current.field]: value.query }, currentSelector));
      });
    });
  });
});

Template.dynamicTableGroup.helpers({
  shouldDisplaySection(value) {
    const current = this.groupChain[this.index];
    if (value.alwaysShow || (value.alwaysShow === undefined && current.alwaysShow) || (value.count === undefined && current.count === undefined)) {
      return true;
    }
    const tableId = this.customTableSpec.id + getTableIdSuffix.call(this, value);
    const count = Template.instance().counts.get(tableId);
    return count;
  },
  hasCount(value) {
    const current = this.groupChain[this.index];
    return value.count || (value.count === undefined && current.count);
  },
  count(value) {
    const tableId = this.customTableSpec.id + getTableIdSuffix.call(this, value);
    return Template.instance().counts.get(tableId);
  },
  shouldDisplayTable(index) {
    return !this.lazy || Template.instance().stickyEnabled.get(index);
  },
  newSelector(value, currentSelector) {
    const current = this.groupChain[this.index];
    return _.extend({ [current.field]: value.query }, currentSelector);
  },
  table(value, newSelector) {
    const tableIdSuffix = getTableIdSuffix.call(this, value);
    return _.extend(
      {},
      this.customTableSpec,
      { selector: newSelector, id: this.customTableSpec.id + tableIdSuffix }
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
    return Template.instance().values.get();
  },
  tableIdSuffixChain(value) {
    const current = this.groupChain[this.index];
    const tableIdSuffixChain = [];
    tableIdSuffixChain.push(...(this.tableIdSuffixChain || []));
    tableIdSuffixChain.push(selectorToId({ [current.field]: value.query }, value.tableIdSuffix));
    return tableIdSuffixChain;
  }
});
