/* global Package, Npm */

Package.describe({
  name: "znewsham:dynamic-table",
  summary: "Flexible datatables for large collections in Meteor",
  version: "1.4.6",
  git: "https://bitbucket.org/znewsham/meteor-dynamic-tables"
});


Npm.depends({
  "file-saver": "1.3.8",
  "datatables.net": "2.1.1",
  underscore: "1.9.1"
});
Package.onUse((api) => {
  api.versionsFrom(["METEOR@1.4"]);
  api.use([
    "peppelg:bootstrap-3-modal@1.0.4",
    "reywood:publish-composite@1.5.2",
    "check",
    "ecmascript",
    "underscore",
    "mongo",
    "blaze",
    "templating",
    "reactive-var",
    "tracker",
    "session"
  ]);

  // jquery is a weak reference in case you want to use a different package or
  // pull it in another way, but regardless you need to make sure it is loaded
  // before any tabular tables are rendered
  api.use(["jquery"], "client", { weak: true });

  api.mainModule("server/main.js", "server");
  api.mainModule("client/main.js", "client", { lazy: true });
});

Package.onTest((api) => {
  //api.use("znewsham:blaze-explorer@0.0.1");
  api.use([
    "fortawesome:fontawesome",
    "peppelg:bootstrap-3-modal@1.0.4",
    "reywood:publish-composite@1.5.2",
    "check",
    "ecmascript",
    "underscore",
    "mongo",
    "blaze",
    "templating",
    "reactive-var",
    "tracker",
    "session"
  ]);
  api.use("znewsham:dynamic-table");
  api.mainModule("dynamic-table-tests.js", "client");
});
