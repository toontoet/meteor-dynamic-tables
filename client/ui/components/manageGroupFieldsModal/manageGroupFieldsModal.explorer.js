import { ComponentCollection } from "meteor/znewsham:blaze-explorer";
import "./manageGroupFieldsModal.js";
import _ from "underscore";

ComponentCollection.getCollection("dynamic-tables")
.registerComponent("Group modal", Template.dynamicTableManageGroupFieldsModal, { parentElement: $("<div>").css("position", "relative")[0] })
.addCase("A single field with title", {
  availableColumns: [
    {
      field: "test",
      label: "Test Title"
    }
  ]
});
