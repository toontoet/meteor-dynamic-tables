import "./components/dynamicTableGroup/dynamicTableGroup.js";
import "./GroupedTable.html";

import "./components/manageGroupFieldsModal/manageGroupFieldsModal.js";
import "./components/manageOrderModal/manageOrderModal.js";
import "./components/manageFieldsModal/manageFieldsModal.js";
import "./advancedSearchModal.js";
import { getColumns, getPosition, changed, getCustom, createModal} from "../inlineSave.js";

/** @this = template instance */
function getRootSelector(currentSelector, search, advancedSearch) {
  const selector = _.extend({}, currentSelector)
  const data = this.data;
  let searchSelector;
  // finding search selector
  if (search) {
    const searchVal = { $regex: search, $options: "i" };
    searchSelector = { $or: [] };
    const columns = _.unique(this.customColumns.get().length ? this.customColumns.get() : getColumns(data.columns || data.table.columns), c => c.data + c.id + c.search);
    columns.filter(c => c.searchable !== false).forEach((column) => {
      if (column.search) {
        let res = column.search(_.extend({}, searchVal, { $options: column.searchOptions }));
        if (!_.isArray(res)) {
          res = [res];
        }
        searchSelector.$or.push(...res);
      }
      else if (column.data) {
        searchSelector.$or.push({ [column.data]: _.extend({}, searchVal, { $options: column.searchOptions }) });
      }
    });
  }

  const $and = [selector, searchSelector, advancedSearch].filter(s => s && _.keys(s).length);
  return $and.length > 1 ? { $and } : $and[0] || {};
}

Template.GroupedTable.onRendered(function onRendered() {
  if (this.data.customGroupButtonSelector) {
    this.autorun(() => {
      const chain = this.groupChain.get();
      if (chain.length) {
        $(this.data.customGroupButtonSelector).addClass("grouped");
      }
      else {
        $(this.data.customGroupButtonSelector).removeClass("grouped");
      }
    });
  }
});

Template.GroupedTable.onCreated(function onCreated() {
  this.customTableSpec = this.data;
  this.search = new ReactiveVar();
  this.customColumns = new ReactiveVar([]);
  this.groupChain = new ReactiveVar(this.data.groupChain || []);
  this.orders = new ReactiveVar(this.data.defaultOrder || []);
  this.searchFn = _.debounce(() => {
    this.search.set(this.$(".dynamic-table-global-search").val());
  }, 1000);
  this.advancedSearch = new ReactiveVar({});

  this.rootCustom = new ReactiveVar({}); // needed to pass limit/page number to the table

  const id = new ReactiveVar(this.data.id);
  this.autorun(() => {
    const data = Template.currentData();
    if (data.id !== Tracker.nonreactive(() => id.get())) {
      id.set(data.id);
    }
  });

  this.autorun(() => {
    id.get();
    const stop = getCustom(this.data.custom, this.data.id, (custom) => {
      this.rootCustom.set(custom);
      const columns = custom.columns || this.data.table.columns || this.data.columns().filter(c => c.default);
      this.customColumns.set(_.compact(columns.map(c => _.find(getColumns(this.data.columns) || [], c1 => c1.id ? c1.id === c.id : c1.data === c.data))));
      if (custom.order) {
        this.orders.set(custom.order);
      }
      if (custom.groupChainFields) {
        this.groupChain.set(custom.groupChainFields);
      }
    });
    if (! stop) {
      const columns = this.data.table.columns || this.data.columns().filter(c => c.default);
      this.customColumns.set(_.compact(columns.map(c => _.find(getColumns(this.data.columns) || [], c1 => c1.id ? c1.id === c.id : c1.data === c.data))));
    }
  });

  this.documentMouseDown = (e) => {
    const modalIds = ["dynamic-table-manage-orders-modal", "dynamic-table-manage-group-fields-modal", "dynamic-table-manage-fields-modal"];
    modalIds.forEach(id => {
      const manageGroupFieldsWrapper = $(`#${id}`)[0];
      if (manageGroupFieldsWrapper) {
        if ($(manageGroupFieldsWrapper).has(e.target).length) {
          return;
        }
        Blaze.remove(manageGroupFieldsWrapper.__blazeTemplate);
        manageGroupFieldsWrapper.innerHTML = "";
      }
    });
  };

  document.addEventListener("mousedown", this.documentMouseDown);
});

Template.GroupedTable.onDestroyed(function onDestroyed() {
  document.removeEventListener("mousedown", this.documentMouseDown);
});
Template.GroupedTable.helpers({
  selector() {
    const templInstance = Template.instance();
    const search = templInstance.search.get();
    const advancedSearch =  templInstance.advancedSearch.get();
    const selector = getRootSelector.call(templInstance, this.selector, search, advancedSearch);
    return selector;
  },
  expandAll() {
    if (this.expandAll !== undefined) {
      return this.expanAll;
    }
    return false;
  },
  lazy() {
    if (this.lazy !== undefined) {
      return this.lazy;
    }
    return true;
  },
  customTableSpec() {
    return Template.instance().customTableSpec;
  },
  aGroupChain() {
    const groupChain = Template.instance().groupChain.get();
    return groupChain;
  },
  tableId() {
    // see line :34 ; maybe need to be changed
    return Template.instance().data.id;
  },
  orders() {
    return Template.instance().orders.get();
  },
  filters() {
    return true;
  },
  columns() {
    return Template.instance().customColumns.get().map(c => ({ data: c.data, id: c.id }));
  },
  table() {
    const templInstance = Template.instance();
    const search = templInstance.search.get();
    const advancedSearch =  templInstance.advancedSearch.get();
    const selector = getRootSelector.call(templInstance, this.selector, search, advancedSearch);
    return _.extend(
      {},
      this,
      {
        selector,
        hasContext: true, // letting customizableTable know that it will pass custom table spec data
        orders: templInstance.orders.get(),
        selectedColumns: templInstance.customColumns.get().map(c => ({ data: c.data, id: c.id })),
        parentTableCustom: templInstance.rootCustom.get()
      }
    );
  },
  rootCustom() {
    return Template.instance().rootCustom.get();
  },
  orderCheckFn() {
    return this.orderCheckFn;
  },
  advancedControl(parameter) {
    const advanced = this.advanced || {
      grouping: { root: true } // needed for backward compatibility; to be removed in 2.0 release
    };
    if (advanced[parameter]) {
      return advanced[parameter].root;
    }
    return false;
  }
});

Template.GroupedTable.events({
  "change .dynamic-table-global-search"(e, templInstance) {
    templInstance.searchFn();
  },
  "keydown .dynamic-table-global-search"(e, templInstance) {
    templInstance.searchFn();
  },
  "keyup .dynamic-table-global-search"(e, templInstance) {
    templInstance.searchFn();
  },
  "click span.grouped-table-manage-controller.groups"(e, templInstance, extra = {}) {
    // extra is needed for backward compatibility; to be removed in 2.0 release
    const modalMeta = {
      template: Template.dynamicTableManageGroupFieldsModal,
      id: "dynamic-table-manage-group-fields-modal",
      options: {
        availableColumns: templInstance.data.groupableFields,
        selectedColumns: templInstance.groupChain.get(),
        changeCallback(columns) {
          templInstance.groupChain.set(columns);
          changed(templInstance.data.custom, templInstance.data.id, { newGroupChainFields: columns });
        }
      }
    }
    createModal(extra.target || e.currentTarget, modalMeta, templInstance);
  },
  "click span.grouped-table-manage-controller.orders"(e, templInstance) {
    const availableColumns = getColumns(this.columns).filter(c => c.sortable !== false);
    const modalMeta = {
      template: Template.dynamicTableManageOrderModal,
      id: "dynamic-table-manage-orders-modal",
      options: {
        availableColumns,
        order: templInstance.orders.get(),
        changeCallback(orders) {
          if (templInstance.data.orderCheckFn(orders, availableColumns)) {
            templInstance.orders.set(orders);
            changed(templInstance.data.custom, templInstance.data.id, { newOrder: orders });
          };
        }
      }
    };
    createModal(e.currentTarget, modalMeta, templInstance);
  },
  "click span.grouped-table-manage-controller.columns"(e, templInstance) {
    const manageColumnsOptions = _.extend({
      availableColumns: getColumns(templInstance.data.columns),
      selectedColumns: templInstance.customColumns.get() || [],
      tableData: templInstance.data,
      changeCallback(column, add) {
        let unsetField = false;
        const columns = templInstance.customColumns.get();
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

          if (! templInstance.groupChain.get().length) {
            const tableTemplateInstance = Blaze.getView(templInstance.$("table")[0]).templateInstance();
            const search = tableTemplateInstance.advancedSearch.get();
            if (actualColumn.sortField || actualColumn.sortableField) {
              delete search[actualColumn.sortableField];
              delete search[actualColumn.sortField];
              unsetField = actualColumn.sortField || actualColumn.sortableField;
            }
            else {
              unsetField = actualColumn.data;
              delete search[actualColumn.data];
            }
            tableTemplateInstance.advancedSearch.set(search);
            tableTemplateInstance.query.dep.changed();
          }
          columns.splice(columns.indexOf(actualColumn), 1);
        }
        changed(templInstance.data.custom, templInstance.data.id, { newColumns: columns, unset: unsetField });
        templInstance.customColumns.set(columns);
        manageColumnsOptions.selectedColumns = columns;
        $("#dynamic-table-manage-fields-modal")[0].__blazeTemplate.dataVar.set(manageColumnsOptions);
      }
    }, templInstance.data.manageFieldsOptions || {});

    // To be changed
    // It duplicates code in dynamic table group
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

    createModal(e.currentTarget, modalMeta, templInstance);
  },
  "click .grouped-table-manage-controller.filters"(e) {
    const options = this.table;
    Modal.show("dynamicTableFilterSelector", {
      columns: options.columns
    });
  }
});
