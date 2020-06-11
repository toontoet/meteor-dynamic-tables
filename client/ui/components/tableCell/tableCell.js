import "./tableCell.html";
import "./tableCell.css";

Template.dynamicTableTableCell.helpers({
  editing() {
    return Template.instance().editing.get();
  },
  editTemplateData() {
    const template = Template.instance();
    return _.extend({
      afterEditCallback() {
        template.editing.set(template.alwaysEditing);
        if(template.alwaysEditing) {
          template.helpers.editTemplateData();
        }
      }
    }, _.isFunction(this.editTemplateData) ? this.editTemplateData() : this.editTemplateData);
  }
});


Template.dynamicTableTableCell.events({
  "click .dynamic-table-enable-editing"(e, templInstance) {
    if (templInstance.data.editable) {
      const td = $(e.currentTarget).closest("td");
      td.width(td.width());
      templInstance.editing.set(true);
    }
  }
});

Template.dynamicTableTableCell.onCreated(function onCreated() {
  this.alwaysEditing = !!this.data.alwaysEditing;
  this.editing = new ReactiveVar(this.alwaysEditing);
  this.autorun((comp) => {
    const editing = this.editing.get();
    if (!editing || comp.firstRun) {
      return;
    } else if(comp.firstRun) {
      this.helpers.editTemplateData();
    }
    Tracker.afterFlush(() => {
      this.$("input").focus();
    });
  });
});
