import "./components/dynamicTableGroup/dynamicTableGroup.js";
import "./GroupedTable.html";

import "./components/manageGroupFieldsModal/manageGroupFieldsModal.js";
import "./components/manageAspectsModal/manageAspectsModal.js";
import "./components/manageFieldsModal/manageFieldsModal.js";
import { getColumns, getPosition, changed, getCustom, createModal} from "../inlineSave.js";

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
  this.groupChain = new ReactiveVar(this.data.defaultGrouping || []);
  this.aspects = new ReactiveVar(this.data.defaultOrder || []);
  this.searchFn = _.debounce(() => {
    this.search.set(this.$(".dynamic-table-global-search").val());
  }, 1000);

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
        this.aspects.set(custom.order);
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
    const modalIds = ["dynamic-table-manage-aspects-modal", "dynamic-table-manage-group-fields-modal", "dynamic-table-manage-fields-modal"];
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
    const data = Template.instance().data;
    const selector = _.extend({}, data.selector);
    const search = Template.instance().search.get();
    let searchSelector;
    if (search) {
      const searchVal = { $regex: search, $options: "i" };
      searchSelector = { $or: [] };
      const columns = _.unique(Template.instance().customColumns.get().length ? Template.instance().customColumns.get() : getColumns(data.columns || data.table.columns), c => c.data + c.id + c.search);
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
    if (selector && Object.keys(selector).length && searchSelector) {
      return { $and: [selector, searchSelector] };
    }
    return searchSelector || selector;
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
  aspects() {
    return Template.instance().aspects.get();
  },
  columns() {
    return Template.instance().customColumns.get().map(c => ({ data: c.data, id: c.id }));
  },
  table() {
    return _.extend(
      {},
      this,
      {
        hasContext: true, // letting customizableTable know that it will pass custom table spec data
        aspects: Template.instance().aspects.get(),
        selectedColumns: Template.instance().customColumns.get().map(c => ({ data: c.data, id: c.id })),
        parentTableCustom: Template.instance().rootCustom.get()
      }
    )
  },
  rootCustom() {
    return Template.instance().rootCustom.get();
  },
  orderCheckFn() {
    return this.orderCheckFn;
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
  "click span.grouped-table-manage-controller.groups"(e, templInstance) {
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
    createModal(e.currentTarget, modalMeta, templInstance);
  },
  "click span.grouped-table-manage-controller.aspects"(e, templInstance) {
    const availableColumns = getColumns(this.columns).filter(c => c.sortable !== false);
    const modalMeta = {
      template: Template.dynamicTableManageAspectsModal,
      id: "dynamic-table-manage-aspects-modal",
      options: {
        availableColumns,
        aspects: templInstance.aspects.get(),
        changeCallback(aspects) {
          if (templInstance.data.orderCheckFn(aspects, availableColumns)) {
            templInstance.aspects.set(aspects);
            changed(templInstance.data.custom, templInstance.data.id, { newOrder: aspects });
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
  }
});
