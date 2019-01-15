import "./components/dynamicTableGroup/dynamicTableGroup.js";
import "./GroupedTable.html";
import "./components/manageGroupFieldsModal/manageGroupFieldsModal.js";
import { getPosition, changed, getCustom } from "../inlineSave.js";

Template.GroupedTable.onCreated(function onCreated() {
  this.groupChain = new ReactiveVar(_.compact((this.data.groupChain || []).map(gcf => this.data.groupableFields.find(gc => gc.field === gcf))));
  this.autorun(() => {
    console.log(Template.currentData());
  });
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

  getCustom(this.data.custom, (custom) => {
    if (custom.groupChainFields) {
      this.groupChain.set(_.compact(custom.groupChainFields.map(gcf => this.data.groupableFields.find(gc => gc.field === gcf))));
    }
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
  groupChain() {
    const groupChain = Template.instance().groupChain.get();
    return groupChain;
  }
});

Template.GroupedTable.events({
  "click a.manage-group-fields"(e, templInstance, extra) {
    e.preventDefault();
    const manageGroupFieldsOptions = {
      availableColumns: templInstance.data.groupableFields,
      selectedColumns: templInstance.groupChain.get(),
      changeCallback(columns) {
        templInstance.groupChain.set(columns);
        changed(templInstance.data.custom, { newGroupChainFields: columns.map(c => c.field) });
      }
    };
    const target = extra ? extra.target : e.currentTarget
    const bounds = getPosition(target);
    const div = $("#dynamic-table-manage-group-fields-modal").length ? $("#dynamic-table-manage-group-fields-modal") : $("<div>");
    div.attr("id", "dynamic-table-manage-group-fields-modal")
    .html("")
    .css("position", "absolute")
    .css("top", bounds.top + $(target).height())
    .css("left", bounds.left);

    if (div[0].__blazeTemplate) {
      Blaze.remove(div[0].__blazeTemplate);
    }
    div[0].__blazeTemplate = Blaze.renderWithData(
      Template.dynamicTableManageGroupFieldsModal,
      manageGroupFieldsOptions,
      div[0]
    );
    document.body.appendChild(div[0]);
    const tooFar = (bounds.left + div.width()) - $(window).width();
    if (tooFar > 0) {
      div.css("left", (bounds.left - (tooFar + 5)) + "px");
    }
  }
});
