import "./ui/components/bulkEditModal/bulkEditModal.js";

export function bulkEdit(documentIds, tableData, set) {
  const columns = tableData.table.columns ? tableData.table.columns : [];
  const collection = tableData.table.collection;
  const editableCols = columns.filter(col => !!col.editable);

  Modal.show("bulkEditModal", {
    class: "modal-medium-height",
    title: `Edit ${documentIds.length} ${set}`,
    set,
    fields: editableCols,
    collection,
    documentIds
  });
}
