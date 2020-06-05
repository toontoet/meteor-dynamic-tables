import "./CustomizableTable.html";
import "./table.js";
import "./components/manageFieldsModal/manageFieldsModal.js";
import { getColumns, getPosition, changed, getCustom, mergeRequiredColumns } from "../inlineSave.js";
import _ from "underscore";
import { EJSON } from "meteor/ejson";

function filterColumns(columns, selectedColumnDataOrIds) {
  return _.compact(selectedColumnDataOrIds.map((c) => {
    return columns.find(col => (col.id ? col.id === c : col.data === c));
  }));
}

Template.CustomizableTable.onCreated(function onCreated() {
  this.advancedFilter = new ReactiveVar(this.data.currentFilter);

  // Parent filters hold a chain of filters that are applied in order from the top level to the table level.
  this.parentFilters = new ReactiveVar(this.data.parentFilters);

  // Once the filter is saved, the parent table is recreated but the filter stored in memory also needs to be updated or else
  // the changes made to the filter at the column level will be reverted. This function makes sure that the changes made at the
  // column level are persisted.
  this.updateCurrentFilter = this.data.updateCurrentFilter;
  this.limit = new ReactiveVar(this.data.table.pageLength || 25);
  this.skip = new ReactiveVar(0);
  this.fnReorderCallback = () => {
    const columns = this.$("table").dataTable().api().context[0].aoColumns;
    const newColumns = _.sortBy(this.selectedColumns.get(), c1 => columns.indexOf(_.find(columns, c2 => (c2.id ? c2.id === c1.id : c2.data === c1.data))));
    this.selectedColumns.set(newColumns);
    changed(this.data.custom, this.data.id, { newColumns: columns.map(col => ({ data: col.data, id: col.id })) });
  };
  this.order = new ReactiveVar(this.data.orders)
  this.selectedColumns = new ReactiveVar([]);
  // Used when Customizable table used alone without grouped table
  if (! this.data.hasContext) {
    // gets custom from the database, sets selected columns
    let stop = false;
    if (this.data.custom) {
      stop = getCustom(this.data.custom, this.data.id, (custom) => {
        if (custom.columns && custom.columns.length) {
          const availableColumns = getColumns(this.data.columns);
          custom.columns = mergeRequiredColumns(custom.columns, availableColumns);
        }
        const columnsToUse = custom.columns && custom.columns.length ? custom.columns : this.data.table.columns;
        this.selectedColumns.set(filterColumns(getColumns(this.data.columns), columnsToUse.map(c => c.id || c.data)));

        // EJSON.fromJSONValue is needed because the JSON object stored uses ESJSON.toJSONValue
        const advancedFilter = this.advancedFilter.get() || {};
        if(custom.filter) {
          advancedFilter.query = EJSON.fromJSONValue(JSON.parse(custom.filter));
          this.advancedFilter.set(advancedFilter);
        }
        const oldOrder = Tracker.nonreactive(() => this.order.get());
        if (custom.order && EJSON.stringify(oldOrder) !== EJSON.stringify(custom.order || [])) {
          this.order.set(custom.order);
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
      this.selectedColumns.set(getColumns(this.data.columns));
    }
  }
  else {
    // NOTE:
    // This code does same what code above, just retrieves data from context(dynamicTableGroup / GroupedTable)
    // It is needed to make order/columns/grouping reactive.
    if (this.data.columns) {
      // need to be non-empty array
      const columns = (
        this.data.selectedColumns && this.data.selectedColumns.length && this.data.selectedColumns ||
        this.data.table.columns && this.data.table.columns.length && this.data.table.columns ||
        getColumns(this.data.columns)
      );
      this.selectedColumns.set(filterColumns(getColumns(this.data.columns), columns.map(c => c.id || c.data)));
    }
    else if (this.data.table.columns) {
      this.selectedColumns.set(this.data.table.columns);
    }
    else {
      this.selectedColumns.set(getColumns(this.data.columns));
    }

    if (this.data.parentTableCustom) {
      if (Tracker.nonreactive(() => this.limit.get()) !== (this.data.parentTableCustom.limit || this.data.table.pageLength || 25)) {
        this.limit.set(this.data.parentTableCustom.limit || this.data.table.pageLength || 25);
      }
      if (Tracker.nonreactive(() => this.skip.get()) !== (this.data.parentTableCustom.skip || 0)) {
        this.skip.set(this.data.parentTableCustom.skip || 0);
      }
    }
  }

  // autorun triggers when any(order, culumns) of the current data changes
  this.autorun((comp) => {
    const data = Template.currentData();
    if (comp.firstRun) {
      return;
    }

    // If changes to the parent filters or current filter are made, we want those changes
    // to propagate to the bottom level.
    this.parentFilters.set(data.parentFilters);
    this.advancedFilter.set(data.currentFilter);

    // refreshes table when order has been changed
    if (JSON.stringify(Tracker.nonreactive(() => this.order.get())) !== JSON.stringify(data.orders) && data.orders) {
      this.order.set(data.orders);
      const tableTemplateInstance = Blaze.getView(this.$("table")[0]).templateInstance();
      const query = Tracker.nonreactive(() => tableTemplateInstance.query.get());
      // transforms order - [{}, {}] into one object with all keys and values
      const sortifyOrder = (order, sort = {}) => order.length ? sortifyOrder(_.rest(order), _.extend(sort, _.first(order))) : sort;
      const newSorts = sortifyOrder(data.orders.map(a => ({ [a.data || a.id]: a.order === "asc" ? 1 : -1 }))); // sort which we can store and query database
      const dataTableSort = data.orders.map(s => { // sort which DataTable would understand
        const index = _.findIndex(tableTemplateInstance.columns, c => c.data === s.data);
        const order = [index, s.order];
        order._idx = index;
        return order;
      }).filter(o => o[0] + 1); // filters all columns which we don't display
      query.options.sort = newSorts;
      tableTemplateInstance.$tableElement.DataTable().order(dataTableSort).draw()
      tableTemplateInstance.query.dep.changed();
    }

    // refreshes table when columns has been changed
    const currentColumns = Tracker.nonreactive(() => this.selectedColumns.get()).map(c => ({ data: c.data, id: c.id }));
    const newColumns = (
      data.selectedColumns && data.selectedColumns.length && data.selectedColumns ||
      data.table.columns && data.table.columns.length && data.table.columns ||
      getColumns(data.columns)
    ).map(c => ({ data: c.data, id: c.id }));

    if (JSON.stringify(currentColumns) !== JSON.stringify(newColumns)) {
      const tableTemplateInstance = Blaze.getView(this.$("table")[0]).templateInstance();
      const columns = filterColumns(getColumns(data.columns), newColumns.map(c => c.id || c.data));
      this.selectedColumns.set(columns);
      tableTemplateInstance.columns = columns;
      tableTemplateInstance.query.dep.changed();
    }
  });
});

Template.CustomizableTable.helpers({
  removeColumn() {
    const templInstance = Template.instance();
    return (column) => {
      const columns = templInstance.selectedColumns.get();
      const columnIndex = _.findIndex(columns, col => (column.id ? col.id === column.id : col.data === column.data));
      columns.splice(columnIndex, 1);
      templInstance.selectedColumns.set(columns);
      changed(templInstance.data.custom, templInstance.data.id, { newColumns: columns });
    };
  },
  advancedFilter() {
    return Template.instance().advancedFilter.get();
  },
  parentFilters() {
    return Template.instance().parentFilters.get();
  },
  modifyFilterCallback() {
    const templInstance = Template.instance();
    return (newFilter, newOrder, columns) => {

      // Make sure the filter stored in the Customizable table is updated as well.
      const currentFilter = templInstance.advancedFilter.get() || {};
      currentFilter.query = newFilter;
      templInstance.advancedFilter.set(currentFilter);

      if (columns) {
        const currentColumns = templInstance.selectedColumns.get();
        for (let col of columns.filter(col => col.id)) {
          const oldColumn = _.findWhere(currentColumns, { id: col.id });
          if (! oldColumn) {
            // means that column was removed and so filter should be
            changed(templInstance.data.custom, templInstance.data.id, { newFilter });
            return
          }
          if (oldColumn.data !== col.data) {
            oldColumn.data = col.data;
            templInstance.selectedColumns.dep.changed();
          }
        }
      }

      // calling changed() will cause the parent of this table to re-render. Use
      // the callback to ensure changes to the filter are applied to the related filter
      // in the parent.
      if(_.isFunction(this.updateCurrentFilter)) {
        this.updateCurrentFilter(newFilter);
      }

      changed(templInstance.data.custom, templInstance.data.id, { newColumns: Tracker.nonreactive(() => templInstance.selectedColumns.get()), newFilter, newOrder });
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
        const column = _.find(table.columns, c => (o.id ? c.id === o.id : c.data === o.data));
        return [
          table.columns.indexOf(column),
          o.order
        ];
      }).filter(o => o[0] !== -1);
    }
    table.lengthChangeCallback = (dataTable, length) => {
      changed(tmplInstance.data.custom, tmplInstance.data.id, { newLimit: length, newSkip: dataTable.api().page() * length });
    };
    table.pageChangeCallback = (dataTable, page) => {
      changed(tmplInstance.data.custom, tmplInstance.data.id, { newSkip: page * tmplInstance.limit.get() });
    };
    table.orderCallback = (dataTable, newOrder) => {
      const columns = dataTable.api().context[0].aoColumns;
      const order = JSON.parse(JSON.stringify(newOrder.map(o => ({
        id: columns[o[0]].id,
        data: columns[o[0]].sortableField || columns[o[0]].data,
        order: o[1]
      }))));
      if (!EJSON.equals(order, Tracker.nonreactive(() => tmplInstance.order.get()))) {
        changed(tmplInstance.data.custom, tmplInstance.data.id, { newOrder: order });
      }
    };
    table.colReorder = {
      fnReorderCallback: Template.instance().fnReorderCallback
    };
    return table;
  },
  allColumns() {
    const columns = Template.instance().data.columns;
    return columns && _.isFunction(columns) ? columns() : columns;
  }
});


Template.CustomizableTable.events({
  "click a.manage-fields"(e, templInstance) {
    e.preventDefault();
    const manageFieldsOptions = _.extend({
      availableColumns: getColumns(templInstance.data.columns),
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
          if (!actualColumn) {
          return;
        }
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
        columns.splice(columns.indexOf(actualColumn), 1);
      }

      changed(templInstance.data.custom, templInstance.data.id, { newColumns: columns, unset: unsetField });
      templInstance.selectedColumns.set(columns);
      manageFieldsOptions.selectedColumns = columns;

      $("#dynamic-table-manage-fields-modal")[0].__blazeTemplate.dataVar.set(manageFieldsOptions);
    }
  }, templInstance.data.manageFieldsOptions || {});
    if (manageFieldsOptions.edit) {
      manageFieldsOptions.edit.addedCallback = (columnSpec) => {
        if (!_.isFunction(templInstance.data.columns)) {
          templInstance.data.columns.push(columnSpec);
        }
        manageFieldsOptions.changeCallback(columnSpec, true);
      };
      manageFieldsOptions.edit.editedCallback = (columnSpec, prevColumnSpec) => {
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
    const bounds = getPosition(e.currentTarget);
    const div = $("#dynamic-table-manage-fields-modal").length ? $("#dynamic-table-manage-fields-modal") : $("<div>");
    div.attr("id", "dynamic-table-manage-fields-modal")
    .html("")
    .css("position", "absolute")
    .css("top", bounds.top + $(e.currentTarget).height())
    .css("left", bounds.left)
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
  }
});
