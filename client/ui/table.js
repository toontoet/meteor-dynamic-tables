import { Modal } from "meteor/peppelg:bootstrap-3-modal";
import "./table.html";
import "./exportModal.js";
import "./advancedSearchModal.js";
import { TableInformation } from "../db.js";

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
      if(_.keys(search).length){
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
    table.export.fields = table.columns.filter(column => column.data && column.data !== "_id").map(column => ({
      field: column.data
    }));
  }
  const schema = table.collection.simpleSchema && table.collection.simpleSchema();
  table.export.fields = table.export.fields.map((field) => {
    if (!_.isObject(field)) {
      field = { field };
    }
    if (!field.label) {
      const column = _.findWhere(table.columns, { data: field.field });
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
    columns: table.columns
  }, _.isObject(extraOptions) ? extraOptions : {}));
}

/**
  @this Template.instance()
*/
function setup() {
  const self = this;
  const currentData = this.data;

  // NOTE: allow for subscription managers.
  if (!currentData.subscriptionManager) {
    currentData.subscriptionManager = Meteor;
  }

  // NOTE: ensure we have clean data.
  currentData.table.extraFields = currentData.table.extraFields || [];
  currentData.table.columns = currentData.table.columns || [];
  currentData.table.columns.forEach((column) => {
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
function ajaxOptions(data, options, currentData) {
  const pageOptions = {
    skip: data.start
  };
  if (data.length && data.length !== -1) {
    pageOptions.limit = data.length;
  }
  if (data.order) {
    pageOptions.sort = {};
    data.order.forEach((order, index) => {
      if (currentData.table.columns[order.column] && currentData.table.columns[order.column].data) {
        pageOptions.sort[currentData.table.columns[order.column].data] = (index + 1) * (order.dir === "desc" ? -1 : 1);
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
function ajaxSelector(data, selector, currentData) {
  const querySelector = _.extend({}, selector);
  if (data.search && data.search.value !== "") {
    querySelector.$or = [];
    const search = (data.search.regex || currentData.table.search.caseInsensitive) ? {
      $regex: data.search.value
    } : data.search.value;

    if (currentData.table.search.caseInsensitive) {
      search.$options = "i";
    }

    currentData.table.columns.forEach((column) => {
      if (_.isFunction(column.search)) {
        querySelector.$or = _.union(querySelector.$or, column.search(search, Meteor.userId()));
      }
      else if (column.data && (!column.searchable || column.searchable !== false)) {
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
    const currentData = Template.currentData();
    setup.call(self);
    // NOTE: we want all fields defined in columns + all extraFields
    const fields = _.union(_.unique(_.compact(_.pluck(currentData.table.columns, "data"))), currentData.table.extraFields);
    const options = _.extend({ fields: _.object(fields, _.times(fields.length, () => true)) }, currentData.table.subscriptionOptions || {});

    // NOTE: if we have a hard limit (e.g., no paging specified)
    if (currentData.table.limit) {
      options.limit = currentData.table.limit;
    }

    // NOTE: if we have a changeSelector method specified, use it.
    // TODO: left in for compatibility - to be removed.
    const selector = currentData.table.changeSelector ? currentData.table.changeSelector(currentData.selector || {}) : (currentData.selector || {});
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
        const table = templateInstance.data.table;
        const columns = table.columns;

        $(headerRow).find("td,th").each((index, headerCell) => {
          if (columns[index].titleTmpl) {
            if (headerCell.__blazeViewInstance) {
              Blaze.remove(headerCell.__blazeViewInstance);
            }
            headerCell.__blazeViewInstance = Blaze.renderWithData(columns[index].titleTmpl, columns[index].titleTmplContext ? columns[index].titleTmplContext() : {}, headerCell);
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
        templateInstance.completeStart = new Date().getTime();
        // NOTE: the "ajax" call triggers a subscription rerun, iff queryOptions or querySelector has changed
        const queryOptions = ajaxOptions(data, options, currentData);
        const querySelector = ajaxSelector(data, selector, currentData);
        const query = {
          options: queryOptions,
          selector: querySelector
        };
        if (JSON.stringify(Tracker.nonreactive(() => self.query.get())) !== JSON.stringify(query)) {
          self.query.set(query);
          templateInstance.ajaxCallback = callback;
        }
      }
    }, currentData.table);
    if (templateInstance.dataTable) {
      templateInstance.dataTable.api().destroy();
    }
    templateInstance.dataTable = templateInstance.$(`#${Template.currentData().id}`).dataTable(tableSpec);
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
        templateInstance.sub.get().stop();
      }
    });
    templateInstance.sub.set(currentData.subscriptionManager.subscribe(
      "simpleTablePublication",
      currentData.id,
      currentData.table.publication,
      currentData.table.compositePublicationNames,
      _.keys(advancedSearch).length ? { $and: [querySelector, advancedSearch] } : querySelector,
      queryOptions
    ));
  });

  // NOTE: wait for the subscription and then fetch and observe the data.
  this.autorun(() => {
    const currentData = templateInstance.data;
    const query = templateInstance.query.get();
    if (!query) {
      return;
    }
    const queryOptions = query.options;
    const tableInfo = TableInformation.findOne({ _id: currentData.id });
    if (templateInstance.sub.get() && templateInstance.sub.get().ready() && tableInfo) {
      if (templateInstance.handle) {
        templateInstance.handle.stop();
      }
      let initializing = true;
      // NOTE: tableInfo._ids already contains the ids of the documents to find - so no skip
      const cursor = Tracker.nonreactive(() => currentData.table.collection.find({ _id: { $in: tableInfo._ids } }, _.omit(queryOptions, "skip")));
      const count = Tracker.nonreactive(() => cursor.count());
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
            const rowIndex = tableInfo._ids.indexOf(_id);
            const rowData = currentData.table.collection.findOne({ _id });
            try {
              templateInstance.dataTable.api().row(rowIndex).data(currentData.table.collection.findOne({ _id }));
              $(templateInstance.dataTable.api().row(rowIndex).node()).find("td,th").each(function perRow(cellIndex) {
                if (currentData.table.columns[cellIndex].tmpl) {
                  Blaze.remove(templateInstance.blaze[`${rowIndex}-${cellIndex}`].tmpl);
                  delete templateInstance.blaze[`${rowIndex}-${cellIndex}`];
                  currentData.table.columns[cellIndex].createdCell(this, null, rowData, rowIndex, cellIndex);
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

      templateInstance.ajaxCallback({
        data: _.sortBy(docs, row => tableInfo._ids.indexOf(row._id)),
        recordsFiltered: tableInfo.recordsFiltered,
        recordsTotal: tableInfo.recordsTotal
      });
    }
  });
});
Template.DynamicTable.onCreated(function onCreated() {
  this.sub = new ReactiveVar(null);
  this.selector = new ReactiveVar({});
  this.options = new ReactiveVar({});
  this.query = new ReactiveVar(false);
  this.advancedSearch = new ReactiveVar({});
  this.blaze = {};
});

// NOTE: cleanup
//       stop the subscription
//       stop the observer
//       destroy the data table and empty the actual table element
Template.DynamicTable.onDestroyed(function onDestroyed() {
  if (this.sub.get()) {
    this.sub.get().stop();
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
