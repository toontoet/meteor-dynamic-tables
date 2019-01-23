import { ReactiveDict } from "meteor/reactive-dict";
import "./dynamicTableGroup.html";
import "./dynamicTableGroup.css";
import { getGroupedInfoCollection } from "../../../db.js";
import { changed, getCustom, getValue } from "../../../inlineSave.js";


function selectorToId(selector, tableIdSuffix) {
  if (tableIdSuffix) {
    return tableIdSuffix;
  }
  return JSON.stringify(selector)
  .replace(/[^\d\w]/g, "");
}

/** @this = root data context */
function getTableIdSuffix(value) {
  const current = this.groupChain[this.index];
  const nextSuffix = value && selectorToId({ [current.field]: value.query }, value.tableIdSuffix);

  const nextParts = (this.tableIdSuffixChain || []).slice(0);
  if (nextSuffix) {
    nextParts.push(nextSuffix);
  }
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
    if (templInstance.enabled.get(index)) {
      open = false;
    }
    else {
      open = true;
      templInstance.stickyEnabled.set(index, true);
    }
    templInstance.enabled.set(index, open);

    const values = templInstance.values.get();
    const tableId = templInstance.data.customTableSpec.id + getTableIdSuffix.call(this, values[index]);
    changed(templInstance.data.customTableSpec.custom, tableId, true, { changeOpenGroups: { [tableId]: open } });
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
            this.enabled.set(index, true);
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
  const self = this;
  this.stickyEnabled = new ReactiveDict();
  this.enabled = new ReactiveDict();
  this.loading = new ReactiveVar({});
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
    const countWithDistinct = false;//current.count && !current.values; NOTE: can't figure out how to handle the ability to mutate the list in transform.
    let values = [];
    if (_.isArray(current.values)) {
      values = current.values.slice(0, current.values.length);
      addUndefined(current, values);
    }
    else if (current.values) {
      values = current.values(data.selector);
      values = values.slice(0, values.length);
      addUndefined(current, values);
    }
    else {
      const loading = Tracker.nonreactive(() => this.loading.get());
      loading.distinctValues = true;
      this.loading.set(loading);
      let promise;
      if (Tracker.nonreactive(() => Meteor.status().status === "offline")) {
        const distinctValues = _.unique(data.customTableSpec.table.collection.find(data.selector, { fields: { [current.valuesField || current.field]: 1 } }).map(i => getValue(i, current.valuesField || current.field)));
        promise = Promise.resolve(distinctValues);
      }
      else {
        promise = new Promise((resolve) => {
          Meteor.call("dynamicTableDistinctValuesForField", data.customTableSpec.id, data.customTableSpec.table.publication, data.selector, current.valuesField || current.field, countWithDistinct, (err, distinctValues) => {
            if (countWithDistinct) {
              // NOTE: this won't work
              const asyncValues = current.transformDistinctValues ? current.transformDistinctValues(_.pluck(distinctValues, "_id")) : _.pluck(distinctValues, "_id").map(v => ({ label: v, query: v }));
              this.counts.clear();
              asyncValues.forEach((value, index) => {
                const id = this.data.customTableSpec.id + getTableIdSuffix.call(data, value);
                const count = asyncValues[index].count;
                this.counts.set(id, count);
              });
              return resolve(_.pluck(distinctValues, "_id"));
            }
            resolve(distinctValues || []);
          });
        });
      }
      promise.then((distinctValues) => {
        const asyncValues = current.transformDistinctValues ? current.transformDistinctValues(distinctValues) : distinctValues.map(v => ({ label: v, query: v }));
        addUndefined(current, asyncValues);
        this.values.set(asyncValues);
        const loading = Tracker.nonreactive(() => this.loading.get());
        delete loading.distinctValues;
        this.loading.set(loading);
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
        this.enabled.set(index, true);
        this.stickyEnabled.set(index, true);
      });
    }
    const valuesToCount = values.filter(v => v.ensureValues || v.count === true || (v.count === undefined && current.count === true) || (v.ensureValues === undefined && current.ensureValues));
    if (Tracker.nonreactive(() => Meteor.status().status !== "offline")) {
      const ids = valuesToCount.map(value => ({ tableId: this.data.customTableSpec.id + getTableIdSuffix.call(data, value), resultId: JSON.stringify(value.query).replace(/[\{\}.:]/g, "") }));
      const count = this.groupInfo.findOne({ _id: data.customTableSpec.id + getTableIdSuffix.call(this.data) });
      ids.forEach(({ tableId, resultId }) => {
        if (count && count[resultId]) {
          this.counts.set(tableId, count[resultId]);
        }
        else {
          this.counts.set(tableId, 0);
        }
      });
    }
    else {
      valuesToCount.forEach((value) => {
        const selector = _.extend({ [current.field]: value.query }, data.selector);
        const count = data.customTableSpec.table.collection.find(selector).count();
        this.counts.set(this.data.customTableSpec.id + getTableIdSuffix.call(data, value), count);
      });
    }
  });
  this.autorun(() => {
    const data = Template.currentData();
    const current = data.groupChain[data.index];
    const values = this.values.get();
    const currentSelector = data.selector;
    const countWithDistinct = false;//current.count && !current.values;
    if (!countWithDistinct) {
      let loading = Tracker.nonreactive(() => this.loading.get());
      loading.countValues = true;
      this.loading.set(loading);
      const sub = this.subscribe(
        "simpleTablePublicationCounts",
        data.customTableSpec.id + getTableIdSuffix.call(this.data),
        data.customTableSpec.table.publication,
        current.field,
        currentSelector,
        values.filter(v => v.ensureValues || v.count === true || (v.count === undefined && current.count === true) || (v.ensureValues === undefined && current.ensureValues)).map(v => v.query),
        current.options || {}
      );
      if (sub.ready()) {
        loading = Tracker.nonreactive(() => this.loading.get());
        delete loading.countValues;
        this.loading.set(loading);
      }
    }
  });
});

function shouldDisplaySection(current, value) {
  if (value.alwaysShow || (value.alwaysShow === undefined && current.alwaysShow) || (value.count === undefined && current.count === undefined && value.ensureValues === undefined && current.ensureValues === undefined)) {
    return true;
  }
  const tableId = this.customTableSpec.id + getTableIdSuffix.call(this, value);
  const count = Template.instance().counts.get(tableId);
  const ensureValues = value.ensureValues || current.ensureValues;
  if (ensureValues && count < ensureValues) {
    return 0;
  }
  return count;
}
Template.dynamicTableGroup.helpers({
  waitingAndLoading() {
    return this.loading && Object.keys(Template.instance().loading.get()).length !== 0;
  },
  showLoadingMessage() {
    return this.loading === true;
  },
  showNoGroupsMessage() {
    return this.noGroups === true;
  },
  hasVisibleGroups() {
    const current = this.groupChain[this.index];
    const values = Template.instance().values.get().filter(value => shouldDisplaySection.call(this, current, value));
    return values.length;
  },
  shouldDisplaySection(value) {
    const current = this.groupChain[this.index];
    return shouldDisplaySection.call(this, current, value);
  },
  hasCount(value) {
    const current = this.groupChain[this.index];
    return value.count || (value.count === undefined && current.count);
  },
  count(value) {
    const tableId = this.customTableSpec.id + getTableIdSuffix.call(this, value);
    return Template.instance().counts.get(tableId);
  },
  shouldDisplayContent(index) {
    return !this.lazy || Template.instance().enabled.get(index);
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
