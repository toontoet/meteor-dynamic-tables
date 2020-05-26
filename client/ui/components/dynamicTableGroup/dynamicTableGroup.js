import { ReactiveDict } from "meteor/reactive-dict";
import "./dynamicTableGroup.html";
import "./dynamicTableGroup.css";
import { getGroupedInfoCollection, getDistinctValuesCollection } from "../../../db.js";
import { changed, getCustom, getColumns, getValue, createModal } from "../../../inlineSave.js";
import { getNestedTableIds, selectorToId, getTableIdSuffix } from "../../helpers.js"

import "../manageGroupFieldsModal/manageGroupFieldsModal.js";
import "../manageOrderModal/manageOrderModal.js";
import "../manageFieldsModal/manageFieldsModal.js";

function openFiltersModal(templateInstance, tableId) {
  const customTableSpec = templateInstance.data.customTableSpec;
  Modal.show("dynamicTableFiltersModal", {
    collection: customTableSpec.table.collection,
    columns: customTableSpec.table.columns,
    filter: templateInstance.parentFilters.get(tableId).filter,
    parentFilter: templateInstance.parentFilter.get().filter,
    triggerUpdateFilter: (newFilter) => {
      templateInstance.parentFilters.set(tableId, newFilter);
      changed(customTableSpec.custom, tableId, { newFilter });
    }
  });
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
  this.parentFilters = new ReactiveDict();
  this.parentFilter = new ReactiveVar({});

  // needed for passing number of page and number of records per page
  this.nestedCustoms = new ReactiveDict();  // set of custom table specs for nested tables

  this.highlitedColumns = new ReactiveDict();

  // reactivity to refresh tables when goups/orders/columns are changed
  const groupChain = new ReactiveVar(this.data.groupChain);
  this.autorun(() => {
    const data = Template.currentData();
    this.parentFilter.set(data.parentFilter);
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
          if (custom.columns) {
            this.nestedColumns.set(value.tableId, custom.columns);
            if (custom.root !== true) {
              this.highlitedColumns.set(value.tableId, true);
            }
          }
          else if (! this.data.columns) {
            const defaultColumns = JSON.parse(JSON.stringify(this.data.customTableSpec.columns().filter(c => c.default).map(c => ({ data: c.data, id: c.id }))));
            this.nestedColumns.set(value.tableId, defaultColumns);
          }
          if (! custom.root) {
            if (custom.groupChainFields) {
              this.nestedGrouping.set(value.tableId, custom.groupChainFields);
            }
            if (custom.order && custom.order.length) {
              this.nestedOrder.set(value.tableId, custom.order);
            }
          }
          value.filter = custom.filter ? JSON.parse(custom.filter) : {};
          this.parentFilters.set(value.tableId, {
            filter: value.filter,
            triggerOpenFilters: () => openFiltersModal(this, value.tableId)
          });
        });
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
      const ids = valuesToCount.map(value => ({ tableId: this.data.tableId + getTableIdSuffix.call(this, value), resultId: JSON.stringify(value.query).replace(/[\{\}.:]/g, "") }));
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
    const values = this.values.get();
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
    let parentFilter = Template.instance().parentFilters.get(value.tableId).filter || {};
    const current = Template.instance().grouping;
    const conditions = [];
    let selector = {};
    if(_.keys(currentSelector || {})) {
      conditions.push(currentSelector);
    }
    if(_.keys(parentFilter || {})) {
      conditions.push(parentFilter);
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
    let parentFilter = templInstance.parentFilters.get(value.tableId);
    parentFilter = _.keys(parentFilter || {}).length ? parentFilter : templInstance.parentFilter.get() || {};
    return _.extend(
      {},
      this.customTableSpec,
      {
        hasContext: false,
        selector: newSelector,
        parentFilter,
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
    return values;
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
    return Template.instance().highlitedColumns.get(tableId);
  },
  hasFilters(tableId) {
    return _.keys(Template.instance().parentFilters.get(tableId) || {}).length;
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
  parentFilter(value) {
    let parentFilter = Template.instance().parentFilters.get(value.tableId) || {};
    parentFilter = _.keys(parentFilter && parentFilter.filter || {}).length ? parentFilter : Template.instance().parentFilter.get();
    return parentFilter;
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
    const compressedColumns = templInstance.nestedColumns.get(tableId) || templInstance.columns.get();
    const selectedColumns = _.compact(compressedColumns.map(c => _.find(getColumns(templInstance.data.customTableSpec.columns) || [], c1 => c1.id ? c1.id === c.id : c1.data === c.data)));

    const manageColumnsOptions = _.extend({
      availableColumns: getColumns(templInstance.data.customTableSpec.columns),
      selectedColumns: selectedColumns,
      tableData: templInstance.data,
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
        manageColumnsOptions.selectedColumns= columns;

        $("#dynamic-table-manage-fields-modal")[0].__blazeTemplate.dataVar.set(manageColumnsOptions);
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
