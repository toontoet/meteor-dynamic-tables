import "./manageFieldsModal.css";
import "./manageFieldsModal.html";

Template.dynamicTableManageFieldsModal.onCreated(function onCreated() {
  this.search = new ReactiveVar();
  this.editing = new ReactiveVar(false);
  this.availableColumns = new ReactiveVar(this.data.availableColumns);
});

Template.dynamicTableManageFieldsModal.events({
  "keydown input.search"(e, templInstance) {
    templInstance.search.set($(e.currentTarget).val());
  },
  "keyup input.search"(e, templInstance) {
    templInstance.search.set($(e.currentTarget).val());
  },
  "blur input.search"(e, templInstance) {
    templInstance.search.set($(e.currentTarget).val());
  },
  "click .add-column"(e, templInstance) {
    templInstance.editing.set(true);
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
  },
  "click .btn-dynamic-table-cancel"(e, templInstance) {
    templInstance.editing.set(false);
  },
  "click .btn-dynamic-table-save"(e, templInstance) {
    templInstance.$(".btn-dynamic-table-save").attr("disabled", "disabled");
    templInstance.data.add.callback(e, templInstance)
    .then((newColumnSpec) => {
      templInstance.$(".btn-dynamic-table-save").removeAttr("disabled");
      templInstance.editing.set(false);
      templInstance.availableColumns.dep.changed();
      templInstance.data.add.addedCallback(newColumnSpec);
    })
    .catch((err) => {
      console.error(err);
    });
  }
});
Template.dynamicTableManageFieldsModal.helpers({
  types() {
    const types = this.add.types || [];
    return types.map((t) => {
      if (_.isObject(t)) {
        return t;
      }
      return {
        value: t,
        label: t
      };
    });
  },
  editing() {
    return Template.instance().editing.get();
  },
  search() {
    if (Template.instance().data.search !== undefined) {
      return Template.instance().data.search;
    }
    return Template.instance().availableColumns.get().length > 15;
  },
  add() {
    return Template.instance().data.add;
  },
  title(column) {
    return column.manageFieldsTitle || column.title;
  },
  selected(column) {
    const templInstance = Template.instance();
    return _.find(templInstance.data.selectedColumns, selectedColumn  => selectedColumn.id ? selectedColumn.id === column.id : selectedColumn.data === column.data);
  },
  availableColumns() {
    const availableColumns = Template.instance().availableColumns.get();
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
