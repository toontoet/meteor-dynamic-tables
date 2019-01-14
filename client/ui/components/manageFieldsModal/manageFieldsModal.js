import "./manageFieldsModal.css";
import "./manageFieldsModal.html";

Template.dynamicTableManageFieldsModal.onCreated(function onCreated() {
  this.search = new ReactiveVar();
});

Template.dynamicTableManageFieldsModal.events({
  "keydown input"(e, templInstance) {
    templInstance.search.set($(e.currentTarget).val());
  },
  "keyup input"(e, templInstance) {
    templInstance.search.set($(e.currentTarget).val());
  },
  "blur input"(e, templInstance) {
    templInstance.search.set($(e.currentTarget).val());
  },
  "click li"(e, templInstance) {
    const colId = $(e.currentTarget).attr("data-id");
    const colData = $(e.currentTarget).attr("data-data");
    const selected = $(e.currentTarget).find("i.fa-toggle-on").length;//hasClass("dynamic-table-manage-fields-selected");
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
  },
  availableColumns() {
    const availableColumns = Template.instance().data.availableColumns;
    const search = Template.instance().search.get();
    if (search) {
      return availableColumns.filter((column) => {
        const title = column.manageFieldsTitle || column.title;
        return title.match(new RegExp(search, "i"));
      });
    }
    return availableColumns;
  }
});
