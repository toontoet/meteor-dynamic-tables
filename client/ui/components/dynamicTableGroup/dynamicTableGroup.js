import { ReactiveDict } from "meteor/reactive-dict";
import "./dynamicTableGroup.html";
import "./dynamicTableGroup.css";
import { getGroupedInfoCollection, getDistinctValuesCollection } from "../../../db.js";
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

  const selector = {};
  if (value && value.query.$nor) {
    selector.$and = [value.query];
  }
  else if (value) {
    selector[current.field] = value.query;
  }
  const nextSuffix = value && selectorToId(selector, value.tableIdSuffix);

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
    changed(templInstance.data.customTableSpec.custom, tableId, { changeOpenGroups: { [tableId]: open } });
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
  const queries = values.map(v => v.query);
  let negation;
  if (queries.length && _.isObject(queries[0])) {
    negation = { $nor: queries.map(q => ({ [current.field]: q })) };
  }
  else {
    negation = { $not: { $in: queries } };
  }
  if (_.isObject(current.undefined)) {
    values.push({
      label: current.undefined.label || "Uncategorized",
      query: current.undefined.query || negation,
      selector: current.undefined.selector,
      count: current.undefined.count === undefined ? current.count : current.undefined.count,
      alwaysShow: current.undefined.alwaysShow || current.alwaysShow
    });
  }
  else if (current.undefined) {
    values.push({
      label: current.undefined === true ? "Uncategorized" : current.undefined,
      query: negation,
      count: current.count,
      alwaysShow: current.alwaysShow
    });
  }
}

function processDistinctValues(current, distinctValues) {
  const asyncValues = current.transformDistinctValues ? current.transformDistinctValues(distinctValues) : distinctValues.map(v => ({ label: v, query: v }));
  addUndefined(current, asyncValues);
  this.values.set(asyncValues.map(v => _.extend(v, { _id: JSON.stringify(v.selector || v.query) })));
}
Template.dynamicTableGroup.onCreated(function onCreated() {
  this.stickyEnabled = new ReactiveDict();
  this.enabled = new ReactiveDict();
  this.loading = new ReactiveVar({});
  this.counts = new ReactiveDict();
  this.values = new ReactiveVar([]);
  this.groupInfo = getGroupedInfoCollection(this.data.customTableSpec.table.collection._connection);
  this.distinctValues = getDistinctValuesCollection(this.data.customTableSpec.table.collection._connection);
  this.custom = new ReactiveVar();
  let lastGroupChain = {};
  getCustom(this.data.customTableSpec.custom, this.data.customTableSpec.id, (custom) => {
    this.custom.set(custom);
  });

  this.autorun(() => {
    const data = Template.currentData();
    if (JSON.stringify(lastGroupChain) !== JSON.stringify(data.groupChain)) {
      this.enabled.destroy();
      this.stickyEnabled.destroy();
    }
    lastGroupChain = data.groupChain;
  });
  this.autorun(() => {
    const data = Template.currentData();
    const current = data.groupChain[data.index];
    const countWithDistinct = false;//current.count && !current.values; NOTE: can't figure out how to handle the ability to mutate the list in transform.
    let values = [];
    if (_.isArray(current.values)) {
      values = current.values.slice(0, current.values.length);
      addUndefined(current, values);
      this.values.set(values);
    }
    else if (current.values) {
      values = current.values(data.selector);
      values = values.slice(0, values.length);
      addUndefined(current, values);
      this.values.set(values);
    }
    else {
      const loading = Tracker.nonreactive(() => this.loading.get());
      loading.distinctValues = true;
      this.loading.set(loading);
      if (Tracker.nonreactive(() => Meteor.status().status === "offline" || !data.customTableSpec.table.publication)) {
        const distinctValues = _.unique(_.compact(
          data.customTableSpec.table.collection.find(data.selector, { fields: { [current.valuesField || current.field]: 1 } }).map(i => getValue(i, current.valuesField || current.field))
        ));
        processDistinctValues.call(this, current, distinctValues);
      }
      else {
        const sub = this.subscribe(
          "__dynaicTableDistinctValuesForField",
          data.customTableSpec.id + getTableIdSuffix.call(this.data),
          data.customTableSpec.table.publication,
          current.valuesField || current.field,
          data.selector,
          {},
          countWithDistinct
        );
        if (sub.ready()) {
          const loading = Tracker.nonreactive(() => this.loading.get());
          delete loading.distinctValues;
          this.loading.set(loading);
          const distinctValues = (this.distinctValues.findOne({ _id: data.customTableSpec.id + getTableIdSuffix.call(this.data) }) || { groups: [] }).groups.map(v => v.value);
          processDistinctValues.call(this, current, distinctValues);
        }
      }
    }
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
    if (Tracker.nonreactive(() => Meteor.status().status !== "offline") && data.customTableSpec.table.publication) {
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
        let selector;
        if (value.selector) {
          selector = _.extend({ }, data.selector);
          if (!selector.$and) {
            selector.$and = [];
          }
          selector.$and.push(value.selector);
        }
        else if (value.query.$nor) {
          selector = _.extend({ }, data.selector);
          if (!selector.$and) {
            selector.$and = [];
          }
          selector.$and.push(value.query);
        }
        else {
          selector = _.extend({ [current.field]: value.query }, data.selector);
        }
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
    if (!countWithDistinct && Tracker.nonreactive(() => Meteor.status().status !== "offline" && data.customTableSpec.table.publication)) {
      let loading = Tracker.nonreactive(() => this.loading.get());
      loading.countValues = true;
      this.loading.set(loading);
      const sub = this.subscribe(
        "__dynamicTableGroupCounts",
        data.customTableSpec.id + getTableIdSuffix.call(this.data),
        data.customTableSpec.table.publication,
        current.field,
        currentSelector,
        values.filter(v => v.ensureValues || v.count === true || (v.count === undefined && current.count === true) || (v.ensureValues === undefined && current.ensureValues))
        .map(v => ({ options: { limit: v.ensureValues || (v.ensureValues === undefined && current.ensureValues) }, query: v.query })),
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
  if (value.alwaysShow || (value.alwaysShow === undefined && current.alwaysShow)) {
    return true;
  }
  if (!value.count && !current.count && !value.ensureValues && !current.ensureValues) {
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

    const selector = _.extend({}, currentSelector);
    if (value.selector) {
      if (!selector.$and) {
        selector.$and = [];
      }
      selector.$and.push(value.selector);
    }
    else if (value.query.$nor) {
      if (!selector.$and) {
        selector.$and = [];
      }
      selector.$and.push(value.query);
    }
    else {
      selector[current.field] = value.query;
    }
    return selector;
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
    const selector = {};
    if (value.query.$nor) {
      selector.$and = [value.query];
    }
    else {
      selector[current.field] = value.query;
    }
    tableIdSuffixChain.push(selectorToId(selector, value.tableIdSuffix));
    return tableIdSuffixChain;
  }
});
