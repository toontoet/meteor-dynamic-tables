/* global Package, Npm */

Package.describe({
  name: "znewsham:dynamic-table",
  summary: "Flexible datatables for large collections in Meteor",
  version: "0.0.1",
  git: "https://bitbucket.org/znewsham/meteor-dynamic-table.git"
});

Npm.depends({
  "file-saver": "1.3.8",
  "datatables.net": "2.1.1"
});

Package.onUse((api) => {
  api.versionsFrom(["METEOR@1.4"]);
  api.use([
    "peppelg:bootstrap-3-modal",
    "reywood:publish-composite",
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

  api.use(["meteorhacks:subs-manager@1.2.0"], ["client", "server"], { weak: true });

  api.mainModule("server/main.js", "server");
  api.mainModule("client/main.js", "client");
});
