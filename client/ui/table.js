import { ReactiveVar } from "meteor/reactive-var";
import { Modal } from "meteor/peppelg:bootstrap-3-modal";
import { EJSON } from "meteor/ejson";
import "./table.html";
import "./table.css";
import "./exportModal.js";
import "./components/filterModal/filterModal.js";
import "./advancedSearchModal.js";
import "./components/headerCell/headerCell.js";
import "./components/rawRender/rawRender.js";
import "./components/tableCell/tableCell.js";
import "./components/booleanValueEditor/booleanValueEditor.js";
import "./components/dateValueEditor/dateValueEditor.js";
import "./components/singleValueTextEditor/singleValueTextEditor.js";
import "./components/select2ValueEditor/select2ValueEditor.js";
import "./components/bulkEditModal/bulkEditModal.js";
import { getTableRecordsCollection } from "../db.js";

function escapeRegExp(string) {
  if (!_.isString(string)) {
    return string;
  }
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

/**
  @this Template.instance()
*/
function getSelector() {
  let selector = {};
  if (this.advancedSearch) {
    const advancedSearch = this.advancedSearch.get();
    selector = _.extend(selector, advancedSearch);
  }
  if (this.query) {
    const query = this.query.get();
    if (query && query.selector) {
      selector = _.extend(selector, query.selector);
    }
  }
  return selector;
}

/**
  @this Template.instance()
*/
function doAdvancedSearch(extraOptions) {
  const options = this.data.table;
  const templateInstance = this;
  Modal.show("dynamicTableAdvancedSearchModal", _.extend({
    beforeRender: options.advancedSearch.beforeRender,
    collection: options.advancedSearch.collection || this.data.table.collection,
    fields: options.advancedSearch.fields || _.compact(options.columns.map(column => column.data).filter(d => d !== "_id")),
    columns: options.columns,
    callback: options.advancedSearch.callback || ((search) => {
      if (_.keys(search).length) {
        templateInstance.$(".advanced-search-button").addClass("hasSearch");
      }
      else {
        templateInstance.$(".advanced-search-button").removeClass("hasSearch");
      }
      templateInstance.advancedSearch.set(search);
      const query = templateInstance.query.get();
      query.options.skip = 0;
      templateInstance.query.set(query);
      templateInstance.dataTable.api().page(0).draw(false);
    }),
    search: this.advancedSearch.get()
  }, _.isObject(extraOptions) ? extraOptions : {}));
}

/**
  @this Template.instance()
*/
function doExport(extraOptions) {
  const query = this.query.get();
  const advancedSearch = this.advancedSearch.get();
  if (!query) {
    return;
  }
  const queryOptions = query.options;
  const querySelector = query.selector;

  const table = this.data.table;
  if (!table.export.fields) {
    table.export.fields = this.columns.filter(column => column.data && column.data !== "_id").map(column => ({
      field: column.data
    }));
  }
  const schema = table.collection.simpleSchema && table.collection.simpleSchema();
  if (!table.export._fields) {
    table.export._fields = table.export.fields;
  }
  if (_.isFunction(table.export._fields)) {
    table.export.fields = table.export._fields(table.columns);
  }
  table.export.fields = table.export.fields.map((field) => {
    if (!_.isObject(field)) {
      field = { field };
    }
    if (!field.label) {
      const column = _.findWhere(this.columns, { data: field.field });
      if (column) {
        field.label = column.titleFn ? column.titleFn() : column.title;
      }
      else if (schema) {
        field.label = schema.label(field.field) || field.field;
      }
    }
    return field;
  });
  if (!table.export.fileName) {
    table.export.fileName = this.data.id;
  }

  Modal.show("dynamicTableExportModal", _.extend({}, {
    tableId: this.data.id,
    export: table.export,
    publication: table.publication,
    extraFields: table.extraFields || [],
    compositePublicationNames: table.compositePublicationNames,
    collection: table.collection,
    advancedSearch: {},
    selector: _.keys(advancedSearch).length ? { $and: [querySelector, advancedSearch] } : querySelector,
    skip: queryOptions.skip || 0,
    limit: queryOptions.limit,
    sort: queryOptions.sort,
    columns: this.columns
  }, _.isObject(extraOptions) ? extraOptions : {}));
}

/**
  @this Template.instance()
*/
function doBulkEdit(extraOptions) {
  Modal.show("bulkEditModal", {
    class: "modal-medium-height",
    title: `Edit ${extraOptions.selectedIds.length} ${extraOptions.set}`,
    documentIds: extraOptions.selectedIds,
    tableData: this.data
  });
}

function filterModalCallback(columnIndex, optionsOrQuery, operator, sortDirection, multiSort = false, redraw = true, forceChange = false) {
  const columns = this.dataTable.api().context[0].aoColumns;
  const order = this.dataTable.api().order().map(o => ({
    id: columns[o[0]].id,
    data: columns[o[0]].data,
    order: o[1]
  }));
  let fieldName = columns[columnIndex].data;
  if (columns[columnIndex].filterModal && columns[columnIndex].filterModal.field && columns[columnIndex].filterModal.field.name) {
    fieldName = columns[columnIndex].filterModal.field.name;
  }
  const existing = _.find(order, col => (col.id ? col.id === columns[columnIndex].id : col.data === columns[columnIndex].data));
  let changed = false;
  if (sortDirection !== undefined) {
    if (existing) {
      changed = existing.order !== (sortDirection === 1 ? "asc" : "desc");
      existing.order = sortDirection === 1 ? "asc" : "desc";
    }
    else if (multiSort) {
      order.push({
        id: columns[columnIndex].id,
        data: columns[columnIndex].data,
        order: sortDirection === 1 ? "asc" : "desc"
      });
      changed = true;
    }
    else {
      order.splice(0, order.length, {
        id: columns[columnIndex].id,
        data: columns[columnIndex].data,
        order: sortDirection === 1 ? "asc" : "desc"
      });
    }
    this.dataTable.api().order(order.map((o) => {
      const column = _.find(columns, c => (o.id ? c.id === o.id : c.data === o.data));
      return [
        columns.indexOf(column),
        o.order
      ];
    }));
  }

  // NOTE: we only want to run this code when triggered, not by an advanced search change.
  const advancedSearch = Tracker.nonreactive(() => this.advancedSearch.get());
  const startsWith = !columns[columnIndex].fullSearch;

  // NOTE: added .length to ensure correctness when disabling all options (e.g., add diagrams modal)
  // NOTE: added optionsOrQuery !== "" so you can clear the search by deleting text, not just clearing.
  if ((_.isArray(optionsOrQuery) && optionsOrQuery.length) || (optionsOrQuery !== undefined && optionsOrQuery !== "" && !_.isArray(optionsOrQuery))) {
    let newAdvancedSearchField;
    if (operator === "$between") {
      newAdvancedSearchField = {
        $lte: optionsOrQuery[1],
        $gte: optionsOrQuery[0]
      };
    }
    else if (operator === "$gte" || operator === "$lte" || operator === "$eq") {
      newAdvancedSearchField = {
        [operator]: optionsOrQuery
      };
    }
    else if (_.isArray(optionsOrQuery) && optionsOrQuery.length) {
      if (operator === "$not$all") {
        newAdvancedSearchField = { $not: { $all: optionsOrQuery } };
      }
      else {
        newAdvancedSearchField = { [operator]: optionsOrQuery };
      }
    }
    else if (!_.isArray(optionsOrQuery) && optionsOrQuery !== "") {
      newAdvancedSearchField = operator === "$regex" ? { $regex: `${startsWith ? "^" : ""}${escapeRegExp(optionsOrQuery)}` } : { $not: new RegExp(`${startsWith ? "^" : ""}${escapeRegExp(optionsOrQuery)}`) };
    }
    else if (optionsOrQuery === "") {

    }
    if (columns[columnIndex].search) {
      const toExtend = {};
      if (columns[columnIndex].searchOptions) {
        toExtend.$options = columns[columnIndex].searchOptions;
      }
      newAdvancedSearchField = columns[columnIndex].search(_.extend({}, newAdvancedSearchField, toExtend), false);
      let arrayToReplaceIn = advancedSearch.$and || [];
      let found = false;
      arrayToReplaceIn = arrayToReplaceIn.map((obj) => {
        const arr = obj.$or || obj.$and;
        if (_.isArray(newAdvancedSearchField)) {
          const matches = newAdvancedSearchField.some(searchObj => arr.find(oldObj => _.isEqual(_.sortBy(_.keys(searchObj)), _.sortBy(_.keys(oldObj)))));
          if (matches) {
            found = true;
            return { [obj.$or ? "$or" : "$and"]: newAdvancedSearchField };
          }
        }
        else {
          const matches = _.isEqual(_.sortBy(_.keys(newAdvancedSearchField)), _.sortBy(_.keys(obj)));
          if (matches) {
            found = true;
            return newAdvancedSearchField;
          }
        }
        return obj;
      });
      if (!found) {
        if (_.isArray(newAdvancedSearchField)) {
          const someOperator = ["$regex", "$in"].includes(operator) ? "$or" : "$and";
          arrayToReplaceIn.push({ [someOperator]: escapeRegExp(newAdvancedSearchField) });
        }
        else {
          arrayToReplaceIn.push(newAdvancedSearchField);
        }
      }
      if (!EJSON.equals(EJSON.toJSONValue(arrayToReplaceIn), EJSON.toJSONValue(advancedSearch.$and))) {
        advancedSearch.$and = arrayToReplaceIn;
        this.advancedSearch.set(advancedSearch);
        changed = true;
      }
    }
    else if (!EJSON.equals(EJSON.toJSONValue(advancedSearch[fieldName]), EJSON.toJSONValue(newAdvancedSearchField))) {
      const toExtend = {};
      if (columns[columnIndex].searchOptions) {
        toExtend.$options = columns[columnIndex].searchOptions;
      }
      if (newAdvancedSearchField) {
        advancedSearch[fieldName] = _.extend({}, newAdvancedSearchField, toExtend);
      }
      this.advancedSearch.set(advancedSearch);
      changed = true;
    }
  }
  else if (fieldName && advancedSearch[fieldName]) {
    delete advancedSearch[fieldName];
    this.advancedSearch.set(advancedSearch);
    changed = true;
  }
  else if (columns[columnIndex].search) {
    const searchResult = columns[columnIndex].search({ $regex: "" });
    let arrayToReplaceIn = advancedSearch.$and || [];
    arrayToReplaceIn = arrayToReplaceIn.map((obj) => {
      const arr = obj.$or || obj.$and;
      if (_.isArray(searchResult)) {
        const matches = searchResult.some(searchObj => arr.find(oldObj => _.isEqual(_.sortBy(_.keys(searchObj)), _.sortBy(_.keys(oldObj)))));
        if (matches) {
          return null;
        }
      }
      else {
        const matches = _.isEqual(_.sortBy(_.keys(searchResult)), _.sortBy(_.keys(obj)));
        if (matches) {
          return null;
        }
      }
      return obj;
    });
    arrayToReplaceIn = _.compact(arrayToReplaceIn);
    if (arrayToReplaceIn && arrayToReplaceIn.length) {
      advancedSearch.$and = arrayToReplaceIn;
    }
    else {
      delete advancedSearch.$and;
    }
    this.advancedSearch.set(advancedSearch);
    changed = true;
  }
  if (changed || forceChange) {
    if (this.data.modifyFilterCallback) {
      this.data.modifyFilterCallback(advancedSearch, order, columns);
    }
    if (redraw) {
      this.dataTable.loading.set(true);
      this.dataTable.api().draw();
    }
  }
}
/**
  @this Template.instance()
*/
function setup() {
  const self = this;
  const currentData = Tracker.nonreactive(() => Template.currentData());
  self.query.set(null);
  // NOTE: allow for subscription managers.
  self.subManager = currentData.table.sub;
  if (!self.subManager) {
    self.subManager = currentData.table.collection._connection || Meteor;
  }

  // NOTE: ensure we have clean data.
  currentData.table.extraFields = currentData.table.extraFields || [];
  self.columns = (currentData.table.columns || []).map(c => _.extend({}, c));
  self.columns.forEach((column) => {
    if (column.tmpl || column.editTmpl) {
      if (!column.defaultContent) {
        column.defaultContent = "";
      }
      const templateName = (column.tmpl && column.tmpl.viewName) || "Template.dynamicTableRawRender";

      column.createdCell = function createdCell(td, value, rowData, row, col) {
        const rawRowData = rowData;
        const rawContent = td.innerHTML ? td.innerHTML : value;
        td.innerHTML = "";
        if (column.tmplContext && rowData) {
          rowData = column.tmplContext(rowData, self.data);
        }
        const editRowData = {
          doc: rawRowData,
          column,
          collection: currentData.table.collection
        };
        const enableEdit = column.enableEdit ? column.enableEdit(rawRowData) : true;
        const actualColumn = self.dataTable.api().context[0].aoColumns[col];
        const blazeColumnIndex = actualColumn._ColReorder_iOrigCol || col;
        if (self.blaze[`${row}-${blazeColumnIndex}`]) {
          if (self.blaze[`${row}-${blazeColumnIndex}`].name === templateName && self.blaze[`${row}-${blazeColumnIndex}`].idOrData === (column.id || column.data)) {
            td.parentElement.replaceChild(self.blaze[`${row}-${blazeColumnIndex}`].cell, td);
            self.blaze[`${row}-${blazeColumnIndex}`].tmpl.dataVar.set({
              editable: !!column.editTmpl && enableEdit,
              templateName: templateName.split(".")[1],
              templateData: column.tmpl ? rowData : rawContent,
              editTemplateName: column.editTmpl && column.editTmpl.viewName.split(".")[1],
              editTemplateData: () => (column.editTmplContext ? column.editTmplContext(editRowData) : editRowData)
            });
            return self.blaze[`${row}-${blazeColumnIndex}`].tmpl;
          }
          delete self.blaze[`${row}-${blazeColumnIndex}`];
        }
        const ret = Blaze.renderWithData(Template.dynamicTableTableCell, {
          editable: !!column.editTmpl && enableEdit,
          templateName: templateName.split(".")[1],
          templateData: column.tmpl ? rowData : rawContent,
          editTemplateName: column.editTmpl && column.editTmpl.viewName.split(".")[1],
          editTemplateData: () => (column.editTmplContext ? column.editTmplContext(editRowData) : editRowData)
        }, td, self.view);
        self.blaze[`${row}-${blazeColumnIndex}`] = {
          idOrData: column.id || column.data,
          name: templateName,
          cell: td,
          tmpl: ret
        };
        return ret;
      };

      if (!column.render && column.data) {
        column.render = function render(data, type) {
          // NOTE: changing this causes problems above with rawContent, why it needs to be "" (versus the value or undefined) is anyones guess.
          return data; // type === "display" ? "" : data;
        };
      }
    }

    if (!column.defaultContent) {
      column.defaultContent = column.defaultContent || "";
    }
  });
  if (currentData.table.search === undefined) {
    currentData.table.search = {
      caseInsensitive: true,
      regex: true
    };
  }
  else {
    if (currentData.table.search.caseInsensitive === undefined) {
      currentData.table.search.caseInsensitive = true;
    }
    if (currentData.table.search.regex === undefined) {
      currentData.table.search.regex = true;
    }
  }
}

/**
  @param data Object - the first argument to the ajax call
  @param options Object - the global options of the data subscription
  @param currentData Object - the arguments passed into the template.
*/
function ajaxOptions(data, options, columns) {
  const pageOptions = {
    skip: data.start
  };
  if (data.length && data.length !== -1) {
    pageOptions.limit = data.length;
  }
  if (data.order) {
    pageOptions.sort = {};
    data.order.forEach((order, index) => {
      if (columns[order.column] && (columns[order.column].data || columns[order.column].sortField)) {
        if (columns[order.column].sortField) {
          pageOptions.sort[columns[order.column].sortField] = 1 * (order.dir === "desc" ? -1 : 1);
        }
        else {
          pageOptions.sort[columns[order.column].data] = 1 * (order.dir === "desc" ? -1 : 1);
        }
      }
    });
  }

  return _.extend({}, options, pageOptions);
}

/**
  @param data Object - the first argument to the ajax call
  @param selector Object - the selector for the raw query (no search)
  @param currentData Object - the arguments passed into the template.
*/
function ajaxSelector(data, selector, columns, caseInsensitive) {
  const querySelector = _.extend({}, selector);
  if (data.search && data.search.value !== "") {
    querySelector.$or = querySelector.$or || [];
    const search = (data.search.regex || caseInsensitive) ? {
      $regex: escapeRegExp(data.search.value)
    } : data.search.value;

    if (caseInsensitive) {
      search.$options = "i";
    }

    columns.forEach((column) => {
      if (_.isFunction(column.search)) {
        querySelector.$or = _.union(querySelector.$or, column.search(search));
      }
      else if (column.data && column.searchable !== false) {
        querySelector.$or.push({ [column.data]: search });
      }
    });
  }
  return querySelector;
}

function getOptions(currentData, columns) {
  // NOTE: we want all fields defined in columns + all extraFields
  let fields = _.union(_.unique(_.compact(_.pluck(columns, "data"))), currentData.table.extraFields);
  fields = fields.filter(field => field.includes && (!field.includes(".") || !fields.includes(field.split(".")[0])));
  const fieldsObject = _.object(fields, _.times(fields.length, () => true));
  const options = _.extend({ fields: fieldsObject }, currentData.table.subscriptionOptions || {});

  // NOTE: if we have a hard limit (e.g., no paging specified)
  if (currentData.table.limit) {
    options.limit = currentData.table.limit;
  }
  return options;
}
Template.DynamicTable.onRendered(function onRendered() {
  const self = this;
  const templateInstance = this;
  this.$tableElement = $(this.$("table")[0]);
  let lastId;

  this.$tableElement.data("get-selector", () => getSelector.apply(templateInstance));

  if (this.data.table.export) {
    this.$tableElement.data("do-export", (...args) => {
      doExport.apply(templateInstance, args);
    });
  }

  if (this.data.table.bulkEditOptions) {
    this.$tableElement.data("do-bulkEdit", (...args) => {
      doBulkEdit.apply(templateInstance, args);
    });
  }


  if (this.data.table.advancedSearch) {
    this.$tableElement.data("do-advancedSearch", (...args) => {
      doAdvancedSearch.apply(templateInstance, args);
    });
  }
  this.autorun(() => {
    templateInstance.tableId.get();
    const currentData = Tracker.nonreactive(() => Template.currentData());// NOTE: intentionally not reactive.
    setup.call(self);
    const options = getOptions(currentData, self.columns);

    // TODO: left in for compatibility - to be removed.
    const tableSpec = _.extend({
      serverSide: true,
      initComplete() {
        const table = templateInstance.data.table;
        if (table.advancedSearch && table.advancedSearch.isHidden !== true) {
          const advancedSearchButton = currentData.table.advancedSearch.buttonHtml ? $(currentData.table.advancedSearch.buttonHtml) : $("<buton>").addClass("advanced-search-button")
          .addClass("btn btn-default")
          .html("<i class='fa fa-search'></i>")
          .css("margin-top", "-10px");
          templateInstance.$(".dataTables_filter>label").append(advancedSearchButton);
        }
        if (table.search && table.search.onEnterOnly) {
          const replaceSearchLabel = (newText) => {
            $(".dataTables_filter label").contents().filter(function filter() {
              return this.nodeType === 3 && this.textContent.trim().length;
            }).replaceWith(newText);
          };
          $(".dataTables_filter input")
          .unbind()
          .bind("keyup change", (event) => {
            if (!templateInstance.dataTable) return;
            if (event.keyCode === 13 || this.value === "") {
              replaceSearchLabel("Search:");
              templateInstance.dataTable.search(this.value).draw();
            }
            else {
              replaceSearchLabel("Search (hit enter):");
            }
          });
        }
      },
      headerCallback(headerRow) {
        const columns = self.dataTable.fnSettings().aoColumns;

        $(headerRow).find("td,th").each((index, headerCell) => {
          if (columns[index].titleTmpl) {
            if (headerCell.__blazeViewInstance) {
              Blaze.remove(headerCell.__blazeViewInstance);
            }
            headerCell.innerHTML = "";
            headerCell.__blazeViewInstance = Blaze.renderWithData(
              columns[index].titleTmpl,
              columns[index].titleTmplContext ? columns[index].titleTmplContext(templateInstance.data) : {},
              headerCell
            );
          }
          else if (columns[index].filterModal) {
            if (headerCell.__blazeViewInstance) {
              Blaze.remove(headerCell.__blazeViewInstance);
            }
            headerCell.innerHTML = "";
            headerCell.__blazeViewInstance = Blaze.renderWithData(
              Template.dynamicTableHeaderCell,
              {
                column: columns[index],
                columnIndex: index,
                table: currentData.table,
                dataTable: templateInstance.dataTable,
                advancedSearch: templateInstance.advancedSearch.get(),
                filterModalCallback: filterModalCallback.bind(self),
                removeColumn: templateInstance.data.removeColumn
              },
              headerCell
            );
          }
          else {
            const titleFunction = columns[index] && columns[index].titleFn;
            if (typeof titleFunction === "function") {
              headerCell.innerHTML = titleFunction();
            }
            else {
              headerCell.innerHTML = `<span>${headerCell.innerText}</span>`;
            }
          }
        });
      },
      ajax(data, callback) {
        const _selector = Tracker.nonreactive(() => templateInstance.selector.get());
        const selector = currentData.table.changeSelector ? currentData.table.changeSelector(_selector || {}) : (_selector || {});

        templateInstance.completeStart = new Date().getTime();
        const columns = self.dataTable && self.dataTable.api().context && self.dataTable.api().context[0] ? self.dataTable.api().context[0].aoColumns : self.columns;
        const options = getOptions(currentData, columns);
        // NOTE: the "ajax" call triggers a subscription rerun, iff queryOptions or querySelector has changed
        const queryOptions = ajaxOptions(data, options, columns);
        const querySelector = ajaxSelector(data, selector, columns, currentData.table.search.caseInsensitive);
        const query = {
          options: queryOptions,
          selector: querySelector
        };
        const oldQuery = Tracker.nonreactive(() => self.query.get());
        if (oldQuery && JSON.stringify(oldQuery && oldQuery.options && oldQuery.options.sort) !== JSON.stringify(queryOptions.sort)) {
          templateInstance.sorting = true;
        }
        if (JSON.stringify(Tracker.nonreactive(() => self.query.get())) !== JSON.stringify(query)) {
          self.query.set(query);
          templateInstance.ajaxCallback = callback;
        }
      }
    }, currentData.table, { columns: templateInstance.columns });
    if (templateInstance.dataTable) {
      templateInstance.dataTable.isReady = false;
      templateInstance.dataTable.api().destroy();
      if (currentData.id !== lastId) {
        templateInstance.$(`#${currentData.id}`).html("");
      }
      else {
        templateInstance.$(`#${currentData.id}`).find("thead").html("");
      }
    }
    lastId = currentData.id;
    tableSpec.drawCallback = () => {
      templateInstance.dataTable.loading.set(false);
    };
    templateInstance.dataTable = templateInstance.$(`#${currentData.id}`).dataTable(tableSpec);

    templateInstance.$(`#${currentData.id}`).on("init.dt", () => {
      if (currentData.table.pageNumber) {
        templateInstance.dataTable.api().page(currentData.table.pageNumber).draw(false);
      }
      templateInstance.dataTable.isReady = true;
    });
    if (tableSpec.lengthChangeCallback) {
      templateInstance.$(`#${currentData.id}`).on("length.dt", (e, settings, len) => {
        if (!templateInstance.dataTable.isReady) {
          return;
        }
        tableSpec.lengthChangeCallback(templateInstance.dataTable, len);
      });
    }
    if (tableSpec.pageChangeCallback) {
      templateInstance.$(`#${currentData.id}`).on("page.dt", () => {
        if (!templateInstance.dataTable.isReady) {
          return;
        }
        tableSpec.pageChangeCallback(templateInstance.dataTable, templateInstance.dataTable.api().page());
      });
    }
    if (tableSpec.orderCallback) {
      templateInstance.$(`#${currentData.id}`).on("order.dt", () => {
        if (!templateInstance.dataTable.isReady) {
          return;
        }
        if (tableSpec.orderCallback) {
          tableSpec.orderCallback(templateInstance.dataTable, templateInstance.dataTable.api().order());
        }
      });
    }
    if (tableSpec.sortable) {
      templateInstance.$(`#${currentData.id}>tbody`).sortable(tableSpec.sortable);
    }
    templateInstance.dataTable.loading = new ReactiveVar(true);
  });

  // NOTE: initialize the subscription according to the query options/selector
  this.autorun(() => {
    const currentData = templateInstance.data;
    const query = templateInstance.query.get();
    if (!query) {
      return;
    }
    const queryOptions = query.options;
    const querySelector = query.selector;
    const advancedSearch = templateInstance.advancedSearch.get();


    // NOTE: we dont want to rerun this since we're setting it just below
    let newSub;
    const subToStop = Tracker.nonreactive(() => {
      if (templateInstance.sub.get()) {
        if (templateInstance.sub.get().stop) {
          return templateInstance.sub.get();
        }
        self.subManager.clear();
      }
    });
    if (!currentData.table.publication) {
      templateInstance.loaded.set(true);
      return;
    }
    if (
      currentData.table.useArrayPublication
      || (currentData.table.useArrayPublication === undefined && (!currentData.table.compositePublicationNames || currentData.table.compositePublicationNames.length === 0))
    ) {
      templateInstance.loaded.set(false);
      newSub = self.subManager.subscribe(
        "__dynamicTableResultsArray",
        currentData.id,
        currentData.table.publication,
        _.keys(advancedSearch).length ? { $and: [querySelector, advancedSearch] } : querySelector,
        queryOptions
      );
      templateInstance.sub.set(newSub);
    }
    else {
      templateInstance.loaded.set(false);
      newSub = self.subManager.subscribe(
        "__dynamicTableResults",
        currentData.id,
        currentData.table.publication,
        currentData.table.compositePublicationNames,
        _.keys(advancedSearch).length ? { $and: [querySelector, advancedSearch] } : querySelector,
        queryOptions
      );
      templateInstance.sub.set(newSub);
    }
    if (subToStop && subToStop !== newSub && subToStop.subscriptionId !== newSub.subscriptionId) {
      subToStop.stop();
    }
  });

  // NOTE: wait for the subscription and then fetch and observe the data.
  this.autorun(() => {
    const ajaxCallback = templateInstance.ajaxCallback;
    templateInstance.tableId.get();
    const currentData = templateInstance.data;
    const query = templateInstance.query.get();
    if (!query) {
      return;
    }
    const queryOptions = query.options;
    let tableInfo = getTableRecordsCollection(currentData.table.collection._connection).findOne({ _id: currentData.id });
    if (!tableInfo && (Meteor.status().status === "offline" || !currentData.table.publication)) {
      const advancedSearch = templateInstance.advancedSearch.get();
      const options = _.extend({}, query.options);
      delete options.limit;
      delete options.skip;
      options.fields = { _id: true };
      const data = currentData.table.collection.find(_.keys(advancedSearch).length ? { $and: [query.selector, advancedSearch] } : query.selector, options).fetch();

      tableInfo = {
        recordsFiltered: data.length,
        recordsTotal: data.length,
        _ids: data.slice(queryOptions.skip || 0, (queryOptions.skip || 0) + (queryOptions.limit || 10000000)).map(i => i._id)
      };
    }
    if ((!currentData.table.publication || (templateInstance.sub.get() && templateInstance.sub.get().ready())) && tableInfo) {
      templateInstance.loaded.set(true);
      if (templateInstance.handle) {
        templateInstance.handle.stop();
      }
      let initializing = true;
      // NOTE: tableInfo._ids already contains the ids of the documents to find - so no skip
      const cursor = Tracker.nonreactive(() => currentData.table.collection.find({ _id: { $in: tableInfo._ids } }, _.omit(queryOptions, "skip")));
      const count = cursor.count(); // MUST BE REACTIVE to track document removals and additions in the case that we hit this line before all data is really added.
      let docs = Tracker.nonreactive(() => cursor.fetch());
      if (!this.sorting && currentData.table.sort) {
        docs = _.sortBy(docs, currentData.table.sort);
      }
      templateInstance.handle = cursor.observeChanges({
        _suppress_initial: true,
        // NOTE: the entire autorun block reruns when data is added/removed
        addedBefore() {},

        // NOTE:
        //      the entire autorun block reruns when data is moved in the sorted list
        //      (because tableInfo returns a new sortd list)
        //      a big optimization would be to not re-render the entire table on this
        //      just the rows that have changed, which could be the entire table :(
        movedBefore() {},

        // NOTE: when a document is changed, right now just re-render the entire row
        //       a future optimization would be to just re-render the cell that has changed.
        changed(_id) {
          if (!initializing) {
            // NOTE: we can't rely on tableInfo._ids being in order as we might run the sort locally.
            // const rowIndex = tableInfo._ids.indexOf(_id);

            const rowsData = _.toArray(templateInstance.dataTable.api().data());
            const rowIndex = rowsData.indexOf(_.findWhere(rowsData, { _id }));

            const rowData = currentData.table.collection.findOne({ _id });
            const columns = templateInstance.dataTable.fnSettings().aoColumns;
            try {
              const row = templateInstance.dataTable.api().row(rowIndex);
              row.context[0].aoData[row[0]]._aData = rowData;
              $(templateInstance.dataTable.api().row(rowIndex).node()).find("td,th").each((cellIndex) => {
                const column = columns[cellIndex];
                const blazeColumnIndex = column._ColReorder_iOrigCol || column.idx;
                if (column.tmpl || column.editTmpl) {
                  let changed = false;
                  const templateName = (column.tmpl && column.tmpl.viewName) || "Template.dynamicTableRawRender";
                  if (
                    templateInstance.blaze[`${rowIndex}-${blazeColumnIndex}`]
                    && templateInstance.blaze[`${rowIndex}-${blazeColumnIndex}`].tmpl
                    && templateInstance.blaze[`${rowIndex}-${blazeColumnIndex}`].name === templateName
                    && templateInstance.blaze[`${rowIndex}-${blazeColumnIndex}`].idOrData === (column.id || column.data)
                  ) {
                    const oldData = templateInstance.blaze[`${rowIndex}-${blazeColumnIndex}`].tmpl.dataVar.get();
                    if (column.tmpl) {
                      const newData = column.tmplContext ? column.tmplContext(rowData, templateInstance.data) : rowData;
                      try {
                        if (JSON.stringify(oldData.templateData) !== JSON.stringify(newData)) {
                          oldData.templateData = newData;
                          changed = true;
                        }
                      }
                      catch (e) {
                        oldData.templateData = newData;
                        changed = true;
                      }
                    }
                    else {
                      const newData = templateInstance.dataTable.api().cell(rowIndex, cellIndex).render("data");
                      try {
                        if (JSON.stringify(oldData.templateData) !== JSON.stringify(newData)) {
                          oldData.templateData = newData;
                          changed = true;
                        }
                      }
                      catch (e) {
                        oldData.templateData = newData;
                        changed = true;
                      }
                    }
                    const editRowData = {
                      doc: rowData,
                      column: templateInstance.columns[cellIndex],
                      collection: templateInstance.data.table.collection
                    };
                    const newData = templateInstance.columns[cellIndex].editTmplContext ? templateInstance.columns[cellIndex].editTmplContext(editRowData) : editRowData;
                    oldData.editTemplateData = newData;
                    if (changed) {
                      templateInstance.blaze[`${rowIndex}-${blazeColumnIndex}`].tmpl.dataVar.set(oldData);
                    }
                  }
                  else {
                    templateInstance.dataTable.api().cell(rowIndex, cellIndex).invalidate();
                  }
                }
                else {
                  templateInstance.dataTable.api().cell(rowIndex, cellIndex).invalidate();
                }
              });
            }
            catch (e) {
              // console.log(e);
            }
          }
        }
      });
      initializing = false;
      if (count < tableInfo._ids.length) {
        return;
      }

      // NOTE: if we have all the fields we need to sort on, we dont need to use the non-oplog observe call on the server, but we have to sort client side.
      const hasSortableFields = (!this.sorting && currentData.table.sort) || _.keys(queryOptions.fields || {}).length === 0 || _.intersection(_.keys(queryOptions.fields || {}), _.keys(queryOptions.sort || {})).length === _.keys(queryOptions.sort || {}).length;
      ajaxCallback({
        data: hasSortableFields ? docs : _.sortBy(docs, row => tableInfo._ids.indexOf(row._id)),
        recordsFiltered: tableInfo.recordsFiltered,
        recordsTotal: tableInfo.recordsTotal
      });
      if (this.sorting && currentData.table.sortable) {
        currentData.table.sortable.stop();
      }
      this.sorting = false;
    }
  });
});

let wrappedColReorder = false;
Template.DynamicTable.onCreated(function onCreated() {
  const self = this;

  if (!wrappedColReorder && $.fn.dataTableExt.oApi.fnColReorder) {
    wrappedColReorder = true;
    const oldFnColReorder = $.fn.dataTableExt.oApi.fnColReorder;
    $.fn.dataTableExt.oApi.fnColReorder = function fnColReorder(...args) {
      while (args.length < 5) {
        args.push(undefined);
      }
      if (args[args.length - 1] === undefined) {
        args[args.length - 1] = false;
      }
      oldFnColReorder.apply(this, args);
      // swaps columns in template. Needed for customizableTable to know how to order
      console.log("REORDERED: ", self.columns.map(c => c.title));
      const col = _.extend({}, self.columns[args[1]]);
      self.columns[args[1]] = _.extend({}, self.columns[args[2]]);
      self.columns[args[2]] = col;
      console.log("INTO: ", self.columns.map(c => c.title));
    };
  }
  this.loaded = new ReactiveVar(true);
  this.sub = new ReactiveVar(null);
  this.selector = new ReactiveVar({});
  this.options = new ReactiveVar({});
  this.query = new ReactiveVar(false);
  this.advancedSearch = new ReactiveVar(EJSON.fromJSONValue(this.data.advancedFilter || {}));
  this.incomingSelector = new ReactiveVar({});
  this.tableId = new ReactiveVar("");
  this._columns = new ReactiveVar([]);

  this.documentMouseDown = (e) => {
    const filterModalWrapper = $("#dynamic-table-filter-modal")[0];
    if (filterModalWrapper) {
      if ($(filterModalWrapper).has(e.target).length) {
        return;
      }
      Blaze.remove(filterModalWrapper.__blazeTemplate);
      filterModalWrapper.innerHTML = "";
    }
    const manageFieldsWrapper = $("#dynamic-table-manage-fields-modal")[0];
    if (manageFieldsWrapper) {
      if ($(manageFieldsWrapper).has(e.target).length) {
        return;
      }
      Blaze.remove(manageFieldsWrapper.__blazeTemplate);
      manageFieldsWrapper.innerHTML = "";
    }
  };

  document.addEventListener("mousedown", this.documentMouseDown);
  let oldColumns;
  this.autorun((comp) => {
    const columns = this._columns.get();
    if (comp.firstRun) {
      oldColumns = this.data.table.columns;
      return;
    }
    if (columns.length < oldColumns.length) {
      const context = this.dataTable.api().context[0];
      const missingColumn = context.aoColumns.find(nc => !_.find(columns, oc => (oc.id ? oc.id === nc.id : oc.data === nc.data)));
      let index = missingColumn.idx;
      const tdorh = this.$("thead").find(`td[data-column-index=${index}],th[data-column-index=${index}]`)[0];
      if (tdorh) { // NOTE: data-column-index is only added when colReorder is used
        index = _.toArray(this.$("thead>tr")[0].children).indexOf(tdorh);
      }
      this.$("thead").find(`td:nth-child(${index + 1}),th:nth-child(${index + 1})`).remove();
      this.$("tbody>tr").find(`td:nth-child(${index + 1}),th:nth-child(${index + 1})`).remove();
      this.dataTable.api().context[0].aoColumns.splice(index, 1);
      this.dataTable.api().context[0].aoData[0].anCells.splice(index, 1);
      this.blaze = {};
    }
    else if (columns.length > oldColumns.length){
      Tracker.afterFlush(() => {
        this.tableId.dep.changed();
        if (self.dataTable) {
          self.dataTable.api().ajax.reload();
        }
      });
    }
    oldColumns = columns;
  });
  let forceRefresh;
  this.autorun(() => {
    const currentData = Template.currentData();
    if (forceRefresh && forceRefresh !== currentData.forceRefresh) {
      this.tableId.dep.changed();
    }
    forceRefresh = currentData.forceRefresh;
  });
  this.autorun(() => {
    const currentData = Template.currentData();
    if (Tracker.nonreactive(() => self.tableId.get()) !== currentData.id) {
      oldColumns = currentData.table.columns.slice(0);
      self.tableId.set(currentData.id);
      oldColumns = currentData.table.columns.slice(0);
    }
    else if (Tracker.nonreactive(() => self._columns.get().length) !== currentData.table.columns.length) {
      if (!oldColumns) {
        oldColumns = currentData.table.columns;
      }
      self._columns.set(currentData.table.columns.slice(0));
    }
    if (JSON.stringify(Tracker.nonreactive(() => self.selector.get())) !== JSON.stringify(currentData.selector)) {
      self.selector.set(currentData.selector);
      if (self.dataTable) {
        self.dataTable.api().ajax.reload();
      }
    }
  });
  this.blaze = {};
});

// NOTE: cleanup
//       stop the subscription
//       stop the observer
//       destroy the data table and empty the actual table element
Template.DynamicTable.onDestroyed(function onDestroyed() {
  document.removeEventListener("mousedown", this.documentMouseDown);
  if (this.sub.get()) {
    if (this.sub.get().stop) {
      this.sub.get().stop();
    }
    else {
      this.subManager.clear();
    }
  }
  if (this.handle) {
    this.handle.stop();
  }
  if (this.tableElement && this.$tableElement.length) {
    const dt = this.$tableElement.DataTable();
    if (dt) {
      dt.destroy();
    }
    // this.$tableElement.html("");
  }
});

Template.DynamicTable.events({
  "click .advanced-search-button"() {
    doAdvancedSearch.call(Template.instance());
  }
});

Template.DynamicTable.helpers({
  loaded() {
    return Template.instance().loaded.get();
  }
});
