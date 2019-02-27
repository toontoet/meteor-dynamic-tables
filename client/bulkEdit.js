import "./ui/components/bulkEditModal/bulkEditModal.js";


export function bulkEdit(documentIds, tableData, set, FlexTemplates) {
  Modal.show("bulkEditModal", {
    class: "modal-medium-height",
    title: `Edit ${documentIds.length} ${set}`,
    documentIds,
    tableData,
    FlexTemplates
  });
}
