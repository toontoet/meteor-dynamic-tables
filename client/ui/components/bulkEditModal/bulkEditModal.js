import { Template } from "meteor/templating";

import { setupTemplate } from "meteor/znewsham:justplay-common";


import "./bulkEditModal.html";
import "./bulkEditModal.scss";

export const bulkEditModal = {
  helpers: {
  },
  events: {
  },
  rendered() {
  },
  created() {

  }
};
setupTemplate(Template.bulkEditModal, bulkEditModal);
