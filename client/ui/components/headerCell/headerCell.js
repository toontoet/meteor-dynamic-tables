import "./headerCell.html";
import "../filterModal/filterModal.js";
import { getPosition } from "../../../inlineSave.js";
import { EJSON } from "meteor/ejson";

Template.dynamicTableHeaderCell.onCreated(function onCreated() {
  this.columnTitle = new ReactiveVar();
  if (this.data.column.title) {
    this.columnTitle.set(this.data.column.title);
  }
  else if (this.data.column.titleFn) {
    this.columnTitle.set(this.data.column.titleFn());
  }
});

Template.dynamicTableHeaderCell.helpers({
  hasFilter() {
    const templInstance = Template.instance();
    const fieldName = (templInstance.data.column.filterModal.field && templInstance.data.column.filterModal.field.name) || templInstance.data.column.data;
    const columnSearch = templInstance.data.advancedSearch[fieldName];
    return columnSearch;
  },
  columnTitle() {
    return Template.instance().columnTitle.get() || "";
  }
});
Template.dynamicTableHeaderCell.events({
  "click .fa-filter"(e, templInstance) {
    e.preventDefault();
    e.stopPropagation();
    const order = templInstance.data.dataTable.api().order();
    const columns = templInstance.data.dataTable.api().context[0].aoColumns;
    const column = columns.find(c => (c.id && c.id === templInstance.data.column.id) || c.data === templInstance.data.column.data);
    const columnOrder = _.find(order, col => col[0] === column.idx);
    const fieldName = (templInstance.data.column.filterModal.field && templInstance.data.column.filterModal.field.name) || templInstance.data.column.data;
    const columnSearch = EJSON.fromJSONValue(templInstance.data.advancedSearch[fieldName]);
    let selectedOptions;
    let operator = "$in";
    let searchValue;
    if (columnSearch) {
      operator = _.keys(columnSearch)[0];
      if (operator === "$not") {
        if (columnSearch.$not.$all) {
          selectedOptions = columnSearch.$not.$all;
          operator = "$not$all";
        }
        else {
          searchValue = columnSearch.$not.toString().split("/").join("").slice(1);
        }
      }
      else if (operator === "$regex") {
        searchValue = columnSearch.$regex.slice(1);
      }
      else if (operator === "$lte") {
        searchValue = columnSearch.$lte;
        if (columnSearch.$gte) {
          operator = "$between";
        }
      }
      else if (operator === "$gte") {
        searchValue = columnSearch.$gte;
      }
      else if (columnSearch[operator]) {
        selectedOptions = columnSearch[operator];
      }
    }
    let sort = templInstance.data.column.filterModal.sort;
    if (!sort) {
      sort = templInstance.data.column.sortable !== false ? {
        enabled: true,
        direction: columnOrder ? (columnOrder[1] === "asc" ? 1 : -1) : undefined
      } : undefined;
    }
    else if (!sort.direction) {
      sort.direction = columnOrder ? (columnOrder[1] === "asc" ? 1 : -1) : undefined;
    }
    const schema = templInstance.data.table.collection._c2 && templInstance.data.table.collection._c2._simpleSchema;
    let type;
    if (schema) {
      const obj = schema.schema(fieldName);
      if (obj) {
        type = obj.type;
      }
    }
    const field = _.extend({
      type: type || String,
      name: fieldName,
      required: templInstance.data.column.required,
      label: templInstance.data.column.title
    }, templInstance.data.column.filterModal.field || {});

    const filterModalOptions = {
      dataTable: templInstance.data.dataTable,
      column: templInstance.data.column,
      editFieldCallback(newFieldSpec) {
        const actualColumn = templInstance.data.dataTable.api().context[0].aoColumns.find(c => c.data === templInstance.data.column.data);
        if (newFieldSpec.data !== templInstance.data.column.data) {
          templInstance.data.filterModalCallback(templInstance.data.columnIndex, undefined, undefined, undefined, false, false);
          templInstance.data.column.search = newFieldSpec.search;
          templInstance.data.column.sortableField = newFieldSpec.sortableField;
          if (actualColumn) {
            actualColumn.data = newFieldSpec.data;
            actualColumn.mData = newFieldSpec.data;
            const mData = $.fn.dataTable.ext.internal._fnGetObjectDataFn(actualColumn.mData);
            const mRender = actualColumn.mRender ? $.fn.dataTable.ext.internal._fnGetObjectDataFn(actualColumn.mRender) : null;
            actualColumn.fnGetData = function fnGetData(rowData, _type, meta) {
              const innerData = mData(rowData, _type, undefined, meta);
              return mRender && _type ? mRender(innerData, _type, rowData, meta) : innerData;
            };
          }
          templInstance.data.column.data = newFieldSpec.data;
          templInstance.data.column.mData = newFieldSpec.data;
          templInstance.data.column.filterModal.field.name = newFieldSpec.filterModalField;
          templInstance.data.dataTable.api().ajax.reload();
          templInstance.data.filterModalCallback(templInstance.data.columnIndex, undefined, undefined, undefined, false, true, true);
        }

        if (templInstance.data.column.filterModal.groupNames) {
          filterModalOptions.groupNames = templInstance.data.column.filterModal.groupNames();
        }
        templInstance.data.table.columns[templInstance.data.columnIndex].group = newFieldSpec.groupName;
        templInstance.data.table.columns[templInstance.data.columnIndex].title = newFieldSpec.label;
        templInstance.data.column.group = newFieldSpec.groupName;
        templInstance.data.column.title = newFieldSpec.label;
        if (actualColumn) {
          if (actualColumn.nTh) {
            actualColumn.nTh.innerHTML = actualColumn.nTh.innerHTML.replace(actualColumn.title, newFieldSpec.label);
          }
          actualColumn.title = newFieldSpec.label;
        }
        templInstance.columnTitle.set(newFieldSpec.label);
      },
      field,
      sort,
      groupNames: templInstance.data.column.filterModal.groupNames ? templInstance.data.column.filterModal.groupNames() : [],
      filter: {
        enabled: true,
        search: {
          enabled: true,
          value: searchValue
        },
        options: templInstance.data.column.filterModal.options,
        selectedOptions,
        operator: {
          enabled: true,
          selected: operator
        }
      },
      removeColumn() {
        if (templInstance.data.removeColumn) {
          templInstance.data.removeColumn(column);
        }
      },
      callback(optionsOrQuery, operator, sort, multiSort) {
        templInstance.data.filterModalCallback(templInstance.data.columnIndex, optionsOrQuery, operator, sort, multiSort);
      }
    };
    const target = $(e.currentTarget).closest("th");
    const bounds = getPosition(target[0]);
    const div = $("#dynamic-table-filter-modal").length ? $("#dynamic-table-filter-modal") : $("<div>");
    const left = Math.max((bounds.left + target.outerWidth()) - 250, 0);
    div.attr("id", "dynamic-table-filter-modal")
    .html("")
    .css("position", "absolute")
    .css("top", bounds.top + target.outerHeight())
    .css("left", left);
    if (div[0].__blazeTemplate) {
      Blaze.remove(div[0].__blazeTemplate);
    }
    div[0].__blazeTemplate = Blaze.renderWithData(
      Template.dynamicTableFilterModal,
      filterModalOptions,
      div[0]
    );
    document.body.appendChild(div[0]);
  }
});
