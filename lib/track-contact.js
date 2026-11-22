// What the public tracking page may know about the driver's number (founder approved 22 Nov 2026):
// the customer gets the driver's cell ONLY while the order is out for delivery (status DISPATCHED, after
// pickup) and never before or after. The number disappears as soon as the order is delivered or cancelled.
function driverContactFor(order) {
  if (!order || order.status !== "DISPATCHED") return null;
  return order.driverPhone || null;
}
module.exports = { driverContactFor };
