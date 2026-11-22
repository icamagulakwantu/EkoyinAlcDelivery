// One place that decides who hears about each step of an order (22 Nov 2026), so the loop between
// customer, dispatcher, tavern and driver closes without anyone having to chase anyone.
//
//   DRIVER_TOOK        a driver took the job from the board    -> customer
//   ASSIGNED_BY_ADMIN  dispatch gave the job to a driver        -> customer, driver
//   READY              the tavern marked the order packed       -> driver, customer
//   PICKED_UP          the driver confirmed pickup (PIN + GPS)  -> dispatchers, customer (phone alert + email)
//   DELIVERED          the driver confirmed delivery            -> customer
//   CANCELLED          cancelled by customer or dispatch        -> driver, tavern, customer, dispatchers (if the customer did it)
//
// Every send is best effort: a failed alert never touches the order. Alerts carry no customer details.
function createOrderEvents({ prisma, push, driverPush, tavernPush, customerPush, sendOutForDeliveryEmail, log = console }) {
  async function fire(event, code, { by } = {}) {
    try {
      const order = await prisma.order.findUnique({ where: { code }, include: { tavern: true } });
      if (!order) return;
      const jobs = [];
      const customer = (e) => customerPush && jobs.push(customerPush.notify(order, e));
      switch (event) {
        case "DRIVER_TOOK":
          customer("ASSIGNED");
          break;
        case "ASSIGNED_BY_ADMIN":
          customer("ASSIGNED");
          if (driverPush) jobs.push(driverPush.notifyAssigned(order));
          break;
        case "READY":
          if (driverPush) jobs.push(driverPush.notifyReady(order));
          customer("READY");
          break;
        case "PICKED_UP":
          customer("PICKED_UP");
          if (push) jobs.push(push.sendToAdmins({
            title: `Out for delivery: ${order.code}`,
            body: `${order.driverName || "Driver"} collected it. Live location is on. Tap to follow.`,
            tag: "picked-up-" + order.code, url: "/admin/admin.html", urgent: false,
          }));
          if (sendOutForDeliveryEmail) jobs.push(sendOutForDeliveryEmail(order));
          break;
        case "DELIVERED":
          customer("DELIVERED");
          break;
        case "CANCELLED":
          if (driverPush) jobs.push(driverPush.notifyCancelled(order));
          if (tavernPush) jobs.push(tavernPush.notifyCancelled(order));
          customer("CANCELLED");
          if (by === "customer" && push) jobs.push(push.sendToAdmins({
            title: `Customer cancelled ${order.code}`,
            body: order.driverName ? `${order.driverName} and ${order.tavern ? order.tavern.name : "the outlet"} have been told.` : "No driver was assigned yet.",
            tag: "cancelled-" + order.code, url: "/admin/admin.html", urgent: true,
          }));
          break;
        default:
          return;
      }
      await Promise.allSettled(jobs);
    } catch (err) {
      log.error(`[order events] ${event} ${code} failed:`, err);
    }
  }
  return { fire };
}

module.exports = { createOrderEvents };
