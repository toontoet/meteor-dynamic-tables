import "./CustomizableTable.html";
import "./table.js";
import { getValue } from "../inlineSave.js";

Template.CustomizableTable.helpers({
  readyToRender() {
    return Template.instance().selectedColumns.get().length;
  },
  buildTable() {
    const table = _.extend({}, Template.instance().data.table);
    table.columns = Template.instance().selectedColumns.get();
    return table;
  }
});

Template.CustomizableTable.events({
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

function filterColumns(columns, selectedColumnDataOrIds, savedSort, savedAdvancedSelector) {
  const columnsToUse = columns.filter(c => c.required || selectedColumnDataOrIds.includes(c._id || c.data));

  return columnsToUse;
}

Template.CustomizableTable.onCreated(function onCreated() {
  this.selectedColumns = new ReactiveVar([]);
  if (this.data.custom) {
    if (_.isString(this.data.custom)) {
      Tracker.autorun(() => {
        if (!Meteor.userId()) {
          return;
        }
        const custom = getValue(Tracker.nonreactive(() => Meteor.user()), this.data.custom);
        this.selectedColumns.set(filterColumns(this.data.columns, custom.columns));
      });
    }
    else if (_.isArray(this.data.custom)) {
      this.selectedColumns.set(filterColumns(this.data.columns, this.data.custom));
    }
    else if (_.isFunction(this.data.columnSelector)) {
      const result = this.data.columnSelector(this.data.columns, (asyncResult) => {
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
  else if (this.data.table.columns) {
    this.selectedColumns.set(this.data.table.columns);
  }
  else {
    this.selectedColumns.set(this.data.columns);
  }
});
