import { ComponentCollection } from "meteor/znewsham:blaze-explorer";
import "./inlineFilterForm.js";

ComponentCollection.getCollection("dynamic-tables")
.registerComponent("Inline Filter Form", Template.dynamicTableInlineFilterForm)
.addCase("with a string filter", {
  field: {
    type: [String]
  },
  filter: {
    enabled: true,
    operator: {
      enabled: true,
      selected: "$in"
    }
  }
})
.addCase("with an array of options", {
  field: {
    type: String
  },
  filter: {
    enabled: true,
    options: ["test1", "test2", "test3"]
  }
})
.addCase("with an array of options,and some selected", {
  field: {
    type: String
  },
  filter: {
    enabled: true,
    selectedOptions: ["test1", "test2"],
    options: ["test1", "test2", "test3"]
  }
})
.addCase("a syncronous options function", {
  field: {
    type: String
  },
  filter: {
    enabled: true,
    options(data, search, callback) {
      return ["test1", "test2", "test3"];
    }
  }
})
.addCase("an asyncronous options function", {
  field: {
    type: String
  },
  filter: {
    enabled: true,
    options(data, search, callback) {
      setTimeout(() => callback(["test1", "test2", "test3"]), 100);
    }
  }
})
.addCase("a promise options function", {
  field: {
    type: String
  },
  filter: {
    enabled: true,
    options(data, search, callback) {
      return Promise.resolve()
      .then(() => ["test1", "test2", "test3"]);
    }
  }
})
.addCase("Should callback", {
  field: {
    type: String
  },
  sort: {
    enabled: true,
    direction: 1
  },
  filter: {
    enabled: true,
    operator: {
      enabled: true,
      selected: "$in"
    },
    search: {
      enabled: true
    },
    options(data, search, callback) {
      setTimeout(() => callback(["test1", "test2", "test3"].filter(a => a.match(new RegExp(search)))), 100);
    }
  },
  callback(options, operator, sortDirection) {
    console.log(options, operator, sortDirection);
  }
})
.addCase("with a numeric search", {
  field: {
    type: [Number]
  },
  filter: {
    enabled: true,
    operator: {
      enabled: true
    },
    search: {
      enabled: true
    }
  }
})
.addCase("with a numeric search and non-default operator", {
  field: {
    type: [Number]
  },
  filter: {
    enabled: true,
    operator: {
      enabled: true,
      selected: "$gte"
    },
    search: {
      enabled: true
    }
  }
})
.addCase("Put it all together", {
  field: {
    label: "A Field",
    type: [String],
    edit: true
  },
  sort: {
    enabled: true,
    direction: 1
  },
  filter: {
    search: {
      enabled: true
    },
    operator: {
      enabled: true,
      selected: "$in"
    },
    enabled: true,
    selectedOptions: ["test1", "test2"],
    options: ["test1", "test2", "test3", "test4", "test5", "test6", "test7", "test8", "test9", "test10"]
  }
});
