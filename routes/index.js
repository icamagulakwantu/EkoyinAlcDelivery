// Mounts feature route modules onto the Express app. New features add a
// file in this folder and one line here, so server.js stays untouched.
module.exports = function mountRoutes(app, deps) {
  require("./driver-reports.js")(app, deps);
};
