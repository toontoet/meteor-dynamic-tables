import { ReactiveVar } from "meteor/reactive-var";
import { Modal } from "meteor/peppelg:bootstrap-3-modal";
import "./table.html";
import "./exportModal.js";
import "./components/filterModal/filterModal.js";
import "./advancedSearchModal.js";
import "./components/headerCell/headerCell.js";
import { getTableRecordsCollection } from "../db.js";


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
  const templateInstance = this;
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

function filterModalCallback(columnIndex, optionsOrQuery, operator, sortDirection) {
  const order = this.dataTable.api().order();
  const existing = _.find(order, col => col[0] === columnIndex);
  let fieldName = this.columns[columnIndex].data;
  if (this.columns[columnIndex].filterModal && this.columns[columnIndex].filterModal.field && this.columns[columnIndex].filterModal.field.name) {
    fieldName = this.columns[columnIndex].filterModal.field.name;
  }
  let changed = false;
  if (existing) {
    changed = existing[1] !== (sortDirection === 1 ? "asc" : "desc");
    existing[1] = sortDirection === 1 ? "asc" : "desc";
  }
  else {
    order.push([columnIndex, sortDirection === 1 ? "asc" : "desc"]);
    changed = true;
  }
  this.dataTable.api().order(order);
  const advancedSearch = this.advancedSearch.get();

  if (fieldName && optionsOrQuery) {
    let newAdvancedSearchField;
    if (_.isArray(optionsOrQuery) && optionsOrQuery.length) {
      if (operator === "$not$all") {
        newAdvancedSearchField = { $not: { $all: optionsOrQuery } };
      }
      else {
        newAdvancedSearchField = { [operator]: optionsOrQuery };
      }
    }
    else if (!_.isArray(optionsOrQuery) && optionsOrQuery !== "") {
      newAdvancedSearchField = operator === "$regex" ? { $regex: `^${optionsOrQuery}` } : { $not: new RegExp(`^${optionsOrQuery}`) };
    }
    if (JSON.stringify(advancedSearch[fieldName]) !== JSON.stringify(newAdvancedSearchField)) {
      advancedSearch[fieldName] = newAdvancedSearchField;
      this.advancedSearch.set(advancedSearch);
      changed = true;
    }
  }
  else if (fieldName && advancedSearch[fieldName]) {
    delete advancedSearch[fieldName];
    this.advancedSearch.set(advancedSearch);
    changed = true;
  }
  if (changed) {
    this.dataTable.loading.set(true);
    this.dataTable.api().draw();
  }
}
/**
  @this Template.instance()
*/
function setup() {
  const self = this;
  const currentData = this.data;
  self.query.set(null);
  // NOTE: allow for subscription managers.
  if (!currentData.table.sub) {
    currentData.table.sub = currentData.table.collection._connection || Meteor;
  }

  // NOTE: ensure we have clean data.
  currentData.table.extraFields = currentData.table.extraFields || [];
  self.columns = (currentData.table.columns || []).map(c => _.extend({}, c));
  self.columns.forEach((column) => {
    if (column.tmpl) {
      if (!column.defaultContent) {
        column.defaultContent = "";
      }

      column.createdCell = function createdCell(td, UNUSED, rowData, row, col) {
        if (column.tmplContext && rowData) {
          rowData = column.tmplContext(rowData);
        }
        if (self.blaze[`${row}-${col}`]) {
          if (self.blaze[`${row}-${col}`].name === column.tmpl.viewName) {
            td.parentElement.replaceChild(self.blaze[`${row}-${col}`].cell, td);
            self.blaze[`${row}-${col}`].tmpl.dataVar.set(rowData);
            return self.blaze[`${row}-${col}`].tmpl;
          }
          delete self.blaze[`${row}-${col}`];
        }
        const ret = Blaze.renderWithData(column.tmpl, rowData, td, self.view);
        self.blaze[`${row}-${col}`] = {
          name: column.tmpl.viewName,
          cell: td,
          tmpl: ret
        };
        return ret;
      };

      if (!column.render && column.data) {
        column.render = function render(data, type) {
          return type === "display" ? "" : data;
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
    querySelector.$or = [];
    const search = (data.search.regex || caseInsensitive) ? {
      $regex: data.search.value.split("\\").join("\\\\")
    } : data.search.value;

    if (caseInsensitive) {
      search.$options = "i";
    }

    columns.forEach((column) => {
      if (_.isFunction(column.search)) {
        querySelector.$or = _.union(querySelector.$or, column.search(search, Meteor.userId()));
      }
      else if (column.data && column.searchable !== false) {
        querySelector.$or.push({ [column.data]: search });
      }
    });
  }
  return querySelector;
}

Template.DynamicTable.onRendered(function onRendered() {
  const self = this;
  const templateInstance = this;
  this.$tableElement = $(this.$("table")[0]);

  if (this.data.table.export) {
    this.$tableElement.data("do-export", (...args) => {
      doExport.apply(templateInstance, args);
    });
  }

  if (this.data.table.advancedSearch) {
    this.$tableElement.data("do-advancedSearch", (...args) => {
      doAdvancedSearch.apply(templateInstance, args);
    });
  }
  this.autorun(() => {
    templateInstance.tableId.get();
    const currentData = Template.instance().data;// NOTE: intentionally not reactive.
    setup.call(self);
    // NOTE: we want all fields defined in columns + all extraFields
    const fields = _.union(_.unique(_.compact(_.pluck(self.columns, "data"))), currentData.table.extraFields);
    const options = _.extend({ fields: _.object(fields, _.times(fields.length, () => true)) }, currentData.table.subscriptionOptions || {});

    // NOTE: if we have a hard limit (e.g., no paging specified)
    if (currentData.table.limit) {
      options.limit = currentData.table.limit;
    }

    // NOTE: if we have a changeSelector method specified, use it.
    // TODO: left in for compatibility - to be removed.
    const tableSpec = _.extend({
      serverSide: true,
      initComplete() {
        const table = templateInstance.data.table;
        if (table.advancedSearch) {
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
        const columns = self.columns;

        $(headerRow).find("td,th").each((index, headerCell) => {
          if (columns[index].titleTmpl) {
            if (headerCell.__blazeViewInstance) {
              Blaze.remove(headerCell.__blazeViewInstance);
            }
            headerCell.innerHTML = "";
            headerCell.__blazeViewInstance = Blaze.renderWithData(
              columns[index].titleTmpl,
              columns[index].titleTmplContext ? columns[index].titleTmplContext() : {},
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
                filterModalCallback: filterModalCallback.bind(self)
              },
              headerCell
            );
          }
          else {
            const titleFunction = columns[index] && columns[index].titleFn;
            if (typeof titleFunction === "function") {
              headerCell.innerHTML = titleFunction();
            }
          }
        });
      },
      ajax(data, callback) {
        const _selector = Tracker.nonreactive(() => templateInstance.selector.get());
        const selector = currentData.table.changeSelector ? currentData.table.changeSelector(_selector || {}) : (_selector || {});

        templateInstance.completeStart = new Date().getTime();
        // NOTE: the "ajax" call triggers a subscription rerun, iff queryOptions or querySelector has changed
        const queryOptions = ajaxOptions(data, options, self.columns);
        const querySelector = ajaxSelector(data, selector, self.columns, currentData.table.search.caseInsensitive);
        const query = {
          options: queryOptions,
          selector: querySelector
        };
        if (JSON.stringify(Tracker.nonreactive(() => self.query.get())) !== JSON.stringify(query)) {
          self.query.set(query);
          templateInstance.ajaxCallback = callback;
        }
      }
    }, currentData.table, { columns: templateInstance.columns });
    if (templateInstance.dataTable) {
      templateInstance.dataTable.api().destroy();
      templateInstance.$(`#${currentData.id}`).html("");
    }
    tableSpec.drawCallback = () => {
      templateInstance.dataTable.loading.set(false);
    };
    templateInstance.dataTable = templateInstance.$(`#${currentData.id}`).dataTable(tableSpec);
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
    Tracker.nonreactive(() => {
      if (templateInstance.sub.get()) {
        if (templateInstance.sub.get().stop) {
          templateInstance.sub.get().stop();
        }
        else {
          currentData.table.sub.clear();
        }
      }
    });
    if (
      currentData.table.useArrayPublication ||
      (currentData.table.useArrayPublication === undefined && (!currentData.table.compositePublicationNames || currentData.table.compositePublicationNames.length === 0))
    ) {
      templateInstance.sub.set(currentData.table.sub.subscribe(
        "simpleTablePublicationArray",
        currentData.id,
        currentData.table.publication,
        _.keys(advancedSearch).length ? { $and: [querySelector, advancedSearch] } : querySelector,
        queryOptions
      ));
    }
    else {
      templateInstance.sub.set(currentData.table.sub.subscribe(
        "simpleTablePublication",
        currentData.id,
        currentData.table.publication,
        currentData.table.compositePublicationNames,
        _.keys(advancedSearch).length ? { $and: [querySelector, advancedSearch] } : querySelector,
        queryOptions
      ));
    }
  });

  // NOTE: wait for the subscription and then fetch and observe the data.
  this.autorun(() => {
    templateInstance.tableId.get();
    const currentData = templateInstance.data;
    const query = templateInstance.query.get();
    if (!query) {
      return;
    }
    const queryOptions = query.options;
    let tableInfo = getTableRecordsCollection(currentData.table.collection._connection).findOne({ _id: currentData.id });
    if (!tableInfo && Meteor.status().status === "offline") {
      const options = _.extend({}, query.options);
      delete options.limit;
      delete options.skip;
      options.fields = { _id: true };
      const data = currentData.table.collection.find(query.selector, options).fetch();

      tableInfo = {
        recordsFiltered: data.length,
        recordsTotal: data.length,
        _ids: data.slice(queryOptions.skip || 0, (queryOptions.skip || 0) + (queryOptions.limit || 10000000)).map (i => i. _id)
      };
    }
    if (templateInstance.sub.get() && templateInstance.sub.get().ready() && tableInfo) {
      if (templateInstance.handle) {
        templateInstance.handle.stop();
      }
      let initializing = true;
      // NOTE: tableInfo._ids already contains the ids of the documents to find - so no skip
      const cursor = Tracker.nonreactive(() => currentData.table.collection.find({ _id: { $in: tableInfo._ids } }, _.omit(queryOptions, "skip")));
      const count = cursor.count(); // MUST BE REACTIVE to track document removals and additions in the case that we hit this line before all data is really added.
      const docs = Tracker.nonreactive(() => cursor.fetch());
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
            try {
              templateInstance.dataTable.api().row(rowIndex).data(currentData.table.collection.findOne({ _id }));
              $(templateInstance.dataTable.api().row(rowIndex).node()).find("td,th").each(function perRow(cellIndex) {
                if (templateInstance.columns[cellIndex].tmpl) {
                  Blaze.remove(templateInstance.blaze[`${rowIndex}-${cellIndex}`].tmpl);
                  delete templateInstance.blaze[`${rowIndex}-${cellIndex}`];
                  templateInstance.columns[cellIndex].createdCell(this, null, rowData, rowIndex, cellIndex);
                }
              });
            }
            catch (e) {
              console.log(e);
            }
          }
        }
      });
      initializing = false;
      if (count < tableInfo._ids.length) {
        return;
      }

      // NOTE: if we have all the fields we need to sort on, we dont need to use the non-oplog observe call on the server, but we have to sort client side.
      const hasSortableFields = _.keys(queryOptions.fields || {}).length === 0 || _.intersection(_.keys(queryOptions.fields || {}), _.keys(queryOptions.sort || {})).length === _.keys(queryOptions.sort || {}).length;
      templateInstance.ajaxCallback({
        data: hasSortableFields ? docs : _.sortBy(docs, row => tableInfo._ids.indexOf(row._id)),
        recordsFiltered: tableInfo.recordsFiltered,
        recordsTotal: tableInfo.recordsTotal
      });
    }
  });
});
Template.DynamicTable.onCreated(function onCreated() {
  const self = this;
  this.sub = new ReactiveVar(null);
  this.selector = new ReactiveVar({});
  this.options = new ReactiveVar({});
  this.query = new ReactiveVar(false);
  this.advancedSearch = new ReactiveVar({});
  this.incomingSelector = new ReactiveVar({});
  this.tableId = new ReactiveVar("");

  this.documentMouseDown = (e) => {
    const filterModalWrapper = $("#dynamic-table-filter-modal")[0];
    if (filterModalWrapper) {
      if ($(filterModalWrapper).has(e.target).length  ) {
        return;
      }
      Blaze.remove(filterModalWrapper.__blazeTemplate);
      filterModalWrapper.innerHTML = "";
    }
  };

  document.addEventListener("mousedown", this.documentMouseDown);
  this.autorun(() => {
    const currentData = Template.currentData();
    if (Tracker.nonreactive(() => self.tableId.get()) !== currentData.id) {
      self.tableId.set(currentData.id);
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
      Template.instance().data.table.sub.clear();
    }
  }
  if (this.handle) {
    this.handle.stop();
  }
  if (this.$tableElement.length) {
    const dt = this.$tableElement.DataTable();
    if (dt) {
      dt.destroy();
    }
    this.$tableElement.empty();
  }
});

Template.DynamicTable.events({
  "click .advanced-search-button"() {
    doAdvancedSearch.call(Template.instance());
  }
});

Template.DynamicTable.helpers({
});
