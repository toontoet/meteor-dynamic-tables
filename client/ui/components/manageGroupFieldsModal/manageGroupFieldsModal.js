import "./manageGroupFieldsModal.css";
import "./manageGroupFieldsModal.html";


Template.dynamicTableManageGroupFieldsModal.onRendered(function onRendered() {
  const self = this;
  this.$("ul").sortable({
    handle: "i",
    stop() {
      const fields = _.toArray(self.$("li.dynamic-table-manage-group-fields-selected")).map(u => $(u).data("field"));
      const cols = _.object(self.data.availableColumns.map(c => c.field), self.data.availableColumns);
      self.data.changeCallback(fields.map(f => cols[f]));
    }
  });
});
Template.dynamicTableManageGroupFieldsModal.events({
  "click li"(e, templInstance) {
    $(e.currentTarget).toggleClass("dynamic-table-manage-group-fields-selected");
    const fields = _.toArray(templInstance.$("li.dynamic-table-manage-group-fields-selected")).map(u => $(u).data("field"));
    const cols = _.object(templInstance.data.availableColumns.map(c => c.field), templInstance.data.availableColumns);
    templInstance.data.changeCallback(fields.map(f => cols[f]));
  }
});
Template.dynamicTableManageGroupFieldsModal.helpers({
  columns() {
    return _.sortBy(this.availableColumns, (c) => {
      const col = this.selectedColumns.find(c1 => c1.field === c.field);
      if (!col) {
        return this.selectedColumns.length;
      }
      return this.selectedColumns.indexOf(col);
    });
  },
  selected(column) {
    const templInstance = Template.instance();
    return _.find(templInstance.data.selectedColumns, selectedColumn => selectedColumn.field === column.field);
  },
  availableColumns() {
    const availableColumns = Template.instance().data.availableColumns;
    return availableColumns;
  }
});
