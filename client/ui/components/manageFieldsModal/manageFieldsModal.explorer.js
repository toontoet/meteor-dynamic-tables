import { ComponentCollection } from "meteor/znewsham:blaze-explorer";
import "./manageFieldsModal.js";
import _ from "underscore";

ComponentCollection.getCollection("dynamic-tables")
.registerComponent("Hide/Show fields modal", Template.dynamicTableManageFieldsModal, { parentElement: $("<div>").css("position", "relative")[0] })
.addCase("A single field with title", {
  availableColumns: [
    {
      id: "test",
      title: "Test Title"
    }
  ]
})
.addCase("A single field with a manageFieldsTitle", {
  availableColumns: [
    {
      id: "test",
      title: "Test Manage Fields Title"
    }
  ]
})
.addCase("A single field with search forced to true", {
  search: true,
  availableColumns: [
    {
      id: "test",
      title: "Test Title"
    }
  ]
})
.addCase("A single field with add set to true", {
  add: true,
  availableColumns: [
    {
      id: "test",
      title: "Test Title"
    }
  ]
})
.addCase("A single field with add set to true and some selected", {
  selectedColumns: [
    { id: "test" }
  ],
  availableColumns: [
    {
      id: "test",
      title: "Test Title"
    }
  ]
})
.addCase("A single field with add and search set to true", {
  add: true,
  search: true,
  availableColumns: [
    {
      id: "test",
      title: "Test Title"
    }
  ]
})
.addCase("15 fields, so search should show", {
  availableColumns: _.times(15, i => (
    {
      id: `test${i}`,
      title: `Test Title ${i}`
    }
  ))
})
.addCase("15 fields, and search set to false", {
  search: false,
  availableColumns: _.times(15, i => (
    {
      id: `test${i}`,
      title: `Test Title ${i}`
    }
  ))
})
.addCase("15 fields, and add set to true", {
  add: true,
  availableColumns: _.times(15, i => (
    {
      id: `test${i}`,
      title: `Test Title ${i}`
    }
  ))
})
.addCase("15 grouped fields, and add set to true", {
  add: true,
  availableColumns: _.union(
    _.times(15, i => (
      {
        id: `test${i}`,
        group: `group${i % 3}`,
        title: `Test Title ${i}`
      }
    )),
    _.times(5, i => (
      {
        id: `test${i}`,
        title: `Test Title ${i}`
      }
    ))
  )
});
