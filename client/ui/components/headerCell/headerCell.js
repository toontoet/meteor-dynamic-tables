import "./headerCell.html";
import "../filterModal/filterModal.js";

Template.dynamicTableHeaderCell.events({
  "click .fa-filter"(e) {
    const filterModalOptions = {
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
      }
    };
    const bounds = $(e.currentTarget)[0].getBoundingClientRect();
    const div = $("<div>");
    div.css("position", "absolute")
    .css("top", bounds.top)
    .css("left", bounds.left + bounds.width);
    Blaze.renderWithData(
      Template.filterModal,
      filterModalOptions,
      div[0]
    );
  }
});
