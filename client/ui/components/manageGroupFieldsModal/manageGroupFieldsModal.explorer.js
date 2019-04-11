import { ComponentCollection } from "meteor/znewsham:blaze-explorer";
import "./manageGroupFieldsModal.js";

ComponentCollection.getCollection("dynamic-tables")
.registerComponent("Group modal", Template.dynamicTableManageGroupFieldsModal, { parentElement: $("<div>").css("position", "relative")[0] })
.addCase("A single field with title", {
  availableColumns: [
    {
      field: "test",
      label: "Test Title"
    }
  ]
})
.addCase("Multiple fields one selected", {
  availableColumns: [
    {
      field: "test",
      label: "Test Title"
    },
    {
      field: "test2",
      label: "Test2 Title"
    }
  ],
  selectedColumns: [{ field: "test" }]
});
