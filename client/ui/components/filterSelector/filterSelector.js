import { BlazeComponent } from "meteor/znewsham:blaze-component";

import "./filterSelector.html";
import "./filterSelector.css";

export class FilterSelector extends BlazeComponent {
  static HelperMap() {
    return [
      "curColumns"
    ];
  }

  curColumns() {
    return this.columns.get();
  }

  init() {
    this.columns = new ReactiveVar([]);
    this.autorun(() => {
      this.columns.set(this.reactiveData().columns);
    })
  }
}
BlazeComponent.register(Template.dynamicTableFilterSelector, FilterSelector);
