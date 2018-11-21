import "./tableCell.html";

Template.dynamicTableTableCell.helpers({
  editing() {
    return Template.instance().editing.get();
  },
  editTemplateData() {
    const template = Template.instance();
    return _.extend({
      afterEditCallback() {
        template.editing.set(false);
      }
    }, this.editTemplateData);
  }
});


Template.dynamicTableTableCell.events({
  "click span"(e) {
    const td = $(e.currentTarget).closest("td");
    const tr = td.closest("tr");
    td.width(td.width());
    Template.instance().editing.set(true);
  }
});

Template.dynamicTableTableCell.onCreated(function onCreated() {
  this.editing = new ReactiveVar(false);
  this.autorun((comp) => {
    const editing = this.editing.get();
    if (!editing || comp.firstRun) {
      return;
    }
    Tracker.afterFlush(() => {
      this.$("input").focus();
    });
  });
});