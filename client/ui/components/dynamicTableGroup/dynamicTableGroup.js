import { ReactiveDict } from "meteor/reactive-dict";
import "./dynamicTableGroup.html";
import "./dynamicTableGroup.css";
import { getGroupedInfoCollection, getDistinctValuesCollection } from "../../../db.js";
import { changed, getCustom, getValue, getPosition } from "../../../inlineSave.js";

import "../manageGroupFieldsModal/manageGroupFieldsModal.js";

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
  const current = this.groupedByField;

  const selector = {};
  if (value && value.query.$nor) {
    selector.$and = [value.query];
  }
  else if (value) {
    selector[current.field] = value.query;
  }
  const nextSuffix = value && selectorToId(selector, value.tableIdSuffix);

  const nextParts = (this.data.tableIdSuffixChain || []).slice(0);
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
  const tableId = this.data.customTableSpec.id + getTableIdSuffix.call(this, value);
  const count = Template.instance().counts.get(tableId);
  const ensureValues = value.ensureValues || current.ensureValues;
  if (ensureValues && count < ensureValues) {
    return 0;
  }
  return count;
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

/** @this = template instance */
// function getCount(value, selector) {
//   const tableId = this.data.customTableSpec.id + getTableIdSuffix.call(this, value);
//   let count = value.count;
//   if (_.isFunction(value.count)) {
//     count = value.count(tableId, selector);
//   }
//   this.counts.set(tableId, count);
// }

Template.dynamicTableGroup.events({
  "click .dynamic-table-header"(e, templInstance) {
    e.stopImmediatePropagation(); // QUESTION: why is this required? Without it this event handler gets called multiple times
    if (e.target !== e.currentTarget) {
      return;
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
  "click .dynamic-table-manage-groups"(e, templInstance, extra) {
    e.preventDefault();
    const valueId = $(e.currentTarget).attr("data-table-id");
    const values = templInstance.values.get();
    const value = values.find(v => v._id === valueId);
    const tableId = templInstance.data.customTableSpec.id + getTableIdSuffix.call(templInstance, value);
    const currentGrouping = new ReactiveVar(null);
    const custom = templInstance.data.customTableSpec.custom(tableId, false, false, () => {});
    // won't be equal if tableSpec doesn't exist in db; it will return root tableSpec
    if (!custom.tableId || custom.tableId === tableId) {
      currentGrouping.set(templInstance.grouping.get(tableId));
    }
    const manageGroupFieldsOptions = {
      tableId,
      dynamicTableSpec: templInstance.data.customTableSpec,
      groupedBy: currentGrouping,
      changeCallback(groupedBy) {
        // Needed to reset reactiveVar to false and than true to trigger template refresh.
        // Timeout creates a new scope so the helper is called twice: 1 - value is null; 2 - value is grouping. It forces the Template to refresh
        templInstance.grouping.set(tableId, null)
        Meteor.setTimeout(() => {
          templInstance.grouping.set(tableId, groupedBy && groupedBy.field || null)
        }, 0);
        changed(templInstance.data.customTableSpec.custom, tableId, { groupedBy: groupedBy && groupedBy.field || null});
      }
    };
    const target = extra ? extra.target : e.currentTarget;
    const bounds = getPosition(target);
    const left = Math.max((bounds.left + $(target).outerWidth()) - 350, 0);
    const div = $("#dynamic-table-manage-group-fields-modal").length ? $("#dynamic-table-manage-group-fields-modal") : $("<div>");
    div.attr("id", "dynamic-table-manage-group-fields-modal")
    .html("")
    .css("position", "absolute")
    .css("top", bounds.top + $(target).outerHeight())
    .css("left", left);

    if (div[0].__blazeTemplate) {
      Blaze.remove(div[0].__blazeTemplate);
    }
    div[0].__blazeTemplate = Blaze.renderWithData(
      Template.dynamicTableManageGroupFieldsModal,
      manageGroupFieldsOptions,
      div[0]
    );
    document.body.appendChild(div[0]);
    const tooFar = (left + 350) - $(window).width();
    if (tooFar > 0) {
      div.css("left", (left - (tooFar + 5)) + "px");
    }
  }
});

Template.dynamicTableGroup.onRendered(function onRendered() {
  this.autorun(() => {
    const values = this.values.get();
    const openGroups = this.data.openGroups
    Tracker.afterFlush(() => {
      values.forEach((value, index) => {
        const tableId = this.data.customTableSpec.id + getTableIdSuffix.call(this, value);
        if (openGroups.includes(tableId)) {
          this.stickyEnabled.set(value._id, true);
          this.enabled.set(value._id, true);
        }
      });
    });
  });
});

Template.dynamicTableGroup.onCreated(function onCreated() {
  this.groupedBy = this.data.groupedBy; // criteria by which current table will be grouped; it's never null or undefined
  this.grouping = new ReactiveDict(); // criteria that will be passed to nested-table as groupedBy
  this.stickyEnabled = new ReactiveDict();
  this.enabled = new ReactiveDict();
  this.loading = new ReactiveVar({});
  this.counts = new ReactiveDict();
  this.values = new ReactiveVar([]);
  this.groupInfo = getGroupedInfoCollection(this.data.customTableSpec.table.collection._connection);
  this.distinctValues = getDistinctValuesCollection(this.data.customTableSpec.table.collection._connection);
  this.custom = new ReactiveVar();

  getCustom(this.data.customTableSpec.custom, this.data.tableId, (custom) => {
    this.custom.set(custom);
  });

  const distinctValuesSub = new ReactiveVar();

  this.autorun(() => {
    const data = Template.currentData();
    const groupedByField = data.groupableFields.find(f => f.field === this.groupedBy);
    this.groupedByField = groupedByField;
    const countWithDistinct = false;//current.count && !current.values; NOTE: can't figure out how to handle the ability to mutate the list in transform.
    let values = [];
    if (_.isArray(groupedByField.values)) {
      values = groupedByField.values.slice(0, groupedByField.values.length);
      addUndefined(groupedByField, values);
      values.forEach((val) => {
        if (!val._id) {
          val._id = JSON.stringify(val.query || val.selector);
        }
      });
      this.values.set(values);
    }
    else if (groupedByField.values) {
      values = groupedByField.values(data.selector);
      values = values.slice(0, values.length);
      addUndefined(groupedByField, values); // modifies values
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
          data.customTableSpec.table.collection
          .find(data.selector, { fields: { [groupedByField.valuesField || groupedByField.field]: 1 } })
          .map(i => getValue(i, groupedByField.valuesField || groupedByField.field))
        ));
        processDistinctValues.call(this, groupedByField, distinctValues);
      }
      else {
        distinctValuesSub.set(this.subscribe(
          "__dynaicTableDistinctValuesForField",
          data.customTableSpec.id + getTableIdSuffix.call(this),
          data.customTableSpec.table.publication,
          groupedByField.valuesField || groupedByField.field,
          data.selector,
          groupedByField.distinctOptions || {},
          countWithDistinct
        ));
      }
    }
  });

  // looks for grouping fot nested tables
  this.autorun(() => {
    const data = Template.currentData();
    const values = this.values.get();
    if (values.length) {
      values.forEach(value => {
        const nestedTableId = data.customTableSpec.id + getTableIdSuffix.call(this, value);
        getCustom(data.customTableSpec.custom, nestedTableId, (custom) => {
          if (!custom.tableId && custom.groupedBy) {
            this.grouping.set(nestedTableId, custom.groupedBy);
          }
        });
      })
    }
  })

  this.autorun(() => {
    const sub = distinctValuesSub.get();
    const data = Template.currentData();
    const current = this.groupedByField;
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
    const current = this.groupedByField;
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

  this.autorun(() => {
    const data = Template.currentData();
    const current = this.groupedByField;
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
  this.autorun(() => {
    const sub = groupCountsSub.get();
    if (sub && sub.ready()) {
      const loading = Tracker.nonreactive(() => this.loading.get());
      delete loading.countValues;
      this.loading.set(loading);
    }
  });
});

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
    const current = Template.instance().groupedByField;
    const values = Template.instance().values.get().filter(value => shouldDisplaySection.call(Template.instance(), current, value));
    return values.length;
  },
  shouldDisplaySection(value) {
    const current = Template.instance().groupedByField;
    return shouldDisplaySection.call(Template.instance(), current, value);
  },
  hasCount(value) {
    const current = Template.instance().groupedByField;
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
    const current = Template.instance().groupedByField;
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
  currentGroupLabel() {
    return Template.instance().groupedByField.label;
  },
  currentGroupValues() {
    return Template.instance().values.get();
  },
  tableIdSuffixChain(value) {
    const current = Template.instance().groupedByField;
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
  groupedBy(id) {
    return Template.instance().grouping.get(id) || null;
  },
  tableId(value) {
    const templInstance = Template.instance();
    return templInstance.data.customTableSpec.id + getTableIdSuffix.call(templInstance, value);
  }
});
