import "./headerCell.html";
import "../filterModal/filterModal.js";

import { EJSON } from "meteor/ejson";
import { getPosition } from "../../../inlineSave.js";
import { getColumnFields, formatQuery, getFields, arrayContains } from "../../helpers.js";

Template.dynamicTableHeaderCell.onCreated(function onCreated() {
  this.columnTitle = new ReactiveVar();
  this.advancedSearch = new ReactiveVar(null);
  this.parentAdvancedSearch = new ReactiveVar(null);
  this.autorun(() => {
    let { advancedSearch, parentFilters, column } = this.data;
    if(!advancedSearch || !advancedSearch.$and) {
      advancedSearch = {
        $and: [advancedSearch || {}]
      }
    }
    this.advancedSearch.set(advancedSearch);
    
    // Keep track of expected fields affected by this column.
    const fields = getColumnFields(column);
    const fieldName = (column.filterModal.field && column.filterModal.field.name) || column.data;
    const parentAdvancedSearch = { $and: [{}] };

    // Add parent filter queries to advanced search.
    if(parentFilters) {
      parentFilters.forEach(filter => {

        // Make the structure of the query consistent
        const query = formatQuery(filter.query);

        if(query.$or.length > 1) {
          this.parentFilterData = {
            label: filter.label,
            triggerOpenFiltersModal: filter.triggerOpenFiltersModal,
            isMultiOrGroup: true
          }
        }

        query.$or.forEach(queryOrGroup => {
          queryOrGroup.$and.forEach(queryAndGroup => {

            const currentFields = getFields(queryAndGroup);
            
            // If the current query condition has the same fields as the fields from the column,
            // or there's multiple $or groups, use the parent's information in the filter modal.
            if(currentFields.length && arrayContains(fields, currentFields)) {

              // We can marked this filter as active if there's a column affected by the parent filter.
              this.hasParentFilter = true;
              if(!this.parentFilterData) {
                this.parentFilterData = {
                  label: filter.label,
                  triggerOpenFiltersModal: filter.triggerOpenFiltersModal,
                  isMultiOrGroup: false
                }
              }
            }
            _.extend(parentAdvancedSearch.$and[0], queryAndGroup);
          });
        });
      });
    }
    this.parentAdvancedSearch.set(parentAdvancedSearch);
  });
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
    let advancedSearch = {
      $and: [
        _.extend({}, templInstance.advancedSearch.get().$and[0], templInstance.parentAdvancedSearch.get().$and[0])
      ]
    };

    if(templInstance.hasParentFilter) {
      return true;
    }

    const fieldName = (templInstance.data.column.filterModal.field && templInstance.data.column.filterModal.field.name) || templInstance.data.column.data;
    const searchFunction = templInstance.data.column.search;
    if (searchFunction) {
      const searchResult = searchFunction("");
      const advanceSearchAnd = advancedSearch.$and || [advancedSearch];
      if (advanceSearchAnd) {
        return advanceSearchAnd.some((query) => {
          const queryElements = query.$or || query.$and || query;
          if (_.isArray(queryElements) && _.isArray(searchResult)) {
            return !queryElements.some((qe, index) => {
              const sr = searchResult[index];
              return !_.isEqual(_.sortBy(_.keys(qe)), _.sortBy(_.keys(sr)));
            });
          }
          return _.isEqual(_.sortBy(_.keys(queryElements)), _.sortBy(_.keys(searchResult)));
        });
      }
      return false;
    }
    const columnSearch = advancedSearch.$and[0][fieldName];
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
    const column = columns.find(c => (templInstance.data.column.id ? c.id === templInstance.data.column.id : c.data === templInstance.data.column.data));
    const columnOrder = _.find(order, col => col[0] === column.idx);
    const fieldName = (templInstance.data.column.filterModal.field && templInstance.data.column.filterModal.field.name) || templInstance.data.column.data;
    const searchObject = {
      $and: [
        _.extend({}, templInstance.advancedSearch.get().$and[0], templInstance.parentAdvancedSearch.get().$and[0])
      ]
    };
    const columnSearch = EJSON.fromJSONValue(searchObject.$and && searchObject.$and.length >= 1 ?
      searchObject.$and[0][fieldName] : searchObject[fieldName]);
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
        else if (columnSearch.$not.$exists) {
          operator = "$not$exists"
        }
        else {
          searchValue = columnSearch.$not.toString().split("/").join("").slice(1);
        }
      }
      else if (operator === "$regex") {
        searchValue = columnSearch.$regex.replace("^", "");
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
    else {
      const orColumnPreviousSearch = searchObject.$and || [];
      const searchFunction = templInstance.data.column.search;
      if (searchFunction) {
        const searchResult = searchFunction("custom_String--Match_ME-JUSTPLAYSS");
        const advanceSearchColQuery = orColumnPreviousSearch.find(query => _.isEqual(_.sortBy(_.keys(query.$or || query.$and || query)), _.sortBy(_.keys(searchResult))));
        const previousSearchObj = advanceSearchColQuery ? _.deepToFlat(advanceSearchColQuery.$or || advanceSearchColQuery.$and || advanceSearchColQuery) : {};
        const newSearchObject = _.deepToFlat(searchResult);
        let madeUpField = _.find(_.keys(newSearchObject), k => newSearchObject[k] === "custom_String--Match_ME-JUSTPLAYSS");
        if (!madeUpField) {
          madeUpField = _.keys(searchResult)[0];
        }
        if (previousSearchObj[`${madeUpField}.$not`]) {
          operator = "$not";
          searchValue = previousSearchObj[`${madeUpField}.$not`].toString().split("/").join("").slice(1);
        }
        else if (previousSearchObj[`${madeUpField}.$regex`]) {
          operator = "$regex";
          searchValue = previousSearchObj[`${madeUpField}.$regex`].slice(1);
        }
        else if (previousSearchObj[`${madeUpField}.$eq`] !== undefined) {
          operator = "$eq";
          searchValue = previousSearchObj[`${madeUpField}.$eq`];
        }
        else if (previousSearchObj[`${madeUpField}.$in`]) {
          operator = "$in";
          selectedOptions = previousSearchObj[`${madeUpField}.$in`];
        }
        else if (previousSearchObj[`${madeUpField}.$nin`]) {
          operator = "$nin";
          selectedOptions = previousSearchObj[`${madeUpField}.$nin`];
        }
        else if (previousSearchObj[`${madeUpField}.$gte`] && previousSearchObj[`${madeUpField}.$lte`]) {
          operator = "$eq";
          searchValue = previousSearchObj[`${madeUpField}.$gte`];
        }
        else if (previousSearchObj[`${madeUpField}.$gte`]) {
          operator = "$gte";
          searchValue = previousSearchObj[`${madeUpField}.$gte`];
        }
        else if (previousSearchObj[`${madeUpField}.$gte`]) {
          operator = "lgte";
          searchValue = previousSearchObj[`${madeUpField}.$lte`];
        }
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
          templInstance.data.column.sortableField = newFieldSpec.sortField || newFieldSpec.sortableField;
          templInstance.data.column.sortField = newFieldSpec.sortField || newFieldSpec.sortableField;
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
          if (actualColumn.nTh && actualColumn.nTh.children.length) {
            Blaze.getView(actualColumn.nTh.children[0]).templateInstance().columnTitle.set(newFieldSpec.label);
            // actualColumn.nTh.innerHTML = actualColumn.nTh.innerHTML.replace(new RegExp(actualColumn.title, "g"), newFieldSpec.label);
          }
          actualColumn.title = newFieldSpec.label;
        }
        templInstance.columnTitle.set(newFieldSpec.label);
      },
      field,
      sort,
      groupNames: templInstance.data.column.filterModal.groupNames ? templInstance.data.column.filterModal.groupNames() : [],
      filter: {
        enabled: (templInstance.data.column.filter && typeof templInstance.data.column.filter.enabled === "boolean") ? templInstance.data.column.filter.enabled : true,
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
      parentFilterData: templInstance.parentFilterData,
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
