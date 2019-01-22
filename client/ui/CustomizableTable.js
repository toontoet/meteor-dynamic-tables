import "./CustomizableTable.html";
import "./table.js";
import "./components/manageFieldsModal/manageFieldsModal.js";
import { getPosition, changed, getCustom } from "../inlineSave.js";
import { EJSON } from "meteor/ejson";

function filterColumns(columns, selectedColumnDataOrIds) {
  return _.compact(selectedColumnDataOrIds.map((c) => {
    return columns.find(col => col.id === c || col.data === c);
  }));
}


Template.CustomizableTable.helpers({
  removeColumn() {
    const templInstance = Template.instance();
    return (column) => {
      const columns = templInstance.selectedColumns.get();
      const columnIndex = _.findIndex(columns, col => col.id === column.id || col.data === column.data);
      columns.splice(columnIndex, 1);
      templInstance.selectedColumns.set(columns);
      changed(templInstance.data.custom, { newColumns: columns });
    };
  },
  advancedFilter() {
    return Template.instance().advancedFilter.get();
  },
  modifyFilterCallback() {
    const templInstance = Template.instance();
    return (newFilter, newOrder) => {
      changed(templInstance.data.custom, { newColumns: Tracker.nonreactive(() => templInstance.selectedColumns.get()), newFilter, newOrder });
    };
  },
  readyToRender() {
    return Template.instance().selectedColumns.get().length;
  },
  buildTable() {
    const tmplInstance = Template.instance();
    const table = _.extend({}, Template.instance().data.table);
    table.columns = Template.instance().selectedColumns.get();
    const customOrder = Template.instance().order.get();
    table.pageLength = tmplInstance.limit.get();
    table.pageNumber = tmplInstance.skip.get() / table.pageLength;
    if (customOrder) {
      table.order = customOrder.map((o) => {
        const column = _.find(table.columns, c => c.id === o.id || c.data === o.data);
        return [
          table.columns.indexOf(column),
          o.order
        ];
      }).filter(o => o[0] !== -1);
    }
    table.lengthChangeCallback = (dataTable, length) => {
      changed(tmplInstance.data.custom, { newLimit: length, newSkip: dataTable.api().page() * length });
    };
    table.pageChangeCallback = (dataTable, page) => {
      changed(tmplInstance.data.custom, { newSkip: page * tmplInstance.limit.get() });
    };
    table.orderCallback = (dataTable, newOrder) => {
      const columns = dataTable.api().context[0].aoColumns;
      const order = JSON.parse(JSON.stringify(newOrder.map(o => ({
        id: columns[o[0]].id,
        data: columns[o[0]].data,
        order: o[1]
      }))));
      if (!EJSON.equals(order, Tracker.nonreactive(() => tmplInstance.order.get()))) {
        changed(tmplInstance.data.custom, { newOrder: order });
      }
    };
    table.colReorder = {
      fnReorderCallback: Template.instance().fnReorderCallback
    };
    return table;
  }
});

Template.CustomizableTable.events({
  "click a.clear-fields"(e, templInstance) {
    e.preventDefault();
    templInstance.selectedColumns.set(templInstance.data.table ? templInstance.data.table.columns : templInstance.data.columns);
    templInstance.advancedFilter.set(undefined);
    templInstance.order.set(undefined);
  },
  "click a.clear-filters"(e, templInstance) {
    e.preventDefault();
    const tableTemplateInstance = Blaze.getView(templInstance.$("table")[0]).templateInstance();
    tableTemplateInstance.advancedSearch.set({});
    changed(templInstance.data.custom, { newColumns: templInstance.selectedColumns.get(), unset: "all" });
    tableTemplateInstance.query.dep.changed();
  },
  "click a.manage-fields"(e, templInstance) {
    e.preventDefault();
    const manageFieldsOptions = _.extend({
      availableColumns: templInstance.data.columns,
      selectedColumns: templInstance.selectedColumns.get(),
      tableData: templInstance.data,
      changeCallback(column, add) {
        let unsetField = false;
        const columns = templInstance.selectedColumns.get();
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
          const tableTemplateInstance = Blaze.getView(templInstance.$("table")[0]).templateInstance();
          const search = tableTemplateInstance.advancedSearch.get();
          if (actualColumn.sortableField) {
            delete search[actualColumn.sortableField];
            unsetField = actualColumn.sortableField;
          }
          else {
            unsetField = actualColumn.data;
            delete search[actualColumn.data];
          }
          tableTemplateInstance.advancedSearch.set(search);
          tableTemplateInstance.query.dep.changed();
          columns.splice(columns.indexOf(actualColumn), 1);
        }
        changed(templInstance.data.custom, { newColumns: columns, unset: unsetField });
        templInstance.selectedColumns.set(columns);
        manageFieldsOptions.selectedColumns = columns;

        $("#dynamic-table-manage-fields-modal")[0].__blazeTemplate.dataVar.set(manageFieldsOptions);
      }
    }, templInstance.data.manageFieldsOptions || {});
    if (manageFieldsOptions.add) {
      manageFieldsOptions.add.addedCallback = (columnSpec) => {
        templInstance.data.columns.push(columnSpec);
        manageFieldsOptions.changeCallback(columnSpec, true);
      };
    }
    const bounds = getPosition(e.currentTarget);
    const div = $("#dynamic-table-manage-fields-modal").length ? $("#dynamic-table-manage-fields-modal") : $("<div>");
    div.attr("id", "dynamic-table-manage-fields-modal")
    .html("")
    .css("position", "absolute")
    .css("top", bounds.top + $(e.currentTarget).height())
    .css("left", bounds.left)
    .css("z-index", 1);

    if (div[0].__blazeTemplate) {
      Blaze.remove(div[0].__blazeTemplate);
    }
    div[0].__blazeTemplate = Blaze.renderWithData(
      Template.dynamicTableManageFieldsModal,
      manageFieldsOptions,
      div[0]
    );
    document.body.appendChild(div[0]);
    const tooFar = (bounds.left + div.width()) - $(window).width();
    if (tooFar > 0) {
      div.css("left", (bounds.left - (tooFar + 5)) + "px");
    }
  },
  "click a.add-column"(e, templInstance) {
    e.preventDefault();
    const columns = templInstance.selectedColumns.get();
    const columnData = $(e.currentTarget).data("column");
    const column = _.findWhere(columns, { data: columnData });
    if (column) {
      columns.splice(columns.indexOf(column), 1);
    }
    else {
      columns.push(_.findWhere(templInstance.data.columns, { data: columnData }));
    }
    templInstance.selectedColumns.set(columns);
  }
});


Template.CustomizableTable.onCreated(function onCreated() {
  this.selectedColumns = new ReactiveVar([]);
  this.order = new ReactiveVar();
  this.advancedFilter = new ReactiveVar();
  this.limit = new ReactiveVar(this.data.table.pageLength || 25);
  this.skip = new ReactiveVar(0);
  this.fnReorderCallback = () => {
    const columns = this.$("table").dataTable().api().context[0].aoColumns;
    changed(this.data.custom, { newColumns: columns.map(col => ({ data: col.data, id: col.id })) });
  };
  let stop = false;
  if (this.data.custom) {
    stop = getCustom(this.data.custom, (custom) => {
      const columnsToUse = custom.columns && custom.columns.length ? custom.columns : this.data.table.columns;
      this.selectedColumns.set(filterColumns(this.data.columns, columnsToUse.map(c => c.id || c.data)));
      this.advancedFilter.set(custom.filter ? JSON.parse(custom.filter) : {});
      const oldOrder = Tracker.nonreactive(() => this.order.get());
      if (EJSON.stringify(oldOrder) !== EJSON.stringify(custom.order || [])) {
        this.order.set(custom.order || []);
      }
      if (Tracker.nonreactive(() => this.limit.get()) !== (custom.limit || this.data.table.pageLength || 25)) {
        this.limit.set(custom.limit || this.data.table.pageLength || 25);
      }
      if (Tracker.nonreactive(() => this.skip.get()) !== (custom.skip || 0)) {
        this.skip.set(custom.skip || 0);
      }
    });
  }
  if (!stop && this.data.table.columns) {
    this.selectedColumns.set(this.data.table.columns);
  }
  else if (!stop) {
    this.selectedColumns.set(this.data.columns);
  }
});
