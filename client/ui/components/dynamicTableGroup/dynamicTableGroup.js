import { ReactiveDict } from "meteor/reactive-dict";
import "./dynamicTableGroup.html";
import "./dynamicTableGroup.css";
import { getGroupedInfoCollection, getDistinctValuesCollection } from "../../../db.js";
import { changed, getCustom, getValue, createModal } from "../../../inlineSave.js";

import "../manageGroupFieldsModal/manageGroupFieldsModal.js";
import "../manageAspectsModal/manageAspectsModal.js";

/**
 * selectorToId - description
 *
 * @param  {object} selector      mongo selector
 * @param  {string} tableIdSuffix table suffix
 * @return {string}               table suffix
 */
function selectorToId(selector, tableIdSuffix) {
  if (tableIdSuffix) {
    return tableIdSuffix;
  }
  return JSON.stringify(selector)
  .replace(/\\t/g, "_t_t_t_t")
  .replace(/ /g, "____")
  .replace(/[^\d\w]/g, "");
}

/** @this = template instance */
function getTableIdSuffix(value) {
  const current = this.grouping;

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
function shouldDisplaySection(current, value) {
  if (value.alwaysShow || (value.alwaysShow === undefined && current.alwaysShow)) {
    return true;
  }
  if (!value.count && !current.count && !value.ensureValues && !current.ensureValues) {
    return true;
  }
  const tableId = this.data.customTableSpec.id + getTableIdSuffix.call(Template.instance(), value);
  const count = Template.instance().counts.get(tableId);
  const ensureValues = value.ensureValues || current.ensureValues;
  if (ensureValues && count < ensureValues) {
    return 0;
  }
  return count;
}

// adds uncategorized field
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
  addUndefined(current, asyncValues); // modifies values
  const values = asyncValues.map(v => _.extend(v, { _id: JSON.stringify(v.selector || v.query) }));
  values.forEach((val) => {
    if (!val._id) {
      val._id = JSON.stringify(val.query || val.selector);
    }
  });
  this.values.set(values);
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

  this.currentOrder = this.data.aspects;
  this.grouping = _.compact((this.data.groupChain).map(gcf => this.data.groupableFields.find(gc => gc.field === gcf)))[0];
  const groupChain = this.data.groupChain.slice(0);
        groupChain.shift();
  this.groupChain = new ReactiveVar(groupChain);
  this.nestedGrouping = new ReactiveDict();
  this.nestedOrder = new ReactiveDict();

  getCustom(this.data.customTableSpec.custom, this.data.tableId, (custom) => {
    this.custom.set(custom);
  });

  // looks for grouping fot nested tables
  this.autorun(() => {
    const data = Template.currentData();
    const values = this.values.get();
    if (values.length) {
      values.forEach(value => {
        const nestedTableId = data.customTableSpec.id + getTableIdSuffix.call(this, value);
        getCustom(data.customTableSpec.custom, nestedTableId, (custom) => {
          /*------------------------------------------------------
          / FIX ME!
          /   Need to find way to identify if custom is received
          /   from nested table or parent
          /*-----------------------------------------------------*/
          if (! custom.tableId) {
            if(custom.groupChainFields) {
              this.nestedGrouping.set(nestedTableId, custom.groupChainFields);
            }
            if (custom.order) {
              this.nestedOrder.set(nestedTableId, custom.order);
            }
          }
        });
      });
    }
  });

  this.autorun(() => {
    const data = Template.currentData();
    if (JSON.stringify(lastGroupChain) !== JSON.stringify(data.groupChain)) {
      this.enabled.destroy();
      this.stickyEnabled.destroy();
    }
    lastGroupChain = data.groupChain;
  });

  const distinctValuesSub = new ReactiveVar();
  this.autorun(() => {
    const data = Template.currentData();
    const current = this.grouping; // current grouping
    const countWithDistinct = false;//current.count && !current.values; NOTE: can't figure out how to handle the ability to mutate the list in transform.
    let values = [];
    if (_.isArray(current.values)) {
      values = current.values.slice(0, current.values.length);
      addUndefined(current, values); // modifies values
      values.forEach((val) => {
        if (!val._id) {
          val._id = JSON.stringify(val.query || val.selector);
        }
      });
      this.values.set(values);
    }
    else if (current.values) {
      values = current.values(data.selector);
      values = values.slice(0, values.length);
      addUndefined(current, values); // modifies values
      values.forEach((val) => {
        if (!val._id) {
          val._id = JSON.stringify(val.query || val.selector);
        }
      });
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
        distinctValuesSub.set(this.subscribe(
          "__dynaicTableDistinctValuesForField",
          data.customTableSpec.id + getTableIdSuffix.call(this),
          data.customTableSpec.table.publication,
          current.valuesField || current.field,
          data.selector,
          current.distinctOptions || {},
          countWithDistinct
        ));
      }
    }
  });

  // counting number of elements in each group
  this.autorun(() => {
    const sub = distinctValuesSub.get();
    const data = Template.currentData();
    const current = this.grouping;
    if (sub && sub.ready()) {
      const loading = Tracker.nonreactive(() => this.loading.get());
      delete loading.distinctValues;
      this.loading.set(loading);
      const distinctValues = (this.distinctValues.findOne({ _id: data.customTableSpec.id + getTableIdSuffix.call(this) }) || { groups: [] }).groups.map(v => v.value);
      processDistinctValues.call(this, current, distinctValues);
    }
  });

  this.autorun(() => {
    const data = Template.currentData();
    const current = this.grouping;
    const values = this.values.get();
    if (data.expandAll) {
      values.forEach((v, index) => {
        this.enabled.set(v._id, true);
        this.stickyEnabled.set(v._id, true);
      });
    }
    // counts number of records in a group
    const valuesToCount = values.filter(v => v.ensureValues || v.count === true || (v.count === undefined && current.count === true) || (v.ensureValues === undefined && current.ensureValues));
    // if online and there's a publication
    if (Tracker.nonreactive(() => Meteor.status().status !== "offline") && data.customTableSpec.table.publication) {
      const ids = valuesToCount.map(value => ({ tableId: this.data.customTableSpec.id + getTableIdSuffix.call(this, value), resultId: JSON.stringify(value.query).replace(/[\{\}.:]/g, "") }));
      const count = this.groupInfo.findOne({ _id: data.customTableSpec.id + getTableIdSuffix.call(this) });
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
        this.counts.set(this.data.customTableSpec.id + getTableIdSuffix.call(this, value), count);
      });
    }
  });
  const groupCountsSub = new ReactiveVar();

  // I think it triggers on values
  this.autorun(() => {
    const data = Template.currentData();
    const current = this.grouping;
    const values = this.values.get();
    const currentSelector = data.selector;
    const countWithDistinct = false;//current.count && !current.values;
    if (!countWithDistinct && Tracker.nonreactive(() => Meteor.status().status !== "offline" && data.customTableSpec.table.publication)) {
      const loading = Tracker.nonreactive(() => this.loading.get());
      loading.countValues = true;
      this.loading.set(loading);
      groupCountsSub.set(this.subscribe(
        "__dynamicTableGroupCounts",
        data.customTableSpec.id + getTableIdSuffix.call(this),
        data.customTableSpec.table.publication,
        current.field,
        currentSelector,
        values.filter(v => v.ensureValues || v.count === true || (v.count === undefined && current.count === true) || (v.ensureValues === undefined && current.ensureValues))
        .map(v => ({ options: { limit: v.ensureValues || (v.ensureValues === undefined && current.ensureValues) }, query: v.query })),
        current.countOptions || current.options || {}
      ));
    }
  });

  // on groupCountsSub ready
  this.autorun(() => {
    const sub = groupCountsSub.get();
    if (sub && sub.ready()) {
      const loading = Tracker.nonreactive(() => this.loading.get());
      delete loading.countValues;
      this.loading.set(loading);
    }
  });
});

Template.dynamicTableGroup.onRendered(function onRendered() {
  // opens groups
  this.autorun(() => {
    const values = this.values.get();
    const custom = this.custom.get();
    Tracker.afterFlush(() => {
      if (custom) {
        values.forEach((value, index) => {
          const tableId = this.data.customTableSpec.id + getTableIdSuffix.call(this, value);
          if (custom.openGroups && custom.openGroups.includes(tableId)) {
            this.stickyEnabled.set(value._id, true);
            this.enabled.set(value._id, true);
          }
        });
      }
    });
  });
});

Template.dynamicTableGroup.helpers({
  myid() { // for debugging only
    return Template.instance().data.tableId;
  },
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
    const current = Template.instance().grouping;
    const values = Template.instance().values.get().filter(value => shouldDisplaySection.call(Template.instance(), current, value));
    return values.length;
  },
  shouldDisplaySection(value) {
    const current = Template.instance().grouping;
    return shouldDisplaySection.call(Template.instance(), current, value);
  },
  hasCount(value) {
    const current = Template.instance().grouping;
    return value.count || (value.count === undefined && current.count);
  },
  count(value) {
    const tableId = this.customTableSpec.id + getTableIdSuffix.call(Template.instance(), value);
    return Template.instance().counts.get(tableId);
  },
  shouldDisplayContent(valueId) {
    return !this.lazy || Template.instance().enabled.get(valueId);
  },
  shouldDisplayTable(valueId) {
    return !this.lazy || Template.instance().stickyEnabled.get(valueId);
  },
  newSelector(value, currentSelector) {
    const current = Template.instance().grouping;
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
    const tableIdSuffix = getTableIdSuffix.call(Template.instance(), value);
    return _.extend(
      {},
      this.customTableSpec,
      { selector: newSelector, id: this.customTableSpec.id + tableIdSuffix }
    );
  },
  lastLevel() {
    return !Template.instance().groupChain.get().length;
  },
  nextIndex() {
    return this.index + 1;
  },
  currentGroupLabel() {
    return Template.instance().grouping.label;
  },
  currentGroupValues() {
    return Template.instance().values.get();
  },
  tableIdSuffixChain(value) {
    const current = Template.instance().grouping;
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
  },
  tableId(value){
    const tableId = this.customTableSpec.id + getTableIdSuffix.call(Template.instance(), value);
    return tableId;
  },
  advanced(option) {
    const advanced = {
      ordering: true,
      grouping: true,
      columning: true
    }

    return advanced[option];
  },
  groupChain(tableId) {
    const data = Template.currentData();
    const nestedGroupChain = Template.instance().nestedGrouping.get(tableId) || []
    const groupChain = nestedGroupChain.length ? nestedGroupChain : Template.instance().groupChain.get();
    return groupChain;
  },
  hasGrouping(tableId) {
    const nestedGroupChain = Template.instance().nestedGrouping.get(tableId);
    const groupChain = nestedGroupChain && nestedGroupChain.length ? nestedGroupChain : Template.instance().groupChain.get();
    return groupChain && groupChain.length
  }
});

Template.dynamicTableGroup.events({
  "click .dynamic-table-header"(e, templInstance) {
    e.stopImmediatePropagation(); // QUESTION: why is this required? Without it this event handler gets called multiple times
    if (e.target != e.currentTarget) {
      return
    }
    const valueId = $(e.currentTarget).attr("data-table-id");

    let open = false;
    if (templInstance.enabled.get(valueId)) {
      open = false;
    }
    else {
      open = true;
      templInstance.stickyEnabled.set(valueId, true);
    }
    templInstance.enabled.set(valueId, open);

    const values = templInstance.values.get();
    const value = values.find(v => v._id === valueId);
    const tableId = templInstance.data.customTableSpec.id + getTableIdSuffix.call(Template.instance(), value);
    let custom = templInstance.custom.get();
    if (!custom) {
      custom = {};
    }
    if (!custom.openGroups) {
      custom.openGroups = [];
    }
    const indexInList = custom.openGroups.indexOf(tableId);
    if (!open && indexInList !== -1) {
      custom.openGroups.splice(indexInList, 1);
    }
    else if (open) {
      custom.openGroups.push(tableId);
    }
    changed(templInstance.data.customTableSpec.custom, tableId, { changeOpenGroups: { [tableId]: open } });
  },
  "click .dynamic-table-manage-controller.aspects"(e, templInstance) {
    const target = e.currentTarget;

    const valueId = $(target).attr("data-table-id");
    const values = templInstance.values.get();
    const value = values.find(v => v._id === valueId);
    const tableId = templInstance.data.customTableSpec.id + getTableIdSuffix.call(templInstance, value);

    const order = templInstance.nestedOrder.get(tableId) || [];

    const modalMeta = {
      template: Template.dynamicTableManageAspectsModal,
      id: "dynamic-table-manage-aspects-modal",
      options: {
        availableColumns: templInstance.data.groupableFields,
        aspects: order,
        changeCallback(aspects) {
          // templInstance.nestedOrder.set(tableId, aspects);
          changed(templInstance.data.customTableSpec.custom, tableId, { newOrder: aspects });
        }
      }
    };
    createModal(target, modalMeta, templInstance);
  },
  "click .dynamic-table-manage-controller.groups"(e, templInstance) {
    const target = e.currentTarget;

    const valueId = $(target).attr("data-table-id");
    const values = templInstance.values.get();
    const value = values.find(v => v._id === valueId);
    const tableId = templInstance.data.customTableSpec.id + getTableIdSuffix.call(templInstance, value);

    const nestedGrouping = templInstance.nestedGrouping.get(tableId);
    const grouping = nestedGrouping && nestedGrouping.length ? nestedGrouping : Template.instance().groupChain.get();

    const modalMeta = {
      template: Template.dynamicTableManageGroupFieldsModal,
      id: "dynamic-table-manage-group-fields-modal",
      options: {
        availableColumns: templInstance.data.groupableFields,
        selectedColumns: grouping,
        changeCallback(newGroupChain) {
          const myGroupChain = templInstance.groupChain.get().slice(0); // ?
          templInstance.groupChain.set([]);
          templInstance.nestedGrouping.set(tableId, []);
          Meteor.setTimeout(() => {
            templInstance.nestedGrouping.set(tableId, newGroupChain);
            templInstance.groupChain.set(myGroupChain);
          }, 0)
          changed(templInstance.data.customTableSpec.custom, tableId, { newGroupChainFields: newGroupChain });
        }
      }
    };
    createModal(target, modalMeta, templInstance);
  },
  "click .dynamic-table-manage-controller.columns"(e, templInstance) {
    /**
        TODO:
          Hide/Show Modal
    */
  },
  "click .console-log-grouping-and-selector"(e, templInstance) { // for debugging only
    console.log(templInstance)
  }
});
