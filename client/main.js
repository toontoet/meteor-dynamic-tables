import dataTableInit from "datatables.net";
import "./ui/CustomizableTable.js";
import "./ui/GroupedTable.js";
import "./ui/table.js";


export { inlineSave, getValue, nextField } from "./inlineSave.js";

if (!$.fn.DataTable) {
  dataTableInit(window, $);
}
