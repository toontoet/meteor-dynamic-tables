import "./manageFieldsModal.css";
import "./manageFieldsModal.html";
import "../manageColumnsForm/manageColumnsForm.js";

Template.dynamicTableManageFieldsModal.onCreated(function onCreated() {
  this.search = new ReactiveVar();
  this.editing = new ReactiveVar(false);
  this.selectedColumns = new ReactiveVar(this.data.selectedColumns);
  this.editableField = new ReactiveVar(null);
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
  "click .clear-columns"(e, templInstance) {
    if(_.isFunction(templInstance.data.clearColumnsCallback)) {
      // The result of the callback should update the selected columns used.
      templInstance.selectedColumns.set(templInstance.data.clearColumnsCallback());
    }
  },
  "click li>.fa-pencil"(e, templInstance) {
    e.preventDefault();
    e.stopPropagation();
    const colId = $(e.currentTarget).parent().attr("data-id");
    const colData = $(e.currentTarget).parent().attr("data-data");
    const column = templInstance.data.availableColumns.find((col) => {
      if (colId) {
        return colId === col.id;
      }
      return colData === col.data;
    });
    templInstance.editing.set(true);
    const spec = (column.manageFieldsModal && column.manageFieldsModal.field.edit.spec) ||
                (column.filterModal && column.filterModal.field.edit.spec);
    templInstance.editableField.set(spec);
  },
  "click li"(e, templInstance) {
    const selectedColumns = templInstance.selectedColumns.get();
    const colId = $(e.currentTarget).attr("data-id");
    const colData = $(e.currentTarget).attr("data-data");
    const selected = $(e.currentTarget).find("i.fa-toggle-on").length;
    const column = templInstance.data.availableColumns.find((col) => {
      if (colId) {
        return colId === col.id;
      }
      return colData === col.data;
    });
    if (column.required) {
      return;
    }

    if(selectedColumns.find(column => column.data === colData || column.id === colId)) {
      templInstance.selectedColumns.set(selectedColumns.filter(column => column.id !== colId && column.data !== colData));
    } else {
      templInstance.selectedColumns.set(selectedColumns.concat(column));
    }

    templInstance.data.changeCallback(column, !selected);
  },
  "click .dynamic-table-manage-fields-group-header"(e, templInstance) {
    $(e.currentTarget).siblings("ul").toggleClass("display-table-manage-fields-group-hidden");
  },
  "click .btn-dynamic-table-cancel"(e, templInstance) {
    templInstance.editing.set(false);
  },
  "click .btn-dynamic-table-save"(e, templInstance) {
    templInstance.$(".btn-dynamic-table-save").attr("disabled", "disabled");
    const isEdit = templInstance.editableField.get();
    if (isEdit) {
      templInstance.editableField.set(null);
    }
    templInstance.data.edit.callback(e, templInstance, isEdit)
    .then((newColumnSpec) => {
      templInstance.$(".btn-dynamic-table-save").removeAttr("disabled");
      templInstance.editing.set(false);
      let prevColumnSpec;
      if (isEdit) {
        const columns = templInstance.availableColumns.get();
        const realColumn = columns.find(c => c.data === newColumnSpec.data);
        const index = columns.indexOf(realColumn);
        prevColumnSpec = columns.splice(index, 1, newColumnSpec);
      }
      else {
        templInstance.availableColumns.get().push(newColumnSpec);
      }
      templInstance.availableColumns.dep.changed();
      if (isEdit) {
        templInstance.data.edit.editedCallback(newColumnSpec, prevColumnSpec[0]);
      }
      else {
        templInstance.data.edit.addedCallback(newColumnSpec);
      }
    })
    .catch((err) => {
      console.error(err);
    });
  }
});
Template.dynamicTableManageFieldsModal.helpers({
  groupNames() {
    return _.compact(_.unique(_.pluck(this.availableColumns, "group")));
  },
  editableField() {
    return Template.instance().editableField.get();
  },
  fieldType() {
    const editing = Template.instance().editing.get();
    if (!editing || !editing.filterModal || !editing.filterModal.field || !editing.filterModal.field.type) {
      return "string";
    }
    let fieldType = editing.filterModal.field.type;
    if (fieldType && fieldType && _.isArray(fieldType)) {
      fieldType = fieldType[0];
    }
    return fieldType;
  },
  isArray() {
    const editing = Template.instance().editing.get();
    if (!editing || !editing.filterModal || !editing.filterModal.field || !editing.filterModal.field.type) {
      return false;
    }
    const fieldType = editing.filterModal.field.type;
    if (fieldType && fieldType && _.isArray(fieldType)) {
      return true;
    }
    return false;
  },
  editing() {
    return Template.instance().editing.get();
  },
  manageFieldsEditContext() {
    return Template.instance().data.edit;
  },
  search() {
    if (Template.instance().data.search !== undefined) {
      return Template.instance().data.search;
    }
    return Template.instance().availableColumns.get().length >= 15;
  },
  add() {
    return Template.instance().data.edit;
  },
  title(column) {
    return column.manageFieldsTitle || column.title;
  },
  header() {
    let search = false;
    if (Template.instance().data.search !== undefined) {
      search = Template.instance().data.search;
    }
    search = Template.instance().availableColumns.get().length >= 15;
    return search || Template.instance().data.edit;
  },
  required(column) {
    return column.required;
  },
  selected(column) {
    const selectedColumns = Template.instance().selectedColumns.get();
    return _.find(selectedColumns, selectedColumn => (column.id ? selectedColumn.id === column.id : selectedColumn.data === column.data));
  },
  groups() {
    let availableColumns = Template.instance().availableColumns.get();
    const search = Template.instance().search.get();
    if (search) {
      availableColumns = availableColumns.filter((column) => {
        const title = column.manageFieldsTitle || column.title;
        return title.match(new RegExp(search, "i"));
      });
    }
    const groups = _.groupBy(availableColumns, "group");
    delete groups[undefined];
    return _.sortBy(_.map(groups, (columns, title) => ({
      title,
      columns: _.sortBy(columns, field => field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title)
    })), "title");
  },
  ungroupedColumns() {
    let availableColumns = Template.instance().availableColumns.get();
    const search = Template.instance().search.get();
    if (search) {
      availableColumns = availableColumns.filter((column) => {
        const title = column.manageFieldsTitle || column.title;
        return title.match(new RegExp(search, "i"));
      });
    }
    const groups = _.groupBy(availableColumns, "group");
    return _.sortBy(groups.undefined || [], field => field.label || field.manageGroupFieldsTitle || field.manageFieldsTitle || field.title);
  },
  editable(column) {
    const editable = (column && column.manageFieldsModal && column.manageFieldsModal.field && column.manageFieldsModal.field.edit) ||
                  (column && column.filterModal && column.filterModal.field && column.filterModal.field.edit);
    return editable;
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
