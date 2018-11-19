import "./headerCell.html";
import "../filterModal/filterModal.js";

Template.dynamicTableHeaderCell.events({
  "click .fa-filter"(e, templInstance) {
    const filterModalOptions = {
      field: {
        type: String
      },
      sort: {
        enabled: true
      },
      filter: {
        enabled: true,
        operator: {
          enabled: true,
          selected: "$in"
        },
        options: []
      },
      callback(options, operator, sort) {
        templInstance.data.filterModalCallback(templInstance.data.columnIndex, options, operator, sort);
      }
    };
    const bounds = $(e.currentTarget)[0].getBoundingClientRect();
    const div = $("#dynamic-table-filter-modal").length ? $("#dynamic-table-filter-modal") : $("<div>");
    div.attr("id", "dynamic-table-filter-modal")
    .html("")
    .css("position", "absolute")
    .css("top", bounds.top)
    .css("left", bounds.left + bounds.width);
    if (div[0].__blazeTemplate) {
      Blaze.remove(div[0].__blazeViewInstance);
    }
    Blaze.renderWithData(
      Template.dynamicTableFilterModal,
      filterModalOptions,
      div[0]
    );
    document.body.appendChild(div[0]);
  }
});
