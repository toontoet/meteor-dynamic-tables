import "./ui/components/bulkEditModal/bulkEditModal.js";
import { getValue } from "./inlineSave.js";

function getBulkEditValue(collection, documentIds, field) {
  const fields = {};
  fields[field] = true;
  const data = collection.find({ _id: { $in: documentIds } }, { fields });
  if (data) {
    const values = _.uniq(data.map((d) => {
      if (d[field]) {
        return d[field];
      }
      const value = getValue(d, field);
      return value !== undefined ? value.value : value;
    }));
    return {
      value: (values.length !== 1 || values[0] === undefined) ? "" : values[0],
      placeholder: values.length > 1 ? "Multiple Values" : ""
    };
  }
  return "";
}

export function bulkEdit(documentIds, tableData, set) {
  const columns = tableData.table.columns ? tableData.table.columns : [];
  const collection = tableData.table.collection;
  const editableCols = columns.filter(col => !!col.editTmpl).map((col) => {
    const { value, placeholder } = getBulkEditValue(collection, documentIds, col.data);
    col.editTemplateViewName = col.editTmpl.viewName.split(".")[1];
    col.editTemplateContext = {
      id: `${col.data}-input`,
      value,
      placeholder,
      bulkEdit: true
    };
    return col;
  });

  Modal.show("bulkEditModal", {
    class: "modal-medium-height",
    title: `Edit ${documentIds.length} ${set}`,
    set,
    fields: editableCols,
    collection,
    documentIds
  });
}
