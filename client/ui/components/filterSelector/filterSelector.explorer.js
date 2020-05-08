import { ComponentCollection } from "meteor/znewsham:blaze-explorer";
import "./filterModal.js";

ComponentCollection.getCollection("dynamic-tables")
.registerComponent("Filter Selector", Template.dynamicTableFilterSelector)
.addCase("with a label", {
  field: {
    label: "A Field",
    type: [String]
  }
}, { testSnapshot: true });