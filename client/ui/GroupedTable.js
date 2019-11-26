import "./components/dynamicTableGroup/dynamicTableGroup.js";
import "./GroupedTable.html";

import "./components/manageGroupFieldsModal/manageGroupFieldsModal.js";
import "./components/manageAspectsModal/manageAspectsModal.js";
import { getColumns, getPosition, changed, getCustom, createModal} from "../inlineSave.js";

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
  this.groupChain = new ReactiveVar(_.compact((this.data.defaultGrouping || []).map(gcf => this.data.groupableFields.find(gc => gc.field === gcf))));
  this.aspects = new ReactiveVar(this.data.defaultOrder);
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
      this.aspects.set(custom.order);
      if (custom.groupChainFields) {
        this.groupChain.set(custom.groupChainFields);
      }
    });
  });
  this.documentMouseDown = (e) => {
    const modalIds = ["dynamic-table-manage-aspects-modal", "dynamic-table-manage-group-fields-modal"];
    modalIds.forEach(id => {
      const manageGroupFieldsWrapper = $(`#${id}`)[0];
      if (manageGroupFieldsWrapper) {
        if ($(manageGroupFieldsWrapper).has(e.target).length) {
          return;
        }
        Blaze.remove(manageGroupFieldsWrapper.__blazeTemplate);
        manageGroupFieldsWrapper.innerHTML = "";
      }
    });
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
  },
  tableId() {
    return Template.instance().data.id;
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
  "click span.grouped-table-manage-controller.groups"(e, templInstance, extra) {
    const modalMeta = {
      template: Template.dynamicTableManageGroupFieldsModal,
      id: "dynamic-table-manage-group-fields-modal",
      options: {
        availableColumns: templInstance.data.groupableFields,
        selectedColumns: templInstance.groupChain.get(),
        changeCallback(columns) {
          templInstance.groupChain.set([]);
          Meteor.setTimeout(() => templInstance.groupChain.set(columns), 0);
          changed(templInstance.data.custom, templInstance.data.id, { newGroupChainFields: columns });
        }
      }
    }
    const target = extra ? extra.target : e.currentTarget;
    createModal(target, modalMeta, templInstance);
  },
  "click span.grouped-table-manage-controller.aspects"(e, templInstance, extra) {
    const modalMeta = {
      template: Template.dynamicTableManageAspectsModal,
      id: "dynamic-table-manage-aspects-modal",
      options: {
        availableColumns: templInstance.data.groupableFields,
        aspects: templInstance.aspects.get(),
        changeCallback(aspects) {
          templInstance.aspects.set(aspects);
          changed(templInstance.data.custom, templInstance.data.id, { newOrder: aspects });
        }
      }
    };
    const target = extra ? extra.target : e.currentTarget;
    createModal(target, modalMeta, templInstance);
  }
});
