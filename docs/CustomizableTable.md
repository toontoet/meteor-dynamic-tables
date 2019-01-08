# CustomizableTable

This component allows users to select which columns are displayed and reorder the columns. It will also save the state (which columns, page, page length, which order the are in, any sort and any filer) either to the user, or via a custom function.

## Usage

Use in the same way as `DynamicTable` with two additional arguments.

```html
{{> CustomizableTable custom="tables.videos" columns=[...] ...}}

```

`custom` can either be an object, string or function. If it's an object it should meet the specification below, if it is a function it should either return an object, or a promise which resolves to an object which meets the specification, or call a callback with the same object.

`columns` an array of the available columns (as opposed to the default columns defined in the table specification), they follow the same specification.

### Custom object saving

If a string is provided as `custom` then it will be used as the field to save the state to. You should ensure that the relevant permissions are enabled for editing this field. Alternatively, you can provide a function which will be invoked as changes are necessary. The function takes a single argument. An object of the following format:

```js
{
  newColumns,
  newFilter,
  newOrder,
  newLimit,
  newSkip,
  newGroupChainFields,
  changeOpenGroups,
  unset, // we are clearing a search
}
```

### Custom object specification

| Field | Type | Description | Default |
| - | - | - | - |
| columns | [Object] | Which columns the user has saved, in order | Optional |
| columns.$.data | String | The data field used to identify the column | Optional |
| columns.$.id | String | The id field used to identify the column. If specified the data field is ignored. This allows you to have multiple column specs all using the same data field. | Optional |
| order | [Object] | Which columns are sorted, and in which direction | Optional |
| order.$.data | Same as columns.$.data | Optional |
| order.$.id | Same as columns.$.id | Optional |
| order.$.order | String (asc/desc) | The direction to sort the column | Required |
| limit | Number | Save the page length | Optional |
| skip | Number | Save the current page number (actually the number of records to skip) | Optional |
| filter | String | The JSON object representing the saved filter. Just the advanced filter chosen by the user, NOT the full selector (e.g., the concat of passed in selector and user defined selector)
