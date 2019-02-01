import dataTableInit from "datatables.net";
import "./ui/CustomizableTable.js";
import "./ui/GroupedTable.js";
import "./ui/table.js";

export { bulkEdit } from "./bulkEdit";

dataTableInit(window, $);
