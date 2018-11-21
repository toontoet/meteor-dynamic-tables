import "./headerCell.html";
import "../filterModal/filterModal.js";

function getPosition(el) {
  let xPos = 0;
  let yPos = 0;
  const width = $(el).width();
  while (el) {
    if (el.tagName === "BODY") {
      // deal with browser quirks with body/window/document and page scroll
      const xScroll = el.scrollLeft;// || document.documentElement.scrollLeft;
      const yScroll = el.scrollTop;// || document.documentElement.scrollTop;

      xPos += (el.offsetLeft - xScroll + el.clientLeft);
      yPos += (el.offsetTop - yScroll + el.clientTop);
    }
    else {
      // for all other non-BODY elements
      xPos += (el.offsetLeft - el.scrollLeft + el.clientLeft);
      yPos += (el.offsetTop - el.scrollTop + el.clientTop);
    }

    el = el.offsetParent;
  }
  return {
    left: xPos,
    top: yPos,
    width
  };
}

Template.dynamicTableHeaderCell.helpers({
  hasFilter() {
    const templInstance = Template.instance();
    const fieldName = (templInstance.data.column.filterModal.field && templInstance.data.column.filterModal.field.name) || templInstance.data.column.data;
    const columnSearch = templInstance.data.advancedSearch[fieldName];
    return columnSearch;
  }
});
Template.dynamicTableHeaderCell.events({
  "click .fa-filter"(e, templInstance) {
    e.preventDefault();
    e.stopPropagation();
    const order = templInstance.data.dataTable.api().order();
    const columnOrder = _.find(order, col => col[0] === templInstance.data.columnIndex);
    const fieldName = (templInstance.data.column.filterModal.field && templInstance.data.column.filterModal.field.name) || templInstance.data.column.data;
    const columnSearch = templInstance.data.advancedSearch[fieldName];
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
    const filterModalOptions = {
      dataTable: templInstance.data.dataTable,
      field: templInstance.data.column.filterModal.field || {
        type: String
      },
      sort,
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
      callback(optionsOrQuery, operator, sort) {
        templInstance.data.filterModalCallback(templInstance.data.columnIndex, optionsOrQuery, operator, sort);
      }
    };
    const bounds = getPosition(e.currentTarget);
    const div = $("#dynamic-table-filter-modal").length ? $("#dynamic-table-filter-modal") : $("<div>");
    div.attr("id", "dynamic-table-filter-modal")
    .html("")
    .css("position", "absolute")
    .css("top", bounds.top)
    .css("left", bounds.left + bounds.width);
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
