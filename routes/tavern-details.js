// Partner tavern receipt details (founder approved 22 Nov 2026). Super-admin only; every change is logged.
const { cleanTaxDetails } = require("../lib/tavern-tax.js");

module.exports = function mountTavernDetails(app, { prisma, requireAdmin, requireSuperAdmin, writeLimiter, logAdminAction }) {
  app.patch("/admin/taverns/:id/details", requireAdmin, requireSuperAdmin, writeLimiter, async (req, res) => {
    try {
      const tavern = await prisma.tavern.findUnique({ where: { id: String(req.params.id) } });
      if (!tavern) return res.status(404).json({ error: "Tavern not found" });
      const { errors, clean } = cleanTaxDetails(req.body);
      if (errors.length) return res.status(400).json({ error: errors[0] });
      const saved = await prisma.tavern.update({ where: { id: tavern.id }, data: clean });
      await logAdminAction(req, "UPDATE_TAVERN_DETAILS", tavern.id, `tavern=${tavern.name}, vat=${clean.vatNumber ? "saved" : "none"}, licence=${clean.liquorLicenceNumber ? "saved" : "none"}`);
      res.json({ ok: true, tavern: { id: saved.id, legalName: saved.legalName, vatNumber: saved.vatNumber, liquorLicenceNumber: saved.liquorLicenceNumber, address: saved.address } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not save the tavern details" });
    }
  });
};
