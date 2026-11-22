// Mounts feature route modules onto the Express app. New features add a
// file in this folder and one line here, so server.js stays untouched.
module.exports = function mountRoutes(app, deps) {
  require("./driver-reports.js")(app, deps);
  require("./delivery.js")(app, deps);
  require("./payouts.js")(app, deps);
  require("./dispatch-alerts.js")(app, deps);
  require("./push.js")(app, deps);
  require("./pay-qr.js")(app, deps);
  require("./drivers.js")(app, deps);
  require("./tavern-portal.js")(app, deps);
  require("./staff.js")(app, deps);
  require("./receipt.js")(app, deps);
};
