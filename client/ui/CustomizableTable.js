import "./CustomizableTable.html";
import "./table.js";
import "./components/manageFieldsModal/manageFieldsModal.js";
import { getValue, getPosition } from "../inlineSave.js";
import { EJSON } from "meteor/ejson";

function changed(newColumns, newFilter, newOrder) {
  const custom = this.data.custom;
  if (_.isString(custom)) {
    const $set = {
      [`${custom}.columns`]: newColumns.map(col => ({ data: col.data, id: col.id }))
    };

    if (newFilter) {
      $set[`${custom}.filter`] = JSON.stringify(EJSON.toJSONValue(newFilter));
    }
    if (newOrder) {
      $set[`${custom}.order`] = newOrder;
    }
    Meteor.users.update(
      { _id: Meteor.userId() },
      { $set }
    );
  }
}

Template.CustomizableTable.helpers({
  removeColumn() {
    const templInstance = Template.instance();
    return (column) => {
      const columns = templInstance.selectedColumns.get();
      const columnIndex = _.findIndex(columns, col => col.id === column.id || col.data === column.data);
      columns.splice(columnIndex, 1);
      templInstance.selectedColumns.set(columns);
      changed.call(templInstance, columns);
    };
  },
  advancedFilter() {
    return Template.instance().advancedFilter.get();
  },
  modifyFilterCallback() {
    const templInstance = Template.instance();
    return (newFilter, newOrder) => {
      changed.call(templInstance, Tracker.nonreactive(() => templInstance.selectedColumns.get()), newFilter, newOrder);
    };
  },
  readyToRender() {
    return Template.instance().selectedColumns.get().length;
  },
  buildTable() {
    const table = _.extend({}, Template.instance().data.table);
    table.columns = Template.instance().selectedColumns.get();
    const customOrder = Template.instance().order.get();
    if (customOrder) {
      table.order = customOrder.map((o) => {
        const column = _.find(table.columns, c => c.id === o.id || c.data === o.data);
        return [
          table.columns.indexOf(column),
          o.order
        ];
      }).filter(o => o[0] !== -1);
    }
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
  "click a.manage-fields"(e, templInstance) {
    e.preventDefault();
    const manageFieldsOptions = {
      availableColumns: templInstance.data.columns,
      selectedColumns: templInstance.selectedColumns.get(),
      changeCallback(column, add) {
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
          columns.splice(columns.indexOf(actualColumn), 1);
        }
        changed.call(templInstance, columns);
        templInstance.selectedColumns.set(columns);
        manageFieldsOptions.selectedColumns = columns;
        $("#dynamic-table-manage-fields-modal")[0].__blazeTemplate.dataVar.set(manageFieldsOptions);
      }
    };
    const bounds = getPosition(e.currentTarget);
    const div = $("#dynamic-table-manage-fields-modal").length ? $("#dynamic-table-manage-fields-modal") : $("<div>");
    div.attr("id", "dynamic-table-manage-fields-modal")
    .html("")
    .css("position", "absolute")
    .css("top", bounds.top)
    .css("left", bounds.left);

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

function filterColumns(columns, selectedColumnDataOrIds) {
  return selectedColumnDataOrIds.map((c) => {
    return columns.find(col => col.id === c || col.data === c);
  });
}

Template.CustomizableTable.onCreated(function onCreated() {
  this.selectedColumns = new ReactiveVar([]);
  this.order = new ReactiveVar();
  this.advancedFilter = new ReactiveVar();
  this.fnReorderCallback = () => {
    const columns = this.$("table").dataTable().api().context[0].aoColumns;
    changed.call(this, columns.map(col => ({ data: col.data, id: col.id })));
  };
  let stop = false;
  if (this.data.custom) {
    if (_.isString(this.data.custom)) {
      Tracker.autorun(() => {
        if (!Meteor.userId()) {
          return;
        }
        const custom = getValue(Tracker.nonreactive(() => Meteor.user()), this.data.custom);
        if (custom) {
          this.selectedColumns.set(filterColumns(this.data.columns, custom.columns.map(c => c.id || c.data)));
          this.advancedFilter.set(custom.filter ? JSON.parse(custom.filter) : {});
          this.order.set(custom.order);
          stop = true;
        }
      });
    }
    if (!stop && _.isObject(this.data.custom)) {
      this.selectedColumns.set(filterColumns(this.data.columns, this.data.custom.columns));
    }
    else if (!stop && _.isFunction(this.data.custom)) {
      const result = this.data.custom(this.data.columns, (asyncResult) => {
        this.selectedColumns.set(asyncResult.columns);
      });
      if (result instanceof Promise) {
        result.then((asyncResult) => {
          this.selectedColumns.set(asyncResult.columns);
        });
      }
      else if (result) {
        this.selectedColumns.set(result.columns);
      }
    }
  }
  if (!stop && this.data.table.columns) {
    this.selectedColumns.set(this.data.table.columns);
  }
  else if (!stop) {
    this.selectedColumns.set(this.data.columns);
  }
});
