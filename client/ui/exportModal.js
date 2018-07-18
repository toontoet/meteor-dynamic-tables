import FileSaver from "file-saver";
import "./exportModal.html";
import { getTableRecordsCollection } from "../db.js";
// NOTE: recursive function to collapse arrays and return clean CSVable strings.
function valueFunction(value, exportOptions) {
  if (typeof value === "string") {
    return value;
  }
  else if (_.isObject(value)) {
    return "Object requires conversion";
  }
  else if (_.isArray(value)) {
    return value.map(val => valueFunction(val, exportOptions)).join(",");
  }
  else if (_.isUndefined(value)) {
    return "";
  }
  return `${value}`;
}

// NOTE: extracts a value from a document with a potentially.dotted.notation.field
function getVal(doc, field) {
  if (field.indexOf(".") === -1) {
    return doc[field];
  }
  const parts = field.split(".");
  let current = doc;
  let i = 0;
  while (current && i < parts.length) {
    current = current[parts[i++]];
  }
  return current;
}

function getRows(doc, fieldNames, data) {
  const filterableFields = data.fields.filter(field => field.filters && fieldNames.includes(field.field));

  const filters = filterableFields.map(field => ({
    field: field.field,
    filters: _.compact(field.filters().map((filter) => {
      const val = $(`#dynamicTableExportModalForm-${field.field}-${filter.field}`).val();
      const comparator = $(`#dynamicTableExportModalForm-${field.field}-${filter.field}-comparator`).val();
      if (val) {
        return newDoc => filter.filter(newDoc[field.field], filter.field, newDoc, val, comparator);
      }
      return null;
    }))
  }));

  let docs = [doc];
  data.fields
  .filter(field => field.rows)
  .forEach((field) => {
    docs = _.flatten(docs.map(aDoc => field.rows(aDoc[field.field], aDoc, (_.findWhere(filters, { field: field.field }) || {}).filters)));
  });
  return docs;
}

// NOTE: generate a single line of valid CSV text for a document and list of fields
function CSVLineFromDocument(doc, exportOptions, columns, fieldNames, selector) {
  return _.flatten(_.filter(exportOptions.fields, field => fieldNames.indexOf(field.field) !== -1).map((field) => {
    const val = getVal(doc, field.field);
    const column = _.findWhere(columns, { data: field.field });
    if (field.columns) {
      let _columns;
      if (_.isArray(field.columns)) {
        _columns = field.columns;
      }
      else {
        _columns = field.columns(Meteor.userId(), selector);
      }
      return _columns.map(fieldColumn => `${fieldColumn.render ? fieldColumn.render(val, doc) : valueFunction(val, exportOptions)}`);
    }
    else if (field.render) {
      return `${field.render(val, doc)}`;
    }
    else if (column && column.render) {
      return `${column.render(val, "export", doc)}`;
    }
    return `${valueFunction(val, exportOptions)}`;
  }))
  .map((val) => {
    // NOTE: if the resulting value contains commas, we need to escape any present quotes and then quote the entire field
    if (val.indexOf(",") !== -1 || val.indexOf("\n") !== -1) {
      val = val.split("\"").join("\"\"");
      val = `"${val}"`;
    }
    return val;
  })
  .join(",");
}

Template.dynamicTableExportModal.helpers({
  isEven(index) {
    return index % 2 === 0;
  },
  checked(bool) {
    return bool ? { checked: "checked" } : {};
  },
  enableField(field) {
    return field.enabled !== false;
  },
  sortableFields() {
    const collection = Template.instance().data.collection;
    const schema = collection.simpleSchema && collection.simpleSchema();
    return Template.instance().data.columns
    .filter(col => col.sortable !== false && col.data)
    .map(col => ({ field: col.data, label: schema.label(col.data) }));
  },
  fields() {
    const collection = Template.instance().data.collection;
    const schema = collection.simpleSchema && collection.simpleSchema();
    return Template.instance().data.export.fields.map((field) => {
      if (typeof field === "string") {
        return { field, label: (schema && schema.label(field)) || field };
      }
      return { field: field.field, label: field.label || (schema && schema.label(field.field)) || field.field, filters: field.filters };
    });
  }
});

Template.dynamicTableExportModal.onRendered(function onRendered() {
  const collection = this.data.collection;
  const schema = collection.simpleSchema && collection.simpleSchema();
  const fields = this.data.export.fields.map((field) => {
    if (typeof field === "string") {
      return { field, label: (schema && schema.label(field)) || field };
    }
    return { field: field.field, label: field.label || (schema && schema.label(field.field)) || field.field };
  });
  this.$("#dynamicTableExportModalselected-fields").select2({
    multiple: true
  }).val(_.pluck(fields, "field")).trigger("change");
});
Template.dynamicTableExportModal.onCreated(function onCreated() {
  if (this.data.export.beforeRender) {
    this.data.export.beforeRender.call(this);
  }
});

Template.dynamicTableExportModal.events({
  "click .btn-default"() {
    $("#dynamicTableExportModal").modal("hide");
  },
  "click .btn-inverse"() {
    const templateInstance = Template.instance();
    const data = templateInstance.data;
    const selector = { $and: [data.selector, data.advancedSearch || {}] };
    /*const fieldNames = _.toArray(templateInstance.$("input:checked").map(function perCheckbox() {
      return $(this).data("target");
    }));*/
    const fieldNames = $("#dynamicTableExportModalselected-fields").val();
    const options = {
      fields: _.object(fieldNames, _.times(fieldNames.length, () => true))
    };
    data.extraFields.forEach((field) => {
      options.fields[field] = true;
    });
    let limit = templateInstance.$(".limit").val();
    if (limit) {
      if (limit === "current") {
        limit = data.limit;
        options.skip = data.skip;
      }
      else if (limit === "selected") {
        selector.$and.push({ _id: { $in: data.selectedIds } });
        limit = false;
      }
      else {
        limit = parseInt(limit, 10);
      }
      if (limit) {
        options.limit = limit;
      }
    }
    let sort = templateInstance.$(".sort").val();
    if (sort) {
      if (sort === "current") {
        sort = data.sort;
      }
      else {
        sort = { [sort]: 1 };
      }
      options.sort = sort;
    }

    const sub = templateInstance.subscribe(
      "simpleTablePublication",
      `${data.tableId}-export`,
      data.publication,
      data.compositePublicationNames,
      selector,
      options,
      {
        onStop(err) {
          if (err) {
            if (data.export.onError) {
              data.export.onError(err);
            }
            else {
              console.log(err);
            }
          }
        }
      }
    );
    templateInstance.$(".btn-inverse").attr("disabled", "disabled");
    templateInstance.autorun((comp) => {
      if (sub.ready()) {
        try {
          comp.stop();
          const tableInfo = getTableRecordsCollection(data.collection).findOne({ _id: `${data.tableId}-export` });
          const records = data.collection.find({ _id: { $in: tableInfo._ids } }, _.omit(options, "skip")).fetch();
          const fileName = `${data.export.fileName || "export"}.csv`;
          const csvHeaders = _.flatten(_.filter(data.export.fields, field => fieldNames.indexOf(field.field) !== -1).map((field) => {
            if (field.columns) {
              if (_.isArray(field.columns)) {
                return _.pluck(field.columns, "label");
              }
              return _.pluck(field.columns(Meteor.userId, { _id: { $in: tableInfo._ids } }), "label");
            }
            return field.label;
          }));
          const allRecords = _.flatten(records.map(record => getRows(record, fieldNames, data.export)));
          const csvText = `${csvHeaders}\n${allRecords.map(doc => CSVLineFromDocument(doc, data.export, data.columns, fieldNames, { _id: { $in: tableInfo._ids } })).join("\n")}`;
          const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
          FileSaver.saveAs(blob, fileName);
          if (data.export.complete) {
            data.export.complete(csvText, fileName);
          }
        }
        catch (e) {
          if (data.export.error) {
            data.export.error(e);
          }
          else {
            console.log(e);
          }
        }
        finally {
          templateInstance.$(".btn-inverse").attr("disabled", null);
          sub.stop();
        }
      }
    });
  }
});
