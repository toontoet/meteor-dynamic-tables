# DynamicTables

Provides more flexible functionality than [Tabular Tables](https://github.com/aldeed/meteor-tabular) at the cost of more configuration.

## Key differences to Tabular Tables

If you aren't having any problems using Tabular Tables, and don't explicitly need the items mentioned below, you should probably use Tabular Tables - I wrote this package to deal with some (possibly very specific) use cases that Tabular Tables couldn't handle - I then extended it to handle some other elements (e.g., advanced search and export). The simple configuration, test coverage and widespread use of Tabular Tables should make it more attractive to most developers.

That being said...:

1. Allows multiple tables with the same table definition,
     - for example if you display a list of folders (in an accordion) and want to allow multiple panels of the accordion to be open at the same time, you would need a dynamic set of tables with the same definition
     - this could be accomplished with Tabular Tables, but required a lot of hacking, and does not persist well between server failovers or reconnects.
2. Allows templates in the header - for example if you want to use a checkbox column with a checkbox + dropdown in the header to allow for bulk actions
3. Allows custom per-column search rules, when displaying data across joins
4. Allows for a boilerplate advanced search modal, for fields potentially not displayed in the table
5. Allows for client side export of data to CSV
     - columns potentially not shown in the table
     - rows not in the currently visible dataset
6. Requires a specified publication
     - takes as arguments a {selector} and {options} - which can be passed directly to a find
     - all permissions must be handled here.
     - the publication must return either a single cursor, or an array of cursors, the first of which must be the cursor for the documents (e.g., any joins must follow)
     - complex publications can be accomplished by specifying an array of composite publication names - which utilise `publishComposite`
     - I'm actively working on reducing some of this complexity.
7. Potential performance benefits caused by highly selective rendering of rows based on modified data
     - I'm actively working on improving this further by caching rendered templates between page changes and rendering specific columns on data change.
8. Beyond this it has a very similar API to Tabular Tables


## Usage

`meteor add znewsham:dynamic-tables`

### Dependencies

This package requires:

- [file-saver](https://github.com/eligrey/FileSaver.js/)
- [peppelg:bootstrap-3-modal](https://github.com/PeppeL-G/bootstrap-3-modal/)
- [reywood:publish-composite](https://github.com/englue/meteor-publish-composite/)

And likes to have (but does not require):
- bootstrap3
- [aldeed:autoform](https://github.com/aldeed/meteor-autoform)
- [aldeed:simple-schema](https://github.com/aldeed/meteor-simple-schema)

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

### Migrating from Tabular Tables

Having read the above, you're sure you need this package? These packages play fairly nicely together, so you can just use this table where you need it.

1. Use DynamicTable template instead of tabular
2. Define an id in the arguments you provide to DynamicTable
3. Define a publication that accepts a selector and options
     - ensure this publication is secure, as anyone could call it, not just the DynamicTable component
4. Make your table definition available as a template helper

Optional:

5. If you previously used a changeSelector, move that code to the selector argument of the DynamicTable (changeSelector will continue to be available for a while)

## Advanced Search Usage

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

## Export Usage

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

## Acknowledgements

This package is in no way associated with, but was heavily inspired by (and in some cases reused code snippets from) [Tabular Tables](https://github.com/aldeed/meteor-tabular)

## Contributions

In the form of feedback, funding or pull requests are always welcome.
