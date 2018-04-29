// Import Tinytest from the tinytest Meteor package.
import { Tinytest } from "meteor/tinytest";

// Import and rename a variable exported by dynamic-table.js.
import { name as packageName } from "meteor/znewsham:dynamic-table";

// Write your tests here!
// Here is an example.
Tinytest.add('dynamic-table - example', function (test) {
  test.equal(packageName, "dynamic-table");
});
