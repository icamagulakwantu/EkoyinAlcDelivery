// Customer complaints about a driver (rude, unsafe, late, etc.).
// Customers file them from their profile; admins review them in the
// dashboard's "Driver reports" tab.

const REPORT_CATEGORIES = new Set(["RUDE", "UNSAFE", "LATE", "TAMPERED", "OTHER"]);
const REPORT_STATUSES = new Set(["OPEN", "REVIEWED", "RESOLVED"]);
// Only orders that actually had a driver on the road can be reported.
const REPORTABLE_ORDER_STATUSES = new Set(["DISPATCHED", "DELIVERED"]);
const MAX_REPORTS_PER_ORDER = 3;

module.exports = function mountDriverReports(app, { prisma, requireUser, requireAdmin, writeLimiter, logAdminAction }) {
  // CUSTOMER: file a report about the driver on one of their own orders.
  app.post("/api/driver-reports", writeLimiter, requireUser, async (req, res) => {
    try {
      const { orderCode, category, message } = req.body || {};
      const cleanMessage = typeof message === "string" ? message.trim() : "";
      if (!REPORT_CATEGORIES.has(category)) return res.status(400).json({ error: "Please choose what went wrong" });
      if (cleanMessage.length < 5) return res.status(400).json({ error: "Please tell us a little more about what happened" });
      if (cleanMessage.length > 1000) return res.status(400).json({ error: "Please keep your report under 1000 characters" });

      const order = await prisma.order.findUnique({ where: { code: String(orderCode || "") } });
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.userId !== req.user.id) return res.status(403).json({ error: "This isn't your order" });
      if (!order.driverName || !REPORTABLE_ORDER_STATUSES.has(order.status)) {
        return res.status(400).json({ error: "You can report a driver once your order is on the way or delivered" });
      }

      const existing = await prisma.driverReport.count({ where: { orderCode: order.code, userId: req.user.id } });
      if (existing >= MAX_REPORTS_PER_ORDER) {
        return res.status(400).json({ error: "You've already sent reports for this order — we're looking into it" });
      }

      const report = await prisma.driverReport.create({
        data: {
          orderCode: order.code,
          userId: req.user.id,
          driverName: order.driverName,
          driverPhone: order.driverPhone,
          category,
          message: cleanMessage,
        },
        select: { id: true, orderCode: true, category: true, status: true },
      });
      res.json({ ok: true, report });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to send report" });
    }
  });

  // CUSTOMER: which of my orders I've already reported (to show "Reported").
  app.get("/api/driver-reports/mine", requireUser, async (req, res) => {
    try {
      const reports = await prisma.driverReport.findMany({
        where: { userId: req.user.id },
        select: { orderCode: true },
        distinct: ["orderCode"],
      });
      res.json(reports.map((r) => r.orderCode));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load reports" });
    }
  });

  // ADMIN: newest 200 reports, with the customer's contact details attached.
  app.get("/admin/driver-reports", requireAdmin, async (req, res) => {
    try {
      const reports = await prisma.driverReport.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
      const codes = [...new Set(reports.map((r) => r.orderCode))];
      const orders = await prisma.order.findMany({
        where: { code: { in: codes } },
        select: { code: true, customerName: true, customerPhone: true },
      });
      const orderMap = new Map(orders.map((o) => [o.code, o]));
      res.json(reports.map((r) => ({
        ...r,
        customerName: orderMap.get(r.orderCode)?.customerName || null,
        customerPhone: orderMap.get(r.orderCode)?.customerPhone || null,
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load driver reports" });
    }
  });

  // ADMIN: move a report through OPEN -> REVIEWED -> RESOLVED.
  app.patch("/admin/driver-reports/:id", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body || {};
      if (!REPORT_STATUSES.has(status)) return res.status(400).json({ error: "Invalid status" });
      const report = await prisma.driverReport.update({ where: { id: req.params.id }, data: { status } });
      await logAdminAction(req, "UPDATE_DRIVER_REPORT", report.orderCode, `status=${status}`);
      res.json(report);
    } catch (err) {
      console.error(err);
      res.status(404).json({ error: "Report not found" });
    }
  });
};
