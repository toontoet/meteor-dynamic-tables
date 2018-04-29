import "./advancedSearchModal.html";


Template.dynamicTableAdvancedSearchModal.helpers({
  availableSearchOptions() {
    return Template.instance().fields;
  }
});

Template.dynamicTableAdvancedSearchModal.onCreated(() => {
  const collection = Template.instance().data.collection;
  const schema = collection.simpleSchema && collection.simpleSchema();
  const search = Template.instance().data.search;
  Template.instance().fields = Template.instance().data.fields.map((field) => {
    if (typeof field === "string") {
      field = {
        field
      };
    }
    if (!field.label) {
      field.label = schema.label(field.field);
    }
    if (!field.type) {
      if (field.options) {
        field.type = "select";
      }
    }
    if (!field.comparators) {
      const isNumeric = schema && schema._schema[field.field] && (
        (schema._schema[field.field].type.choices && schema._schema[field.field].type.choices.find(choice => choice === Number || choice === Date)) ||
        schema._schema[field.field].type === Number ||
        schema._schema[field.field].type === Date ||
        (schema._schema[field.field].type === Array && (schema._schema[`${field.field}.$`].type === Number || schema._schema[`${field.field}.$`].type === Date))
      );
      if (isNumeric) {
        field.comparators = [
          { label: "Exact Match", operator: "" },
          { label: "Not equal to", operator: "$ne" },
          { label: "Less than", operator: "$lt" },
          { label: "Greater than", operator: "$gt" }
        ];
      }
      else if (schema._schema[field.field].type === String || (schema._schema[field.field].type === Array && schema._schema[`${field.field}.$`].type === String)) {
        field.comparators = [
          { label: "Exact Match", operator: "" },
          { label: "Not equal to", operator: "$ne" },
          { label: "Contains", operator: "$regex" }
        ];
      }
      else {
        field.comparators = [
          { label: "Exact Match", operator: "" },
          { label: "Not equal to", operator: "$ne" }
        ];
      }
    }
    field.comparator = _.isObject(search[field.field]) ? _.keys(search[field.field])[0] : "";
    field.value = _.isObject(search[field.field]) ? _.values(search[field.field])[0] : search[field.field];
    return field;
  });
  if (Template.instance().data.beforeRender) {
    Template.instance().data.beforeRender.call(this);
  }
});

Template.dynamicTableAdvancedSearchModal.events({
  "click .btn-default"() {
    $("#dynamicTableAdvancedSearchModal").modal("hide");
  },
  "click .btn-danger"() {
    Template.instance().data.callback({});
    $("#dynamicTableAdvancedSearchModal").modal("hide");
  },
  "click .btn-inverse"() {
    const collection = Template.instance().data.collection;
    const schema = collection.simpleSchema();
    const search = {};
    Template.instance().$(".field-set").each(() => {
      let val = $(this).find(".form-control").val();
      const fieldName = $(this).find(".form-control").attr("name");
      const field = _.findWhere(Template.instance().fields, { field: fieldName });
      const isNumeric = schema._schema[fieldName] && (
        (schema._schema[fieldName].type.choices && schema._schema[fieldName].type.choices.find(choice => choice === Number)) ||
        schema._schema[fieldName].type === Number ||
        schema._schema[fieldName].type === Date ||
        (schema._schema[fieldName].type === Array && (schema._schema[`${fieldName}.$`].type === Number))
      );

      if (val) {
        const comparator = $(this).find(".comparator").val();
        if (isNumeric) {
          val = !Number.isNaN(parseInt(val, 10)) ? parseInt(val, 10) : val;
        }
        if (field && field.search) {
          _.extend(search, field.search(val, comparator));
        }
        else if (comparator) {
          search[$(this).find(".form-control").attr("name")] = { [comparator]: val };
        }
        else {
          search[$(this).find(".form-control").attr("name")] = val;
        }
      }
    });
    Template.instance().data.callback(search);
    $("#dynamicTableAdvancedSearchModal").modal("hide");
  }
});
