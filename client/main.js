import dataTableInit from "datatables.net";
import "./ui/CustomizableTable.js";
import "./ui/GroupedTable.js";
import "./ui/table.js";


export { inlineSave, getValue, nextField } from "./inlineSave.js";

if (!$.fn.DataTable) {
  dataTableInit(window, $);
}

// HACK: to handle npm blaze and the mess that is meteor vs npm jquery
if (!Blaze._DOMBackend._$jq.fn.DataTable) {
  dataTableInit(window, Blaze._DOMBackend._$jq);
}
