import { ReactiveDict } from "meteor/reactive-dict";
import "./dynamicTableGroup.html";
import "./dynamicTableGroup.css";
import { getGroupedInfoCollection, getDistinctValuesCollection } from "../../../db.js";
import { changed, getCustom, getColumns, getValue, createModal } from "../../../inlineSave.js";

import "../manageGroupFieldsModal/manageGroupFieldsModal.js";
import "../manageAspectsModal/manageAspectsModal.js";
import "../manageFieldsModal/manageFieldsModal.js";

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
  this.aspects = new ReactiveVar(this.data.aspects); // current ordering
  this.columns = new ReactiveVar(this.data.columns); // current columns

  this.nestedGrouping = new ReactiveDict(); // set of groupchains for nested tables
  this.nestedOrder = new ReactiveDict();    // set of orders for nested tables
  this.nestedColumns = new ReactiveDict();  // set of columns for nested tables
  // needed for passing number of page and number of records per page
  this.nestedCustoms = new ReactiveDict();  // set of custom table specs for nested tables

  // reactivity to refresh tables when goups/aspects/columns are changed
  const groupChain = new ReactiveVar(this.data.groupChain);
  this.autorun(() => {
    const data = Template.currentData();
    if (JSON.stringify(Tracker.nonreactive(() => this.columns.get())) !== JSON.stringify(data.columns)) {
      this.columns.set(data.columns);
    }
    if (JSON.stringify(Tracker.nonreactive(() => this.aspects.get())) !== JSON.stringify(data.aspects)) {
      this.aspects.set(data.aspects);
    }
    if (JSON.stringify(Tracker.nonreactive(() => groupChain.get())) !== JSON.stringify(data.groupChain)) {
      groupChain.set(data.groupChain);
      this.groupChain.set(_.rest(data.groupChain));
      this.grouping = data.groupableFields.find(gf => gf.field === _.first(data.groupChain));
    }
  });

  /****************************************************************
  * TODO:                                                         *
  *   To be removed. GroupedTable gets root custom and            *
  *   dynamicTableGroup gets custom of each nested table/group.   *
  *   We can just pass it to the kid.                             *
  *****************************************************************/
  // getCustom(this.data.customTableSpec.custom, this.data.tableId, (custom) => {
  //   this.custom.set(custom);
  // });

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
        const nestedTableId = data.tableId + getTableIdSuffix.call(this, value);
        getCustom(data.customTableSpec.custom, nestedTableId, (custom) => {
          this.nestedCustoms.set(nestedTableId, custom);
          if (custom.columns) {
            this.nestedColumns.set(nestedTableId, custom.columns);
          }
          else if (! this.data.columns) {
            const defaultColumns = JSON.parse(JSON.stringify(this.data.customTableSpec.columns().filter(c => c.default).map(c => ({ data: c.data, id: c.id }))));
            this.nestedColumns.set(nestedTableId, defaultColumns);
          }
          if (! custom.root) {
            if (custom.groupChainFields) {
              this.nestedGrouping.set(nestedTableId, custom.groupChainFields);
            }
            if (custom.order && custom.order.length) {
              this.nestedOrder.set(nestedTableId, custom.order);
            }
          }
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
    const tableId = this.tableId + getTableIdSuffix.call(Template.instance(), value);
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
    const tableId = this.tableId + getTableIdSuffix.call(Template.instance(), value);
    return _.extend(
      {},
      this.customTableSpec,
      {
        hasContext: true,
        selector: newSelector,
        id: tableId,
        aspects: Template.instance().nestedOrder.get(tableId) || Template.instance().aspects.get(),
        selectedColumns: Template.instance().nestedColumns.get(tableId) || Template.instance().columns.get(),
        parentTableCustom: Template.instance().nestedCustoms.get(tableId) || this.custom
      }
    );
  },
  currentGroupLabel() {
    return Template.instance().grouping.label;
  },
  currentGroupValues() {
    const templInstance = Template.instance();
    const order = templInstance.aspects.get()[0] || {};
    const grouping = templInstance.grouping;
    const values = templInstance.values.get();

    if (grouping.field === order.data || grouping.valuesField === order.data && values.length) {
      const uncategorized = _.last(values);
      const sortable = _.without(values, uncategorized);
      const operator = order.order === "desc" ? -1 : 1;
      // if we sure that values are sorted by default then sort function may be replaced with .reversed.
      return _.union(sortable.sort((a, b) => a.label > b.label ? operator : b.label > a.label ? -1 * operator : 0), uncategorized);
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
    const tableId = this.tableId + getTableIdSuffix.call(Template.instance(), value);
    return tableId;
  },
  advancedControl(option) {
    if (Template.instance().groupChain.get().length) {
      return this.advanced[option].branch
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
  aspects(tableId) {
    const nestedOrder = Template.instance().nestedOrder.get(tableId);
    const ownOrder = Template.instance().aspects.get();
    return nestedOrder || ownOrder;
  },
  columns(tableId) {
    const nestedColumns = Template.instance().nestedColumns.get(tableId);
    const ownColumns = Template.instance().columns.get();
    return nestedColumns || ownColumns;
  },
  custom(tableId) {
    return Template.instance().nestedCustoms.get(tableId) || this.custom;
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
  "click .dynamic-table-manage-controller.aspects"(e, templInstance) {
    const target = e.currentTarget;
    const tableId = $(target).attr("data-table-id");
    let order = templInstance.nestedOrder.get(tableId) || templInstance.data.aspects;
    const modalMeta = {
      template: Template.dynamicTableManageAspectsModal,
      id: "dynamic-table-manage-aspects-modal",
      options: {
        availableColumns: getColumns(templInstance.data.customTableSpec.columns).filter(c => c.sortable !== false),
        aspects: order,
        changeCallback(aspects) {
          if (aspects.length) {
            templInstance.nestedOrder.set(tableId, aspects);
          }
          else {
            templInstance.nestedOrder.delete(tableId);
          }
          changed(templInstance.data.customTableSpec.custom, tableId, { newOrder: aspects });
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
  }
});
