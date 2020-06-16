import { ReactiveDict } from "meteor/reactive-dict";
import { EJSON } from "meteor/ejson";
import "./dynamicTableGroup.html";
import "./dynamicTableGroup.css";
import { getGroupedInfoCollection, getDistinctValuesCollection } from "../../../db.js";
import { changed, getCustom, getColumns, getValue, createModal } from "../../../inlineSave.js";
import { getNestedTableIds, selectorToId, getTableIdSuffix, formatQuery, getQueryFields, arraysEqual } from "../../helpers.js"

import "../manageGroupFieldsModal/manageGroupFieldsModal.js";
import "../manageOrderModal/manageOrderModal.js";
import "../manageFieldsModal/manageFieldsModal.js";

function openFiltersModal(templateInstance, tableId) {
  const customTableSpec = templateInstance.data.customTableSpec;
  Modal.show("dynamicTableFiltersModal", {
    collection: customTableSpec.table.collection,
    columns: _.isFunction(templateInstance.data.columns) ? templateInstance.data.columns() : customTableSpec.columns(),
    filter: templateInstance.currentFilters.get(tableId),
    parentFilters: templateInstance.parentFilters.get(),
    triggerUpdateFilter: newQuery => {

      // We'll update the filter in the values array to trigger re-calculation of the table count.
      const values = templateInstance.values.get();
      const value = values.find(value => value.tableId === tableId);
      if(value) {
        value.filter = newQuery;
        templateInstance.values.set(values);
      }

      const currentFilter = templateInstance.currentFilters.get(tableId);
      currentFilter.query = newQuery;
      templateInstance.currentFilters.set(tableId, currentFilter);
      changed(customTableSpec.custom, tableId, { newFilter: newQuery });
    }
  });
}

// returns true if a given filter is valid with its parent. The filter is invalid if any columns in the filter
// share columns with its parent or if the parent filter uses an OR group.
function isFilterValid(templateInstance, filter) {
  if(!_.keys(filter || {}).length) {
    return true;
  }
  const parentFilters = templateInstance.parentFilters.get();

  // Using for loops so we can return as soon as the filter is invalid.
  for(let i = 0; i < parentFilters.length; i++) {
    const parentFilter = parentFilters[i];

    // No filter is valid if its parent has multiple OR groups.
    if(parentFilter.query && parentFilter.query.$or && parentFilter.query.$or.length > 1) {
      return false;
    }

    // Get the fields for the parent filter's first OR group 
    const filterFields = getQueryFields(formatQuery(filter).$or[0].$and);
    const parentFilterFields = getQueryFields(formatQuery(parentFilter.query).$or[0].$and);

    for(let h = 0; h < filterFields.length; h++) {
      if(_.contains(parentFilterFields, filterFields[h])) {
        return false;
      }
    }
  }

  return true;
}

/** @this = template instance */
function shouldDisplaySection(current, value) {
  if (value.alwaysShow || (value.alwaysShow === undefined && current.alwaysShow)) {
    return true;
  }
  if (!value.count && !current.count && !value.ensureValues && !current.ensureValues) {
    return true;
  }
  const tableId = this.data.tableId + getTableIdSuffix.call(Template.instance(), value);
  const count = Template.instance().counts.get(tableId);
  const ensureValues = value.ensureValues || current.ensureValues;
  if (ensureValues && count < ensureValues) {
    return 0;
  }
  return count;
}

// adds uncategorized field
function getUncategorized(current, values) {
  const queries = values.map(v => v.query);
  let negation;
  if (queries.length && _.isObject(queries[0])) {
    negation = { $nor: queries.map(q => ({ [current.field]: q })) };
  }
  else {
    negation = { $not: { $in: queries } };
  }

  if (_.isObject(current.undefined)) {
    return {
      label: current.undefined.label || "Uncategorized",
      query: current.undefined.query || negation,
      selector: current.undefined.selector,
      count: current.undefined.count === undefined ? current.count : current.undefined.count,
      alwaysShow: current.undefined.alwaysShow || current.alwaysShow
    };
  }
  else if (current.undefined) {
    return {
      label: current.undefined === true ? "Uncategorized" : current.undefined,
      query: negation,
      count: current.count,
      alwaysShow: current.alwaysShow
    };
  }
}

function processDistinctValues(current, distinctValues) {
  const asyncValues = current.transformDistinctValues ? current.transformDistinctValues(distinctValues) : distinctValues.map(v => ({ label: v, query: v }));
  const uncategorized = getUncategorized(current, asyncValues);
  if (uncategorized) {
    asyncValues.push(uncategorized);
  }
  const values = asyncValues.map(v => _.extend(v, { _id: JSON.stringify(v.selector || v.query) }));
  values.forEach((val) => {
    val.tableId = this.data.tableId + getTableIdSuffix.call(Template.instance(), val);
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
  this.custom = new ReactiveVar(this.data.custom);

  this.grouping = this.data.groupableFields.find(gf => gf.field === _.first(this.data.groupChain)); // the critirea which current group was grouped by
  this.groupChain = new ReactiveVar(_.rest(this.data.groupChain)); // inherited groupchain excluding current grouping
  this.orders = new ReactiveVar(this.data.orders); // current ordering
  this.columns = new ReactiveVar(this.data.columns); // current columns

  this.nestedGrouping = new ReactiveDict(); // set of groupchains for nested tables
  this.nestedOrder = new ReactiveDict();    // set of orders for nested tables
  this.nestedColumns = new ReactiveDict();  // set of columns for nested tables
  this.advancedSearch = new ReactiveDict(); // set of advancedSearches for each group

  // Current filters hold all the filters at the current level. E.g. if the grouping was state, you could have current filters
  // for ON and AB.
  this.currentFilters = new ReactiveDict();

  // Holds the chain of parent filters. Ordered top down.
  this.parentFilters = new ReactiveVar([]);

  // needed for passing number of page and number of records per page
  this.nestedCustoms = new ReactiveDict();  // set of custom table specs for nested tables

  this.highlightedColumns = new ReactiveDict();

  // reactivity to refresh tables when goups/orders/columns are changed
  const groupChain = new ReactiveVar(this.data.groupChain);
  this.autorun(() => {
    const data = Template.currentData();

    // Update the chain of parent filters if they change.
    this.parentFilters.set(data.parentFilters);
    if (JSON.stringify(Tracker.nonreactive(() => this.columns.get())) !== JSON.stringify(data.columns)) {
      this.columns.set(data.columns);
    }
    if (JSON.stringify(Tracker.nonreactive(() => this.orders.get())) !== JSON.stringify(data.orders)) {
      this.orders.set(data.orders);
    }
    if (JSON.stringify(Tracker.nonreactive(() => groupChain.get())) !== JSON.stringify(data.groupChain)) {
      groupChain.set(data.groupChain);
      this.groupChain.set(_.rest(data.groupChain));
      this.grouping = data.groupableFields.find(gf => gf.field === _.first(data.groupChain));
    }
  });

  const distinctValuesSub = new ReactiveVar();

  // triggers when context data sets
  // loads values
  this.autorun(() => {
    const data = Template.currentData();
    const current = this.grouping;
    const countWithDistinct = false; //current.count && !current.values; NOTE: can't figure out how to handle the ability to mutate the list in transform.
    if (current.values) {
      const values = (_.isArray(current.values) ? current.values : current.values(data.selector)).slice(0);
      const uncategorized = getUncategorized(current, values);
      if (uncategorized) {
        values.push(uncategorized);
      }
      values.forEach((val) => {

        // Store the tableId on the value so it doesn't have to be generated every time it's needed.
        val.tableId = this.data.tableId + getTableIdSuffix.call(Template.instance(), val);
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
          data.tableId + getTableIdSuffix.call(this),
          data.customTableSpec.table.publication,
          current.valuesField || current.field,
          data.selector,
          current.distinctOptions || {},
          countWithDistinct
        ));
      }
    }
  });

  // triggers when values are set
  // looks for grouping fot nested tables
  this.autorun(() => {
    const data = Template.currentData();
    const values = this.values.get();
    if (values.length) {
      values.forEach(value => {
        getCustom(data.customTableSpec.custom, value.tableId, (custom) => {
          this.nestedCustoms.set(value.tableId, custom);

          // This is done once on initialization.
          if(!this.nestedColumns.get(value.tableId)) {

            // Columns can't be changed at the leaf level.
            if (custom.columns && !custom.groupChainFields) {
              if (custom.columns.length && !arraysEqual(this.data.columns, custom.columns, column => column.id + column.data)) {
                this.nestedColumns.set(value.tableId, custom.columns);
                this.highlightedColumns.set(value.tableId, true);
              } else {
                this.nestedColumns.set(value.tableId, this.data.columns);
              }
            } else {
              this.nestedColumns.set(value.tableId, this.data.columns);
            }
          }
          if (! custom.root) {
            if (custom.groupChainFields) {
              this.nestedGrouping.set(value.tableId, custom.groupChainFields);
            }
            if (custom.order && custom.order.length) {
              this.nestedOrder.set(value.tableId, custom.order);
            }
          }
          let filter = custom.filter ? EJSON.fromJSONValue(JSON.parse(custom.filter)) : {};
          if(!isFilterValid(this, filter)) {

            // If the filter is invalid save it as an empty filter right away. It can become
            // invalid if a parent filter is changed while this filter currently exists.
            // Parent filters always take priority.
            value.filter = {}
            changed(data.customTableSpec.custom, value.tableId, { newFilter: {} })
          } else {
            value.filter = filter
          }

          // Initially, the callback used to open the filters modal was stored here.
          // A property that is a function is omitted for reactive dictionaries, 
          // so we don't add the callback until the current filter is passed to
          // a child table or group.
          this.currentFilters.set(value.tableId, {
            label: value.label,
            query: value.filter
          });
        });
      });
    }
  });
  
  // If a parent updates its column selection, we want that propagated to nested tables if
  // columns haven't been changed in nested tables.
  this.autorun(() => {
    const columns = Template.currentData().columns;
    const values = Tracker.nonreactive(() => this.values.get());

    // If columns haven't been changed and the current columns don't match the columns from the parent,
    // update the nested columns.
    if(values.length) {
      values.forEach(value => {

        // We don't want this to trigger if the nested columns changes.
        const nestedColumns = Tracker.nonreactive(() => this.nestedColumns.get(value.tableId));
        if(nestedColumns) {
          const columnsEqual = arraysEqual(columns, nestedColumns, val => val.id + val.data);
          if(!this.highlightedColumns.get(value.tableId) && !columnsEqual) {
            this.nestedColumns.set(value.tableId, _.clone(columns));
            changed(this.data.customTableSpec.custom, value.tableId, { newColumns: columns });
          } else if(columnsEqual) {
            // If the columns are equal (because the parent changed columns to match the nested table)
            // We can take away the highlighting for the button.
            this.highlightedColumns.set(value.tableId);
          }
        }
      });
    }
  });

  // processed when distinctValuesSub is ready
  // sets values
  this.autorun(() => {
    const sub = distinctValuesSub.get();
    const data = Template.currentData();
    const current = this.grouping;
    if (sub && sub.ready()) {
      const loading = Tracker.nonreactive(() => this.loading.get());
      delete loading.distinctValues;
      this.loading.set(loading);
      const distinctValues = (this.distinctValues.findOne({ _id: data.tableId + getTableIdSuffix.call(this) }) || { groups: [] }).groups.map(v => v.value);
      processDistinctValues.call(this, current, distinctValues);
    }
  });

  // triggers when values are set
  // counts number of records in each group
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
    const valuesToCount = values.filter(v => v.ensureValues || v.count === true || (v.count === undefined && current.count === true) || (v.ensureValues === undefined && current.ensureValues));
    // if online and there's a publication
    if (Tracker.nonreactive(() => Meteor.status().status !== "offline") && data.customTableSpec.table.publication) {
      const ids = valuesToCount.map(value => ({ tableId: this.data.tableId + getTableIdSuffix.call(this, value), resultId: JSON.stringify(value.query || "").replace(/[\{\}.:]/g, "") }));
      const count = this.groupInfo.findOne({ _id: data.tableId + getTableIdSuffix.call(this) });
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
        this.counts.set(this.data.tableId + getTableIdSuffix.call(this, value), count);
      });
    }
  });
  const groupCountsSub = new ReactiveVar();

  // triggers when values are set
  // does groupCountsSub
  this.autorun(() => {


    const data = Template.currentData();
    const current = this.grouping;
    const values = this.values.get().filter(v => v.ensureValues || v.count === true || (v.count === undefined && current.count === true) || (v.ensureValues === undefined && current.ensureValues));
    const currentSelector = data.selector;
    const countWithDistinct = false; //current.count && !current.values;
    if (!countWithDistinct && Tracker.nonreactive(() => Meteor.status().status !== "offline" && data.customTableSpec.table.publication)) {
      const loading = Tracker.nonreactive(() => this.loading.get());
      loading.countValues = true;
      this.loading.set(loading);
      groupCountsSub.set(this.subscribe(
        "__dynamicTableGroupCounts",
        data.tableId + getTableIdSuffix.call(this),
        data.customTableSpec.table.publication,
        current.field,
        currentSelector,
        values.map(v => ({ options: { limit: v.ensureValues || (v.ensureValues === undefined && current.ensureValues) }, query: v.query, filter: v.filter })),
        current.countOptions || current.options || {},

        // All filters include their parent filters.
        this.parentFilters.get().map(filter => filter.query)
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
          const tableId = this.data.tableId + getTableIdSuffix.call(this, value);
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
    return Template.instance().counts.get(value.tableId);
  },
  shouldDisplayContent(valueId) {
    return !this.lazy || Template.instance().enabled.get(valueId);
  },
  shouldDisplayTable(valueId) {
    return !this.lazy || Template.instance().stickyEnabled.get(valueId);
  },
  newSelector(value, currentSelector) {
    const advancedSearch = Template.instance().advancedSearch.get(value.tableId) || {};
    const current = Template.instance().grouping;
    const conditions = [];
    let selector = {};
    if(_.keys(currentSelector || {}).length) {
      conditions.push(currentSelector);
    }
    if (value.selector) {
      conditions.push(value.selector);
    }
    else if (value.query.$nor) {
      conditions.push(value.query);
    }
    else {
      conditions.push({
        [current.field]: value.query
      });
    }
    if(_.keys(advancedSearch || {}).length) {
      conditions.push(advancedSearch);
    }
    if(conditions.length == 1) {
      selector = conditions[0];
    } else if(conditions.length > 0) {
      selector = {
        $and: conditions
      }
    }
    return selector;
  },
  table(value, newSelector) {
    const templInstance = Template.instance();
    let parentFilters = templInstance.parentFilters.get();
    let currentFilter = templInstance.currentFilters.get(value.tableId);

    // Functions don't get stored in reactive dictionaries so set the filters modal callback here.
    currentFilter.triggerOpenFiltersModal = () => openFiltersModal(templInstance, value.tableId);

    return _.extend(
      {},
      this.customTableSpec,
      {
        hasContext: false,
        selector: newSelector,
        parentFilters,
        currentFilter: currentFilter,
        updateCurrentFilter: newFilter => {
          currentFilter.query = newFilter;
          templInstance.currentFilters.set(value.tableId, currentFilter);
        },
        id: value.tableId,
        orders: templInstance.nestedOrder.get(value.tableId) || templInstance.orders.get(),
        selectedColumns: templInstance.nestedColumns.get(value.tableId) || templInstance.columns.get(),
        parentTableCustom: templInstance.nestedCustoms.get(value.tableId) || this.custom
      }
    );
  },
  currentGroupLabel() {
    return Template.instance().grouping.label;
  },
  currentGroupValues() {
    const templInstance = Template.instance();
    const order = templInstance.orders.get()[0] || {};
    const grouping = templInstance.grouping;
    const values = templInstance.values.get();
    if (grouping.field === order.data || grouping.valuesField === order.data && values.length) {
      const uncategorized = _.last(values);
      const sortable = _.without(values, uncategorized);
      const operator = order.order === "desc" ? -1 : 1;
      // if we sure that values are sorted by default then sort function may be replaced with .reversed.
      return _.compact(_.union(sortable.sort((a, b) => a.label > b.label ? operator : b.label > a.label ? -1 * operator : 0), uncategorized));
    }
    return values.map(val => {
      val.label = (val.label || "").toString();
      return val;
    });
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
    /* this is data context */
    return value.tableId;
  },
  advancedControl(option) {
    if (! this.advanced || !this.advanced[option]) {
      return false;
    }

    if (Template.instance().groupChain.get().length) {
      return this.advanced[option].branch;
    }
    else {
      return this.advanced[option].leaf;
    }
  },
  groupChain(tableId) {
    const nestedGroupChain = Template.instance().nestedGrouping.get(tableId) || [];
    const groupChain = nestedGroupChain.length ? nestedGroupChain : Template.instance().groupChain.get();
    return groupChain;
  },
  hasGrouping(tableId) {
    const nestedGroupChain = Template.instance().nestedGrouping.get(tableId);
    const groupChain = nestedGroupChain && nestedGroupChain.length ? nestedGroupChain : Template.instance().groupChain.get();
    return groupChain && groupChain.length;
  },
  grouped(tableId) {
    const nestedGroupChain = Template.instance().nestedGrouping.get(tableId) || [];
    return nestedGroupChain.length;
  },
  ordered(tableId) {
    return Template.instance().nestedOrder.get(tableId);
  },
  columned(tableId) {
    return Template.instance().highlightedColumns.get(tableId);
  },
  hasFilters(tableId) {
    return _.keys(Template.instance().currentFilters.get(tableId).query || {}).length;
  },
  orders(tableId) {
    const nestedOrder = Template.instance().nestedOrder.get(tableId);
    const ownOrder = Template.instance().orders.get();
    return nestedOrder || ownOrder;
  },
  columns(tableId) {
    const nestedColumns = Template.instance().nestedColumns.get(tableId);
    const ownColumns = Template.instance().columns.get();
    return nestedColumns || ownColumns;
  },
  custom(tableId) {
    return Template.instance().nestedCustoms.get(tableId) || this.custom;
  },
  orderCheckFn() {
    return this.orderCheckFn;
  },
  parentFilters(value) {
    const templateInstance = Template.instance();
    let currentFilter = templateInstance.currentFilters.get(value.tableId);

    // Functions don't get stored in reactive dictionaries so set the filters modal callback here.
    currentFilter.triggerOpenFiltersModal = () => openFiltersModal(templateInstance, value.tableId);

    let parentFilters = templateInstance.parentFilters.get();
    if(_.keys(currentFilter.query || {}).length) {
      return [...parentFilters, currentFilter];
    }
    return parentFilters;
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
    const tableId = templInstance.data.tableId + getTableIdSuffix.call(templInstance, value);
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
  "click .dynamic-table-manage-controller.orders"(e, templInstance) {
    const target = e.currentTarget;
    const tableId = $(target).attr("data-table-id");
    const order = templInstance.nestedOrder.get(tableId) || templInstance.data.orders;
    const availableColumns = getColumns(templInstance.data.customTableSpec.columns).filter(c => c.sortable !== false);
    const modalMeta = {
      template: Template.dynamicTableManageOrderModal,
      id: "dynamic-table-manage-orders-modal",
      options: {
        availableColumns,
        order: order,
        changeCallback(orders) {
          if (templInstance.data.orderCheckFn(orders, availableColumns)) {
            if (orders.length) {
              templInstance.nestedOrder.set(tableId, orders);
            }
            else {
              templInstance.nestedOrder.delete(tableId);
            }
            changed(templInstance.data.customTableSpec.custom, tableId, { newOrder: orders });
          }
        }
      }
    };
    createModal(target, modalMeta, templInstance);
  },
  "click .dynamic-table-manage-controller.groups"(e, templInstance) {
    const target = e.currentTarget;
    const tableId = $(target).attr("data-table-id");

    const nestedGrouping = templInstance.nestedGrouping.get(tableId);
    const grouping = nestedGrouping && nestedGrouping.length ? nestedGrouping : Template.instance().groupChain.get();

    const modalMeta = {
      template: Template.dynamicTableManageGroupFieldsModal,
      id: "dynamic-table-manage-group-fields-modal",
      options: {
        availableColumns: templInstance.data.groupableFields,
        selectedColumns: grouping,
        changeCallback(newGroupChain) {
          templInstance.nestedGrouping.set(tableId, newGroupChain);
          changed(templInstance.data.customTableSpec.custom, tableId, { newGroupChainFields: newGroupChain });
        }
      }
    };
    createModal(target, modalMeta, templInstance);
  },
  "click .dynamic-table-manage-controller.columns"(e, templInstance) {
    const target = e.currentTarget;
    const tableId = $(target).attr("data-table-id");
    const compressedColumns = _.clone(templInstance.nestedColumns.get(tableId) || templInstance.columns.get());
    const selectedColumns = _.compact(compressedColumns.map(c => _.find(getColumns(templInstance.data.customTableSpec.columns) || [], c1 => c1.id ? c1.id === c.id : c1.data === c.data)));

    const manageColumnsOptions = _.extend({
      availableColumns: getColumns(templInstance.data.customTableSpec.columns),
      selectedColumns: selectedColumns,
      tableData: templInstance.data,
      clearColumnsCallback() {
        const columns = _.clone(templInstance.data.columns);
        templInstance.nestedColumns.set(tableId, columns);
        templInstance.highlightedColumns.set(tableId);
        changed(templInstance.data.customTableSpec.custom, tableId, { newColumns: [] });

        return columns;
      },
      changeCallback(column, add) {
        let unsetField = false;
        const columns = compressedColumns;
        if (add) {
          columns.push(column);
        }
        else {
          const actualColumn = columns.find((col) => {
            if (column.id) {
              return column.id === col.id;
            }
            return column.data === col.data;
          });
          if (!actualColumn) {
            return;
          }
          columns.splice(columns.indexOf(actualColumn), 1);
        }
        changed(templInstance.data.customTableSpec.custom, tableId, { newColumns: columns, unset: unsetField });
        templInstance.nestedColumns.set(tableId, columns);
        templInstance.highlightedColumns.set(tableId, !arraysEqual(columns, templInstance.data.columns, val => val.id + val.data));
      }
    }, templInstance.data.manageFieldsOptions || {});

    if (manageColumnsOptions.edit) {
      manageColumnsOptions.edit.addedCallback = (columnSpec) => {
        if (!_.isFunction(templInstance.data.columns)) {
          templInstance.data.columns.push(columnSpec);
        }
        manageColumnsOptions.changeCallback(columnSpec, true);
      };
      manageColumnsOptions.edit.editedCallback = (columnSpec, prevColumnSpec) => {
        if (!_.isFunction(templInstance.data.columns)) {
          const realColumn = templInstance.data.columns.find(c => (columnSpec.id ? c.id === columnSpec.id : c.data === columnSpec.data));
          templInstance.data.columns.splice(templInstance.data.columns.indexOf(realColumn), 1, columnSpec);
        }
        const columns = templInstance.$("table").dataTable().api().context[0].aoColumns;
        const actualColumn = columns.find(c => (columnSpec.id ? c.id === columnSpec.id : c.data === columnSpec.data));
        if (actualColumn) {
          if (actualColumn.nTh) {
            actualColumn.nTh.innerHTML = actualColumn.nTh.innerHTML.split(actualColumn.title).join(columnSpec.title);
          }
          actualColumn.title = columnSpec.label || columnSpec.title;
          if (actualColumn.filterModal && actualColumn.filterModal.field) {
            actualColumn.filterModal.field.label = actualColumn.title;

            if (actualColumn.filterModal.field.edit && actualColumn.filterModal.field.edit.spec) {
              actualColumn.filterModal.field.edit.spec.label = actualColumn.title;
            }
          }
        }
      };
    }

    const modalMeta = {
      template: Template.dynamicTableManageFieldsModal,
      id: "dynamic-table-manage-fields-modal",
      options: manageColumnsOptions
    };

    createModal(target, modalMeta,templInstance);
  },
  "click .dynamic-table-manage-controller.filters"(e) {
    openFiltersModal(Template.instance(), $(e.currentTarget).attr("data-table-id"));
  }
});
