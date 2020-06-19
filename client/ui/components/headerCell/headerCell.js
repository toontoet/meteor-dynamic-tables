import "./headerCell.html";
import "../filterModal/filterModal.js";

import { EJSON } from "meteor/ejson";
import { getPosition } from "../../../inlineSave.js";
import { getColumnFields, formatQuery, getFields, getFirstFieldValue, getChainedFieldValue, arrayContains, arraysEqual } from "../../helpers.js";

function getSearch(advancedSearch, parentAdvancedSearch) {
  const getAndValue = value => {
    if(value && value.$and && value.$and.length == 1) {
      return value.$and[0];
    } else if(value && value.$and && value.$and.length > 1) {
      const result = {};
      value.$and.forEach(item => _.keys(item || {}).forEach(key => result[key] = item[key]));
      return result;
    }
  };
  return {
    $and: [_.extend({}, getAndValue(advancedSearch), getAndValue(parentAdvancedSearch))]
  };
}

Template.dynamicTableHeaderCell.onCreated(function onCreated() {
  this.columnTitle = new ReactiveVar();
  this.advancedFilter = new ReactiveVar(null);
  this.parentAdvancedSearch = new ReactiveVar(null);

  // The most common query is in the format {field1: {query}, field2: {query} $or: [queries]}.
  // In rare cases if there are multiple $or groups, they'll be put in an $and group.
  // This extra step ensures that those nested $or groups are pulled out and formatted the same way
  // as the other fields.
  const formatQueryAndGroup = queryAndGroup => {
    const keys = _.keys(queryAndGroup);
    let results = [];
    if(queryAndGroup.$and) {
      results = results.concat(queryAndGroup.$and);
    }
    if(keys.length && keys.length > 1) {
      keys.forEach(key => results.push({[key]: queryAndGroup[key]}));
    } else {
      results.push(queryAndGroup); 
    }
    return results;
  };

  this.autorun(() => {
    let { advancedFilter, parentFilters, column } = this.data;

    // Keep track of expected fields affected by this column.
    const fields = getColumnFields(column);
    const fieldName = (column.filterModal.field && column.filterModal.field.name) || column.data;
    const parentAdvancedSearch = { $and: [{}] };
    if(advancedFilter) {
      if(!advancedFilter.query || !advancedFilter.query.$and) {
        advancedFilter.query = {
          $and: [advancedFilter.query || {}]
        }
      }
      this.advancedFilter.set(advancedFilter.query);

      let query = formatQuery(advancedFilter.query);

      // The isComplexFilter flag changes the appearance of the filter modal
      // because it can only display the information if the filter is part of an AND group
      // and the field only has one operator applied to it.
      if(query.$or.length > 1 && query.$or[0].$and) {
        this.parentFilterData = {
          label: advancedFilter.label,
          triggerOpenFiltersModal: advancedFilter.triggerOpenFiltersModal,
          isComplexFilter: true
        }
      }

      query.$or.forEach(queryOrGroup => {
        queryOrGroup.$and.flatMap(queryAndGroup => formatQueryAndGroup(queryAndGroup)).forEach(queryAndGroup => {

          const currentFields = getFields(queryAndGroup);
          
          // This logic is done for the advanced search because if the filter has
          // multiple OR groups, we need another way to mark the column as active.
          // Slightly different from the logic below because the column can still
          // change a filter given it's just one OR group. If it's a parent, it can't
          if(currentFields.length && arrayContains(fields, currentFields)) {

            // We can marked this filter as active.
            this.filterActive = true;

            // When a filter is applied with more than one operator, force the use of the filters modal.
            // We mark it as a complex filter because the modal won't be able to display the information for a filter that has
            // multiple operators.
            fields.forEach(field => {
              if(!this.parentFilterData && queryAndGroup[field] && _.keys(queryAndGroup[field] || {}).length > 1) {
                this.parentFilterData = {
                  label: advancedFilter.label,
                  triggerOpenFiltersModal: advancedFilter.triggerOpenFiltersModal,
                  isComplexFilter: true
                }
              }
            });
          }
        });
      });
    } else {
      this.advancedFilter.set({});
    }

    // Go through the filters, find affected columns. If found, mark this
    // column as in use by a parent filter
    if(parentFilters) {
      parentFilters.forEach(filter => {

        // Make the structure of the query consistent
        query = formatQuery(filter.query);

        if(query.$or.length > 1 && query.$or[0].$and) {
          this.parentFilterData = {
            label: filter.label,
            triggerOpenFiltersModal: filter.triggerOpenFiltersModal,
            isComplexFilter: true
          }
        }

        query.$or.forEach(queryOrGroup => {
          queryOrGroup.$and.flatMap(queryAndGroup => formatQueryAndGroup(queryAndGroup)).forEach(queryAndGroup => {

            const currentFields = getFields(queryAndGroup);
            
            // If the current query condition has the same fields as the fields from the column,
            // or there's multiple $or groups, use the parent's information in the filter modal.
            if(currentFields.length && arrayContains(fields, currentFields)) {

              // We can marked this filter as active if there's a column affected by the parent filter.
              this.filterActive = true;
              if(!this.parentFilterData) {
                this.parentFilterData = {
                  label: filter.label,
                  triggerOpenFiltersModal: filter.triggerOpenFiltersModal,
                  isComplexFilter: false
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
    let advancedFilter = getSearch(templInstance.advancedFilter.get(), templInstance.parentAdvancedSearch.get());

    if(templInstance.filterActive) {
      return true;
    }

    const fieldName = (templInstance.data.column.filterModal.field && templInstance.data.column.filterModal.field.name) || templInstance.data.column.data;
    const searchFunction = templInstance.data.column.search;
    if (searchFunction) {
      const searchResult = searchFunction("");
      const advanceSearchAnd = advancedFilter.$and || [advancedFilter];
      if (advanceSearchAnd) {
        return advanceSearchAnd.some((query) => {
          const queryElements = query.$or || query.$and || query;
          if (_.isArray(queryElements) && _.isArray(searchResult)) {
            return !queryElements.some((qe, index) => {
              const sr = searchResult[index];
              return !_.isEqual(_.sortBy(_.keys(qe)), _.sortBy(_.keys(sr)));
            });
          }
          return arrayContains(_.sortBy(_.keys(queryElements)), _.sortBy(_.keys(searchResult)));
        });
      }
      return false;
    }
    const columnSearch = advancedFilter.$and[0][fieldName];
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
    const searchObject = getSearch(templInstance.advancedFilter.get(), templInstance.parentAdvancedSearch.get());;
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
        // Some search functions look at properties on the argument, so use an empty object.
        const searchResult = searchFunction({});
        const possibleQueries = getFields(searchResult).map(field => ({
            item: getFirstFieldValue(field, orColumnPreviousSearch),
            field
          })).filter(item => item && item.item && item.field);
        if(possibleQueries.length) {
          advanceSearchColQuery = possibleQueries[0].item;
          const field = possibleQueries[0].field;
          const operators = _.keys(advanceSearchColQuery[field] || {});
          if(operators.length) {
            operator = operators[0];
            value = getChainedFieldValue(advanceSearchColQuery[field][operator]);
            switch(operator) {
              case "$not":
                searchValue = value.toString().split("/").join("").slice(1);
                break;
              case "$regex":
                searchValue = value.substr(1);
                break;
              default:
                searchValue = value;
            }
            if(arraysEqual(["$gte", "$lte"], operators)) {
              operator = "$eq"
            }
          }
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
