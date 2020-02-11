# DynamicTables

Provides more flexible functionality than [Tabular Tables](https://github.com/aldeed/meteor-tabular) at the cost of more configuration.

## New in version 1.8.0

1. Have unique grouping for each table.
2. Order groups.
3. Allow advanced search on nested tables.
4. Get advanced view which lets having unique specs on any level.

All of the new features are applied to `GroupedTable` template.

## Installation

`meteor add znewsham:dynamic-table`


## Redis oplog support

the redis-oplog package intercepts publication calls and modifies the results (e.g., just returning the cursors it can't handle). In the new version you can do the following instead of calling `Meteor.publish`:

```js
import { registerPubFunction } from "meteor/znewsham:dynamic-table";
registerPubFunction("myPubFunction", function(...) {

});
```

## Usage

### Basic Usage

myTable.html
```html
  <template name="myTable">
    {{> DynamicTable table=tableOptions class="table table-striped table-condensed" selector=selector id="my-table" style=""}}
  </template>
```

client.js
```js
  Template.myTable.helpers({
    tableOptions(){
      {
        collection: MyCollection,
        lengthChange: false,
        pageLength: 50,
        publication: "myPublication",
        autoWidth: false,
        sub: new SubsManager(),
        columns: [
          {
            data: "name",
            title: "Name",
            render(val, type, doc){
              return 'some custom value'
            }
          },
          {
            data: "someField",
            titleTmpl: Template.someTitleTemplate,
            titleTmplContext(){

            }
          },
          {
            data: "someOtherId",
            render(val, type, doc){
              return SomeOtherCollection.findOne({_id: val}).name;
            },
            search(query){
              return (_.isArray(query) ? query : [query]).map(q=>({
                someOtherId: {$in: SomeOtherCollection.find({name: q}, {fields: {_id: true}}).map(t=>t._id)}
              }));
            }
          },
          {
            width: "20px",
            tmpl: Template.someOtherTemplate,
            tmplContext(rowData){
              return {
                ...
              };
            }
          },
        ]),
        order: [[0, "asc"]],
        extraFields: ["ownerId",...]
      };
    }
  });
```

server.js
```js
  Meteor.publish("myPublication", function(selector, options){
    if(!this.userId){
      throw new Meteor.Error(401, "Not logged in");
    }
    //any other security you want, e.g.:
    const myPrivateDataSelector = {ownerId: this.userId};
    const mySelector = {$and: [myPrivateDataSelector, selector]};
    const myOptions = _.extend({}, options, {fields: {mySafeField: 1, myOtherSafeField: 2}});
    return MyCollection.find(mySelector, myOptions);

    //alternatively
    return [
      MyCollection.find(mySelector, myOptions),
      SomeOtherCollection.find(...)
    ]
  });
```

The publication provided to `DynamicTable` must accept two arguments, selector and options, both of which can be passed directly to a mongo find call, however should be checked for security.

### CustomizableTable Usage
Start with a standard definition as per "Basic Usage", but instead of using `DynamicTable` use `CustomizableTable`.

- The `table` argument is the only one required and provides the default options
- The `custom` argument can be a string, object or function. If a string is provided, it is considered to be a field on the user, and any object found on the current user at that field will be used to provide the specification for the table. If an object is provided, it is considered to be the configuration of columns/search for the table. If a function is provided it is called and should either return an object, a promise that resolves to the object, or should use the callback argument to provide the object asynchronously. See the details below for how to use `custom` as a function.

Read more about [CustomizableTable](./docs/CustomizableTable.md)

### GroupedTable Usage
Use in the same way as CustomizableTable with three extra argument

- `lazy` determines whether all tables should be loaded up front reqardless of expansion, it defaults to true (where the tables don't load until the section is expanded)

- `expandAll` determines whether all groups should be expanded (and thus load the tables)

- `groupableFields` contains an array of the fields which are defined as groupable. Each item in the array looks like this:

Read more about [GroupedTable](./docs/GroupedTable.md)


### Advanced Search Usage

```js
  tableOptions(){
    return {
      ...
      advancedSearch: {
        beforeRender(){
          //run any subscriptions you require
        },
        buttonHtml: "<button class=''>Advanced Search</button>",//optional, defaults to a fontawesome icon, will be rendered next to the search text box.
        //optional: defaults to using the fields defined in tableOptions.columns
        fields: [
          "name",
          {
            field: "someField",
            label: "My Special Field"
            comparators: [{label: ">", operator: "$gt"},...],
          },
          {
            field: "status",
            type: "select",
            options(){
              return [
                {label: "Active", value: "active"},
                {label: "Inactive", value: "inactive"}
              ]
            }
          },
          {
            field: "simpleObject.value"
          },
          {
            field: "complexArrayOfObjects",
            search(value, comparator){
              if(comparator){
                return {"complexArrayOfObjects.myValueKey": {[comparator]: val}};
              }
              else {
                return {"complexArrayOfObjects.myValueKey": val};
              }
            }
          }
        ]
      }
    };
  }
```
To trigger the advanced search call `$("#myTableId").data("do-advancedSearch")();`

additionally, you can use the rendered search button

### Export Usage

```js
  tableOptions(){
    return {
      ...
      export: {
        fileName: "myExport",//optional will be appended with .csv - defaults to the table ID
        onError(e){//optional, defaults to console.log
          console.log(e);
        },
        onComplete(csvText, fileName){//optional

        },

        //optional: defaults to using the fields defined in tableOptions.columns which arent data: _id and don't have a template.
        //if a field is defined but has no render method, we will use the render method on the column is used if present, if not the value of the data is converted to a string, arrays are joined with ,
        //if no label is defined, the columns title is used, if not present the schemas label is used, if not the field name is used
        fields: [
          "name",
          {
            field: "someField",
            label: "My Special Field"
          },
          {
            field: "simpleArray",
            columns(selector){
              /*potentially return multiple columns
                for example one documents simpleArray contains [{type: "mytype1", value: 3}, {type: "mytype2", value: 4}]
                another contains [{type: "mytype3", value: 3}, {type: "mytype4", value: 4}]
                you might want to return the distinct set of `types` as columns
              */
              return [{
                label: `Simple(myType1)`,
                render(simpleArray, doc){
                  return _.pluck(_.where(simpleArray, {type: "myType1"}), "value").join(",");
                },
                label: `Simple(myType2)`,
                render(simpleArray, doc){
                  return _.pluck(_.where(simpleArray, {type: "myType2"}), "value").join(",");
                }
              }]
            }
          },
          {
            field: "complexArrayOfObjects",
            render(value, doc){
              return "anything you want"
            }
          }
        ]
      }
    };
  },
```

To trigger an export call `$("#myTableId").data("do-export")();`

same as advance search and export functions, you can also trigger bulk edit and use `onSuccess` and `onError` callbacks.

### Bulk Edit Usage

```js
  tableOptions(){
    return {
      ...

      bulkEditOptions: {
        updateMethod: "aMethodName",
        onSuccess(updatedEntries, skippedEntries, failedEntries) {
          Notifications.success("Fields updated successful.", "", { timeout: 2000 });
        },
        onError(e) {
          Notifications.error("Couldn't update fields", e.reason, { timeout: 5000 });
        }
      }
    };
  }
```

To trigger the bulk-edit call `$("#myTableId").data("do-bulkEdit")({ selectedIds: columnIds, set: "arbitaryEntityValue" });`.

If supplied `updateMethod` will be called as follows:

```
Meteor.call(updateMethod, collectionName, docIds, $set);
```

Where updateMethod is the one supplied, collectionName is the name of the collection (if supplied), docIds is the array of document IDs to be updated and $set is a mongo $set modifier with all the changes

## API

The following is a list of all options that can be passed to DynamicTable.

| Field | Type | Description | Default |
| - | - | - | - |
| table | TableSpec | The table specification | Required |
| id | String | The id of the table | Required |
| class | String | The classes to apply to the table | Optional |
| style | String | The style to apply directly to the table | Optional |
| selector | Object | The mongo selector to filter the server provided data | Optional |


### TableSpec

In addition to these fields, any option defined by DataTables can be used (e.g., lengthChange, pageLength, autoWidth, etc)

| Field | Type | Description | Default |
| - | - | - | - |
| collection | MongoCollection | The client side collection to pull data from | Required |
| publication | String | The name of the publication to use, this can ONLY be ommitted if you are using a local collection and the data doesn't need to be fetched from the server (or you are fetching it yourself) | Optional |
| columns | [[ColumnSpec](#markdown-header-columnspec)] | The columns in the table | Required |
| limit | Number | Mostly used when pagination is disabled, will return a fixed number of rows | Optional |
| extraFields | [String] | Additional fields to fetch | Optional |
| sub | { subscribe } | Any object that provides a subscribe method | Meteor |
| useArrayPublication | Boolean | Force the use of the array publication (vs the composite pub) | true if no compositePublicationNames are defined |
| compositePublicationNames | [String] | A list of additional publications to be called per row as part of the composite publication | Optional |
| export | [ExportSpec](#markdown-header-exportspec) | How an export should be handled | Optional |
| advancedSearch | [AdvancedSearchSpec](#markdown-header-advancedsearchspec) | Which fields should be available in the advanced search modal | Optional |
| subscriptionOptions | Object | Additional options to pass to the subscriotion | Optional |
| sortable | Object | Optionally add a jQuery sortable. This works best on local collections | Optional |
| manageFieldsTitle | String | Title of column in the manage fields modal | Optional |

### ColumnSpec

In addition to these options, any option available to a DataTable column is available here

| Field | Type | Description | Default |
| - | - | - | - |
| data | String | The field to pull values from | Required |
| id | String | Required if using advanced features, and non-unique data columns | Optional |
| title | String | The title of the column | the data field |
| titleFn | Function | A function that returns the value of the column title | Optional |
| titleTmpl | Blaze.Template | A template to render as the column header | Optional |
| titleTmplContext | Function | Returns the data context to be passed into the title template, called with these arguments `(data)` where data is the data passed into the table, the context of `this` will be the column | {} |
| render | Function | Return the string to render, called with `(value, type, doc)` | Optional |
| tmpl | Blaze.Template | A template to render the content of the cell | Optional |
| tmplContext | Function | A function invoked with the partial document of the row and the data passed into the table, should return the context to call the template with | Optional |
| editTmpl | Blaze.Template | A template that gets toggled to when editing, can use `Blaze.dynamicTableSingleValueTextEditor`, `Blaze.dynamicTableSelect2ValueEditor`, `Blaze.dynamicTableBooleanValueEditor`, or any other template you care to define <br/> *- dynamicTableSingleValueTextEditor* allow editing single value `String` or `Number` field <br/> *- dynamicTableSelect2ValueEditor* allow editing for multi-value `String` or `Number` field <br/> *- dynamicTableBooleanValueEditor* allow editing for `Boolean` field  | Optional |
| editTmplContext | Function | A function invoked with `{ doc, column, collection }` and should return the context to pass into the edit template | Optional |
| search | Function/String | Either the field to search (if different from the data field) or a function which returns a selector when called with `(query, userId)` | Optional
| searchable | Boolean | Whether this column should be searched | true |
| sortField | String | The field to sort on if different from data  | Optional |
| filterModal | [FilterModalSpec](#markdown-header-filtermodalspec)/Boolean | Should this column be filterable/sortable via a per-column modal | false |

###### `editTmpl` can also be customized with any define template and `inlineSave, getValue, nextField` methods can be used as required to update the in the inline column value.

#### Import Example

```
import {
  inlineSave,
  getValue,
  nextField
} from "meteor/znewsham:dynamic-table";
```

##### Method Signature

`function nextField(templInstance)` Focus to next editable field <br/>
`function getValue(doc, fieldName)` Return the column value <br/>
`function inlineSave(templInstance, updatedValue, extraData)` Update the current column value

###### You can also defined your own way to update inline value using `editTmplContext` return in `editTmplContext`

```
editTmplContext(rowData) {
  return _.extend(rowData,
    {
      editCallback: (docId, val, doc, afterEditCallback, extra) => {
        doSomethingAndUpdate();
        afterEditCallback(); // mandatory to render the updated value after update;
      }
    });
}
```

### BulkEditSpec

The bulk edit functionality allows update multiple rows with common value(s)

| Field | Type | Description | Default |
| - | - | - | - |
| publication | String | The name of the publication to use for bulk edit form, if not provided table `publication` field is used | Optional |
| collection | String | The name of the collection to use for bulk edit form, if not provided table `collection` field is used | Optional |
| updateMethod | String | Meteor method name | Optional |
| onSuccess | Function | This function is triggered, if bulk edit is completed without throwing any error | Optional |
| onError | Function | This function is triggered, if bulk edit throws any error | Optional |

### ExportSpec

The export functionality allows multiple CSV rows to be output per data row, and in theory multiple columns per column - this allows clean exporting of mongo documents containing arrays

| Field | Type | Description | Default |
| - | - | - | - |
| fileName | String | The name of the downloaded file, will be appended with .csv | The table ID |
| onError | Function | A callback in the case of error | console.log |
| onComplete | Function | A callback in the case of success, called with `(csvText, fileName)` | Optional |
| beforeRender | Function | A callback called prior to the export modal displaying, you can subscribe to anything from here | Optional |
| fields | [[ExportFieldSpec](#markdown-header-exportfieldspec)/String] | An array of fields that should be exported, this could be more or less fields than provided by the table | The table columns |
| allAvailableForExport | Boolean | Whether all rows can be exported at once, useful for very large collections. If set to false the export will default to visible rows. If true, an export of all rows will enforce a sort by _id. | true |

### ExportFieldSpec

You can shortcut this spec by just defining A string (the fieldName)

| Field | Type | Description | Default |
| - | - | - | - |
| field | String | The field to pull data from | Required |
| label | String | The column header | Defaults to the schema label for this field |
| render | Function | Same as ColumnSpec.render | Optional |
| columns | Function | Called to determine the set of columns this field maps to, for example if you store an array of values you may want each value to be in its own column. Called with `(userId, selector)` and must return an array of ExportFieldSpec | Optional |
| rows | Function | Called to determine the set of rows each row maps to based on this field, called with `(value, doc, filters)` | Optional
| filters | [[ExportFieldFilterSpec](#markdown-header-exportfieldfilterspec)] | A list of filters available for this field. This allows users to only export rows matching this criteria (beyond the filter applied to the entire table) for example, a row may have an array of notes saved by a user at a certain time. A user may want to export one row per document per note, but filter to only include recent notes, or notes by a specific user | Optional |
| columns | [{ label, render }] | Primariliy used to extract values from an array, or nested object | Optional |

### ExportFieldFilterSpec

| Field | Type | Description | Default |
| - | - | - | - |
| field | String | Which field to filter on | Required |
| label | String | The label to display to the user | Required |
| type | String | The autoforms input type | Required |
| options | [Object] | The options to pass to an autoform select/select2 element | Optional |
| comparators | [Object] | A list of available comparators for the filter | Optional |
| comparators.$.operator | String | A mongo DB query operator, e.g., $lt, $ne, etc | Required |
| comparators.$.label | String | The label for the operator | Required |
| filter | Function | The function that does the filtering, according to the passed in `(subDoc, field, doc, value, comparator)`. `subDoc` is the element in the array which is being filtered. | Required |

### AdvancedSearchSpec

| Field | Type | Description | Default |
| - | - | - | - |
| isHidden | Bool. If `true`, hides advancedSearch button in table. May be usefull when you use advanced seach in GroupedTable `advanced: { searching { leaf: true } }` | Optional |
| beforeRender | Function | A callback called prior to the export modal displaying, you can subscribe to anything from here | Optional |
| buttonHtml | String | The HTML of the button to render | `<button class=''>Advanced Search</button>` |
| fields | [AdvancedSearchFieldSpec](#markdown-header-advancedsearchfieldspec)/String] | The fields to allow searching over, defaults to the fields defined by the columns in the table | Optional |


### AdvancedSearchFieldSpec

You can shortcut this spec by just defining A string (the fieldName)

| Field | Type | Description | Default |
| - | - | - | - |
| field | String | The name of the field you are searching over | Required |
| label | String | The label of the field, defaults to the simple schema label, or the title of the column | Optional |
| type | String | The type of field, passed to autoform | Optional |
| options | [{ label, value }] | A list of options to pass to a select/select2 autoform | Optional |
| comparators | [Object] | A list of available comparators for the filter | Optional |
| comparators.$.operator | String | A mongo DB query operator, e.g., $lt, $ne, etc | Required |
| comparators.$.label | String | The label for the operator | Required |
| search | Function | A search function, takes as arguments the value and the comparator | Optional |

### FilterModalSpec

| Field | Type | Description | Default |
| - | - | - | - |
| field | Object | The specification for the field | Optional |
| field.name | String | The name of the field to search on, defaults to the value of the data field on the column | Optional |
| field.type | | The data type of the column, defaults to the data type in the simple schema if defined | String |
| sort | Object | The sort specification for the field | Optional |
| sort.enabled | Boolean | Whether this column is sortable, defaults to the sortable value of the column | Optional |
| sort.direction | Number | The default direction to sort in | 1 |
| filter | Object | The configuration for the filter | Optional |
| filter.enabled | Boolean | | true |
| filter.search.enabled | Boolean | | true |
| options | Function/[{ label, value }] | The list of options for the filter, or a function that must either return an array of options, a promise that resolves to an array of options, or call a callback with the array of options | Optional |

## Key differences to Tabular Tables

1. Allows multiple tables with the same table definition,
     - for example if you display a list of folders (in an accordion) and want to allow multiple panels of the accordion to be open at the same time, you would need a dynamic set of tables with the same definition
     - this could be accomplished with Tabular Tables, but required a lot of hacking, and does not persist well between server failovers or reconnects.
2. Allows templates in the header - for example if you want to use a checkbox column with a checkbox + dropdown in the header to allow for bulk actions
3. Allows custom per-column search rules, e.g., when displaying data across joins
4. Allows for a boilerplate advanced search modal, for fields potentially not displayed in the table
5. Allows for client side export of data to CSV
     - columns potentially not shown in the table
     - rows not in the currently visible dataset
6. Requires a specified publication
     - takes as arguments a {selector} and {options} - which can be passed directly to a find
     - all permissions must be handled here.
     - the publication must return either a single cursor, or an array of cursors, the first of which must be the cursor for the documents (e.g., any joins must follow)
     - complex publications can be accomplished by specifying an array of `compositecompositePublicationNames`- which utilise `publishComposite`
     - I'm actively working on reducing some of this complexity.
7. Potential performance benefits caused by highly selective rendering of rows based on modified data
     - I'm actively working on improving this further by caching rendered templates between page changes and rendering specific columns on data change.
8. Beyond this it has a very similar API to Tabular Tables

## Performance

There are three main performance improvements over Tabular Tables. First, there is no additional rountrip between client and server - tabular tables works by publishing an "information" collection for each table with the list of documentIds to return, the client the subscribes to those documents. While this package also returns the documentIDs as paret of an information collection, it does it at the same time as running the main publication.

Additionally, as tabular tables uses one publication for fetching the documentIds and another for fetching the documents themselves, any security work (e.g., checking a users permissions) must be done in both places. This package only requires it in one place, where it is called exactly once.

Finally, by selectively re-rendering rows on data change (rather than re-rendering the entire page), we achieve performance improvements relative to tabular tables. This is particularly important when your rows use templates.


### Dependencies

This package requires:

- [file-saver](https://github.com/eligrey/FileSaver.js/)
- [peppelg:bootstrap-3-modal](https://github.com/PeppeL-G/bootstrap-3-modal/)
- [reywood:publish-composite](https://github.com/englue/meteor-publish-composite/)

And likes to have (but does not require):
- bootstrap3
- [aldeed:autoform](https://github.com/aldeed/meteor-autoform)
- [aldeed:simple-schema](https://github.com/aldeed/meteor-simple-schema)



### Migrating from Tabular Tables

Having read the above, you're sure you need this package? These packages play fairly nicely together, so you can just use this table where you need it.

1. Use DynamicTable template instead of tabular
2. Define an id in the arguments you provide to DynamicTable
3. Define a publication that accepts a selector and options
     - ensure this publication is secure, as anyone could call it, not just the DynamicTable component
4. Make your table definition available as a template helper

Optional:

5. If you previously used a changeSelector, move that code to the selector argument of the DynamicTable (changeSelector will continue to be available for a while)

## Acknowledgements

This package is in no way associated with, but was heavily inspired by (and in some cases reused code snippets from) [Tabular Tables](https://github.com/aldeed/meteor-tabular)

## Contributions

In the form of feedback, funding or pull requests are always welcome.
