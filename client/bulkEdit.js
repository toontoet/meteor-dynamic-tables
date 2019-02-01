export function bulkEdit(documentIds, tableData, set) {
  Modal.show("genericModal", {
    id: "bulk-edit-modal",
    class: "modal-medium-height",
    title: `Edit ${documentIds.length} ${set}`
  });
}
