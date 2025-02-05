import "./components/dynamicTableGroup/dynamicTableGroup.js";
import "./GroupedTable.html";
import "./components/manageGroupFieldsModal/manageGroupFieldsModal.js";
import { getColumns, getPosition, changed, getCustom } from "../inlineSave.js";

Template.GroupedTable.onRendered(function onRendered() {
  if (this.data.customGroupButtonSelector) {
    this.autorun(() => {
      const chain = this.groupChain.get();
      if (chain.length) {
        $(this.data.customGroupButtonSelector).addClass("grouped");
      }
      else {
        $(this.data.customGroupButtonSelector).removeClass("grouped");
      }
    });
  }
});

Template.GroupedTable.onCreated(function onCreated() {
  this.customTableSpec = this.data;
  this.search = new ReactiveVar();
  this.customColumns = new ReactiveVar([]);
  this.groupChain = new ReactiveVar(_.compact((this.data.groupChain || []).map(gcf => this.data.groupableFields.find(gc => gc.field === gcf))));

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
  this.autorun(() => {
    id.get();
    getCustom(this.data.custom, this.data.id, (custom) => {
      this.customColumns.set(_.compact((custom.columns || []).map(c => _.find(getColumns(this.data.columns) || [], c1 => c1.id ? c1.id === c.id : c1.data === c.data))));
      if (custom.groupChainFields) {
        this.groupChain.set(_.compact(custom.groupChainFields.map(gcf => this.data.groupableFields.find(gc => gc.field === gcf))));
      }
    });
  });
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
      const columns = _.unique(Template.instance().customColumns.get().length ? Template.instance().customColumns.get() : getColumns(data.columns || data.table.columns), c => c.data + c.id + c.search);
      columns.filter(c => c.searchable !== false).forEach((column) => {
        if (column.search) {
          let res = column.search(_.extend({}, searchVal, { $options: column.searchOptions }));
          if (!_.isArray(res)) {
            res = [res];
          }
          searchSelector.$or.push(...res);
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
  aGroupChain() {
    const groupChain = Template.instance().groupChain.get();
    return groupChain;
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
      availableColumns: templInstance.data.groupableFields,
      selectedColumns: templInstance.groupChain.get(),
      changeCallback(columns) {
        templInstance.groupChain.set(columns);
        changed(templInstance.data.custom, templInstance.data.id, { newGroupChainFields: columns.map(c => c.field) });
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
