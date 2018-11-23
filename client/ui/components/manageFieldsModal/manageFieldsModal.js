import "./manageFieldsModal.css";
import "./manageFieldsModal.html";

Template.dynamicTableManageFieldsModal.events({
  "click li"(e, templInstance) {
    const colId = $(e.currentTarget).data("id");
    const colData = $(e.currentTarget).data("data");
    const selected = $(e.currentTarget).hasClass("dynamic-table-manage-fields-selected");
    const column = templInstance.data.availableColumns.find((col) => {
      if (colId) {
        return colId === col.id;
      }
      return colData === col.data;
    });
    templInstance.data.changeCallback(column, !selected);
  }
});
Template.dynamicTableManageFieldsModal.helpers({
  title(column) {
    return column.manageFieldsTitle || column.title;
  },
  selected(column) {
    const templInstance = Template.instance();
    return _.find(templInstance.data.selectedColumns, selectedColumn  => selectedColumn.id ? selectedColumn.id === column.id : selectedColumn.data === column.data);
  }
});
