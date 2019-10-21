import "./components/dynamicTableGroup/dynamicTableGroup.js";
import "./GroupedTable.html";
import "./components/manageGroupFieldsModal/manageGroupFieldsModal.js";
import { getColumns, getPosition, changed, getCustom } from "../inlineSave.js";

Template.GroupedTable.onRendered(function onRendered() {
  if (this.data.customGroupButtonSelector) {
    this.autorun(() => {
      const grouped = this.groupedBy.get();
      if (grouped) {
        $(`${this.data.customGroupButtonSelector}:first`).addClass("grouped");
      }
      else {
        $(`${this.data.customGroupButtonSelector}:first`).removeClass("grouped");
      }
    });
  }
});

Template.GroupedTable.onCreated(function onCreated() {
  this.customTableSpec = this.data;
  this.search = new ReactiveVar();
  this.customColumns = new ReactiveVar([]);
  this.groupedBy = new ReactiveVar(this.data.grouping);
  this.openGroups = new ReactiveVar([])
  this.searchFn = _.debounce(() => {
    this.search.set(this.$(".dynamic-table-global-search").val());
  }, 1000);
  const id = new ReactiveVar(this.data.id);
  this.autorun(() => {
    const data = Template.currentData();
    if (data.id !== Tracker.nonreactive(() => id.get())) {
      id.set(data.id);
    }
  });

  const callback = (custom) => {
    this.customColumns.set(_.compact((custom.columns || []).map(c => _.find(getColumns(this.data.columns) || [], c1 => c1.id ? c1.id === c.id : c1.data === c.data))));
    this.groupedBy.set(custom.groupedBy);
    this.openGroups.set(custom.openGroups || []);
  }
  const hasCustom = getCustom(this.data.custom, this.data.id, callback);
  if (! hasCustom) {
    const groupedBy = this.groupedBy.get();
    changed(this.customTableSpec.custom, this.customTableSpec.id, { groupedBy: groupedBy || null });
    getCustom(this.data.custom, this.data.id, callback);
  }

  this.documentMouseDown = (e) => {
    const manageGroupFieldsWrapper = $("#dynamic-table-manage-group-fields-modal")[0];
    if (manageGroupFieldsWrapper) {
      if ($(manageGroupFieldsWrapper).has(e.target).length) {
        return;
      }
      Blaze.remove(manageGroupFieldsWrapper.__blazeTemplate);
      manageGroupFieldsWrapper.innerHTML = "";
    }
  };

  document.addEventListener("mousedown", this.documentMouseDown);
});

Template.GroupedTable.onDestroyed(function onDestroyed() {
  document.removeEventListener("mousedown", this.documentMouseDown);
});
Template.GroupedTable.helpers({
  selector() {
    const data = Template.instance().data;
    const selector = _.extend({}, data.selector);
    const search = Template.instance().search.get();
    let searchSelector;
    if (search) {
      const searchVal = { $regex: search, $options: "i" };
      searchSelector = { $or: [] };
      const columns = _.unique(Template.instance().customColumns.get().length ? Template.instance().customColumns.get() : (data.columns || data.table.columns), c => c.data + c.id + c.search);
      columns.filter(c => c.searchable !== false).forEach((column) => {
        if (column.search) {
          searchSelector.$or.push(...column.search(_.extend({}, searchVal, { $options: column.searchOptions })));
        }
        else if (column.data) {
          searchSelector.$or.push({ [column.data]: _.extend({}, searchVal, { $options: column.searchOptions }) });
        }
      });
    }
    if (selector && Object.keys(selector).length && searchSelector) {
      return { $and: [selector, searchSelector] };
    }
    return searchSelector || selector;
  },
  expandAll() {
    if (this.expandAll !== undefined) {
      return this.expanAll;
    }
    return false;
  },
  lazy() {
    if (this.lazy !== undefined) {
      return this.lazy;
    }
    return true;
  },
  customTableSpec() {
    return Template.instance().customTableSpec;
  },
  groupedBy() {
    return Template.instance().groupedBy.get();
  },
  tableId() {
    return Template.instance().data.id;
  },
  openGroups() {
    return Template.instance().openGroups.get();
  }
});

Template.GroupedTable.events({
  "change .dynamic-table-global-search"(e, templInstance) {
    templInstance.searchFn();
  },
  "keydown .dynamic-table-global-search"(e, templInstance) {
    templInstance.searchFn();
  },
  "keyup .dynamic-table-global-search"(e, templInstance) {
    templInstance.searchFn();
  },
  "click a.manage-group-fields"(e, templInstance, extra) {
    e.preventDefault();
    const manageGroupFieldsOptions = {
      tableId: templInstance.data.id,
      dynamicTableSpec: templInstance.customTableSpec,
      groupedBy: templInstance.groupedBy,
      changeCallback(groupedBy) {
        // Needed to reset reactiveVar to false and than true to trigger template refresh.
        // Timeout creates a new scope so the helper is called twice: 1 - value is null; 2 - value is grouping. It forces the Template to refresh
        templInstance.groupedBy.set(null);
        Meteor.setTimeout(() => {
          templInstance.groupedBy.set(groupedBy && groupedBy.field || null);
        }, 0);
        changed(templInstance.customTableSpec.custom, templInstance.customTableSpec.id, { groupedBy: groupedBy && groupedBy.field || null });
      }
    };
    const target = extra ? extra.target : e.currentTarget;
    const bounds = getPosition(target);
    const left = Math.max((bounds.left + $(target).outerWidth()) - 350, 0);
    const div = $("#dynamic-table-manage-group-fields-modal").length ? $("#dynamic-table-manage-group-fields-modal") : $("<div>");
    div.attr("id", "dynamic-table-manage-group-fields-modal")
    .html("")
    .css("position", "absolute")
    .css("top", bounds.top + $(target).outerHeight())
    .css("left", left);

    if (div[0].__blazeTemplate) {
      Blaze.remove(div[0].__blazeTemplate);
    }
    div[0].__blazeTemplate = Blaze.renderWithData(
      Template.dynamicTableManageGroupFieldsModal,
      manageGroupFieldsOptions,
      div[0]
    );
    document.body.appendChild(div[0]);
    const tooFar = (left + 350) - $(window).width();
    if (tooFar > 0) {
      div.css("left", (left - (tooFar + 5)) + "px");
    }
  }
});
