// Staff files (founder approved 22 Nov 2026): proper onboarding records for drivers and dispatchers.
// Super-admin only. ID, licence and account numbers are encrypted (lib/staff-profile.js); the list and
// form only ever see the last 4 digits, "Show full details" decrypts and is written to the activity log.
const S = require("../lib/staff-profile.js");

const PUBLIC_SELECT = {
  id: true, kind: true, driverId: true, adminEmail: true, fullName: true, licenceExpiry: true, vehicleDiscExpiry: true,
  verified: true, updatedAt: true,
};

module.exports = function mountStaff(app, { prisma, requireAdmin, requireSuperAdmin, writeLimiter, logAdminAction }) {
  const guard = [requireAdmin, requireSuperAdmin];

  // Finds the driver or dispatcher the URL points at.
  async function findPerson(kindParam, refParam) {
    const kind = String(kindParam).toUpperCase();
    if (kind === "DRIVER") {
      const d = await prisma.driver.findUnique({ where: { id: String(refParam) } });
      return d ? { kind, ref: d.id, name: d.name, phone: d.phone, email: "", where: { driverId: d.id }, create: { driverId: d.id } } : null;
    }
    if (kind === "DISPATCHER") {
      const email = String(refParam).trim().toLowerCase();
      const a = await prisma.adminUser.findUnique({ where: { email } });
      return a ? { kind, ref: a.email, name: "", phone: "", email: a.email, where: { adminEmail: a.email }, create: { adminEmail: a.email } } : null;
    }
    return null;
  }

  app.get("/admin/staff", ...guard, async (req, res) => {
    try {
      const [drivers, admins, profiles] = await Promise.all([
        prisma.driver.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, phone: true, active: true } }),
        prisma.adminUser.findMany({ orderBy: { createdAt: "asc" }, select: { email: true, role: true } }),
        prisma.staffProfile.findMany({ select: PUBLIC_SELECT }),
      ]);
      const byDriver = new Map(profiles.filter((p) => p.driverId).map((p) => [p.driverId, p]));
      const byEmail = new Map(profiles.filter((p) => p.adminEmail).map((p) => [p.adminEmail, p]));
      const people = [
        ...drivers.map((d) => ({ kind: "DRIVER", ref: d.id, name: d.name, sub: d.phone + (d.active ? "" : " · paused"), status: S.profileStatus("DRIVER", byDriver.get(d.id)) })),
        ...admins.map((a) => ({ kind: "DISPATCHER", ref: a.email, name: a.email, sub: a.role === "SUPER_ADMIN" ? "Super admin" : "Dispatcher", status: S.profileStatus("DISPATCHER", byEmail.get(a.email)) })),
      ];
      res.json({ keyReady: S.isConfigured(), people });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load staff files" });
    }
  });

  app.get("/admin/staff/:kind/:ref", ...guard, async (req, res) => {
    try {
      const person = await findPerson(req.params.kind, req.params.ref);
      if (!person) return res.status(404).json({ error: "Person not found" });
      const profile = await prisma.staffProfile.findUnique({ where: person.where });
      res.json({
        keyReady: S.isConfigured(),
        person: { kind: person.kind, ref: person.ref, name: person.name, phone: person.phone, email: person.email },
        profile: S.publicView(profile),
        status: S.profileStatus(person.kind, profile),
        options: { banks: S.BANKS, accountTypes: S.ACCOUNT_TYPES, licenceCodes: S.LICENCE_CODES },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load the staff file" });
    }
  });

  app.put("/admin/staff/:kind/:ref", ...guard, writeLimiter, async (req, res) => {
    try {
      if (!S.isConfigured()) return res.status(503).json({ error: "The staff data key is not set on Render yet, so nothing can be saved safely. Ask your developer to add STAFF_DATA_KEY." });
      const person = await findPerson(req.params.kind, req.params.ref);
      if (!person) return res.status(404).json({ error: "Person not found" });
      const existing = await prisma.staffProfile.findUnique({ where: person.where });
      const { errors, clean } = S.validateProfile(person.kind, req.body, existing);
      if (errors.length) return res.status(400).json({ error: errors[0], errors });

      const data = {
        kind: person.kind, fullName: clean.fullName, email: clean.email, phone: clean.phone,
        addressLine: clean.addressLine, suburb: clean.suburb, city: clean.city, postalCode: clean.postalCode,
        verified: false, verifiedAt: null, verifiedBy: null, // any change needs checking again
      };
      if (clean.idNumber) {
        const hash = S.idHash(clean.idNumber);
        const dup = await prisma.staffProfile.findUnique({ where: { idNumberHash: hash } });
        if (dup && (!existing || dup.id !== existing.id)) return res.status(409).json({ error: "Someone with that ID number already has a staff file." });
        Object.assign(data, { idNumberEnc: S.encrypt(clean.idNumber), idNumberHash: hash, idLast4: S.last4(clean.idNumber) });
      }
      if (person.kind === "DRIVER") {
        Object.assign(data, {
          licenceCode: clean.licenceCode, licenceExpiry: clean.licenceExpiry,
          vehicleMake: clean.vehicleMake, vehicleModel: clean.vehicleModel, vehicleColour: clean.vehicleColour, vehicleYear: clean.vehicleYear,
          numberPlate: clean.numberPlate, vehicleRegNumber: clean.vehicleRegNumber, vehicleDiscExpiry: clean.vehicleDiscExpiry,
        });
        if (clean.licenceNumber) Object.assign(data, { licenceNumberEnc: S.encrypt(clean.licenceNumber), licenceLast4: S.last4(clean.licenceNumber) });
      }
      if (clean.bankName) {
        Object.assign(data, { bankName: clean.bankName, accountHolder: clean.accountHolder, branchCode: clean.branchCode, accountType: clean.accountType });
        if (clean.accountNumber) Object.assign(data, { accountNumberEnc: S.encrypt(clean.accountNumber), accountLast4: S.last4(clean.accountNumber) });
      }

      const saved = existing
        ? await prisma.staffProfile.update({ where: { id: existing.id }, data })
        : await prisma.staffProfile.create({ data: { ...data, ...person.create } });
      await logAdminAction(req, existing ? "UPDATE_STAFF_FILE" : "CREATE_STAFF_FILE", saved.id, `${person.kind.toLowerCase()}=${clean.fullName}`);
      res.json({ ok: true, profile: S.publicView(saved), status: S.profileStatus(person.kind, saved) });
    } catch (err) {
      if (err && err.code === "P2002") return res.status(409).json({ error: "That ID number or person already has a staff file." });
      console.error(err);
      res.status(500).json({ error: "Could not save the staff file" });
    }
  });

  // Show the full ID, licence and account numbers. Logged every time.
  app.post("/admin/staff/:kind/:ref/reveal", ...guard, writeLimiter, async (req, res) => {
    try {
      if (!S.isConfigured()) return res.status(503).json({ error: "The staff data key is not set." });
      const person = await findPerson(req.params.kind, req.params.ref);
      const p = person && await prisma.staffProfile.findUnique({ where: person.where });
      if (!p) return res.status(404).json({ error: "No staff file yet" });
      const out = {
        idNumber: S.decrypt(p.idNumberEnc),
        licenceNumber: p.licenceNumberEnc ? S.decrypt(p.licenceNumberEnc) : "",
        accountNumber: p.accountNumberEnc ? S.decrypt(p.accountNumberEnc) : "",
      };
      await logAdminAction(req, "VIEW_STAFF_SENSITIVE", p.id, `${p.kind.toLowerCase()}=${p.fullName}`);
      res.set("Cache-Control", "no-store").json(out);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not read the saved details" });
    }
  });

  app.post("/admin/staff/:kind/:ref/verify", ...guard, writeLimiter, async (req, res) => {
    try {
      const person = await findPerson(req.params.kind, req.params.ref);
      const p = person && await prisma.staffProfile.findUnique({ where: person.where });
      if (!p) return res.status(404).json({ error: "No staff file yet" });
      const verified = !!(req.body && req.body.verified === true);
      if (verified && S.profileStatus(p.kind, { ...p, verified: true }).code === "EXPIRED") {
        return res.status(400).json({ error: "A document has expired. Update the file first." });
      }
      const saved = await prisma.staffProfile.update({
        where: { id: p.id },
        data: verified ? { verified: true, verifiedAt: new Date(), verifiedBy: req.user?.email || "api-token" } : { verified: false, verifiedAt: null, verifiedBy: null },
      });
      await logAdminAction(req, verified ? "VERIFY_STAFF_FILE" : "UNVERIFY_STAFF_FILE", p.id, `${p.kind.toLowerCase()}=${p.fullName}`);
      res.json({ ok: true, profile: S.publicView(saved), status: S.profileStatus(p.kind, saved) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not update verification" });
    }
  });
};
