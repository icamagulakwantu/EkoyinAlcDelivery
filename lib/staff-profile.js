// Staff files for drivers and dispatchers (founder approved 22 Nov 2026).
// Pure helpers: South African ID check, field validation, encryption, masking, status.
// The ID, licence and bank account numbers are encrypted with AES-256-GCM using the
// Render env STAFF_DATA_KEY (32+ characters). Without the key nothing sensitive is saved.
const crypto = require("crypto");
const { toSaWhatsApp } = require("./phone.js");

const BANKS = ["ABSA", "Capitec", "FNB", "Nedbank", "Standard Bank", "TymeBank", "African Bank", "Discovery Bank", "Investec", "Bidvest Bank", "Other"];
const ACCOUNT_TYPES = ["CHEQUE", "SAVINGS", "TRANSMISSION"];
const LICENCE_CODES = ["A1", "A", "B", "EB", "C1", "C", "EC1", "EC"];
const KINDS = ["DRIVER", "DISPATCHER"];
const SENSITIVE = ["idNumber", "licenceNumber", "accountNumber"];
const EXPIRY_WARNING_DAYS = 30;

const short = (v, n) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, n) : "");
const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");

// ── Encryption ──────────────────────────────────────────────────────
function keyFrom(env = process.env) {
  const raw = String((env && env.STAFF_DATA_KEY) || "");
  if (raw.length < 32) return null;
  return crypto.createHash("sha256").update(raw).digest();
}
const isConfigured = (env = process.env) => !!keyFrom(env);

function encrypt(plain, env = process.env) {
  const key = keyFrom(env);
  if (!key) throw new Error("STAFF_DATA_KEY is not set");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

function decrypt(blob, env = process.env) {
  const key = keyFrom(env);
  if (!key) throw new Error("STAFF_DATA_KEY is not set");
  const [v, iv, tag, ct] = String(blob || "").split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unreadable value");
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}

// Same person cannot be filed twice, without keeping the ID number in the clear to compare.
function idHash(idNumber, env = process.env) {
  const key = keyFrom(env);
  if (!key) throw new Error("STAFF_DATA_KEY is not set");
  return crypto.createHmac("sha256", key).update("id:" + digits(idNumber)).digest("hex");
}

// ── South African ID number ─────────────────────────────────────────
function luhnOk(num) {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

// Returns { ok, error?, birthDate?, age? }. 13 digits, real birth date, citizen/resident flag, check digit, 18+.
function checkSaId(raw, now = new Date()) {
  const id = digits(raw);
  if (id.length !== 13) return { ok: false, error: "The ID number must be 13 digits." };
  const yy = Number(id.slice(0, 2)), mm = Number(id.slice(2, 4)), dd = Number(id.slice(4, 6));
  const year = 2000 + yy <= now.getUTCFullYear() ? 2000 + yy : 1900 + yy;
  const birth = new Date(Date.UTC(year, mm - 1, dd));
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== mm - 1 || birth.getUTCDate() !== dd) return { ok: false, error: "The birth date inside that ID number is not a real date." };
  if (id[10] !== "0" && id[10] !== "1") return { ok: false, error: "That is not a valid South African ID number." };
  if (!luhnOk(id)) return { ok: false, error: "That ID number fails the check digit. Please check it again." };
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() < mm - 1 || (now.getUTCMonth() === mm - 1 && now.getUTCDate() < dd)) age -= 1;
  if (age < 18) return { ok: false, error: "Staff must be 18 or older." };
  return { ok: true, birthDate: birth, age };
}

// ── Other fields ────────────────────────────────────────────────────
function normalisePlate(raw) {
  return String(raw || "").toUpperCase().replace(/[\s-]+/g, "");
}
const plateOk = (p) => /^[A-Z0-9]{4,10}$/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
const emailOk = (e) => e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function parseDate(v) {
  const s = String(v || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00.000Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}
const startOfDay = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

// Checks the form. `existing` is the saved profile when editing, so a blank sensitive field means "keep what is saved".
// Returns { errors: [..], clean } where clean holds plain values for the sensitive fields (idNumber, licenceNumber, accountNumber).
function validateProfile(kind, input, existing, now = new Date()) {
  const errors = [];
  const b = input || {};
  const clean = { kind };
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const isDriver = kind === "DRIVER";
  if (!KINDS.includes(kind)) return { errors: ["Unknown staff type"], clean };

  clean.fullName = short(b.fullName, 80);
  need(clean.fullName.split(" ").length >= 2, "Enter the full name and surname as on the ID.");

  const idRaw = digits(b.idNumber);
  if (idRaw) {
    const r = checkSaId(idRaw, now);
    if (!r.ok) errors.push(r.error); else clean.idNumber = idRaw;
  } else need(existing, "Enter the South African ID number.");

  clean.email = short(b.email, 120).toLowerCase();
  need(emailOk(clean.email), "Enter a valid email address.");
  clean.phone = toSaWhatsApp(b.phone);
  need(clean.phone, "Enter a valid South African cell number.");

  clean.addressLine = short(b.addressLine, 120);
  clean.suburb = short(b.suburb, 60);
  clean.city = short(b.city, 60);
  clean.postalCode = digits(b.postalCode);
  need(clean.addressLine.length >= 5, "Enter the home street address.");
  need(clean.suburb, "Enter the suburb or township.");
  need(clean.city, "Enter the town or city.");
  need(/^\d{4}$/.test(clean.postalCode), "Enter the 4-digit postal code.");

  if (isDriver) {
    const licRaw = String(b.licenceNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (licRaw) { if (licRaw.length >= 6 && licRaw.length <= 20) clean.licenceNumber = licRaw; else errors.push("Enter the driver's licence number (6 to 20 letters and digits)."); }
    else need(existing && existing.licenceNumberEnc, "Enter the driver's licence number.");
    clean.licenceCode = String(b.licenceCode || "").toUpperCase();
    need(LICENCE_CODES.includes(clean.licenceCode), "Choose the licence code (B, EB, C1 ...).");
    clean.licenceExpiry = parseDate(b.licenceExpiry);
    need(clean.licenceExpiry, "Enter the licence expiry date.");
    if (clean.licenceExpiry) need(clean.licenceExpiry >= startOfDay(now), "That driver's licence has expired. A valid licence is required.");

    clean.vehicleMake = short(b.vehicleMake, 40);
    clean.vehicleModel = short(b.vehicleModel, 40);
    clean.vehicleColour = short(b.vehicleColour, 30);
    need(clean.vehicleMake && clean.vehicleModel && clean.vehicleColour, "Enter the vehicle make, model and colour.");
    const yr = Number(b.vehicleYear);
    clean.vehicleYear = Number.isInteger(yr) && yr >= 1990 && yr <= now.getUTCFullYear() + 1 ? yr : null;
    need(clean.vehicleYear, "Enter the vehicle year (e.g. 2016).");
    clean.numberPlate = normalisePlate(b.numberPlate);
    need(plateOk(clean.numberPlate), "Enter the number plate, e.g. CA123456 or EC 12 AB GP.");
    clean.vehicleRegNumber = short(b.vehicleRegNumber, 30).toUpperCase();
    need(clean.vehicleRegNumber.length >= 4, "Enter the number on the vehicle registration certificate.");
    clean.vehicleDiscExpiry = parseDate(b.vehicleDiscExpiry);
    need(clean.vehicleDiscExpiry, "Enter the vehicle licence disc expiry date.");
    if (clean.vehicleDiscExpiry) need(clean.vehicleDiscExpiry >= startOfDay(now), "The vehicle licence disc has expired.");
  }

  // Bank details: required for drivers (they are paid daily); optional for dispatchers, but complete if started.
  const anyBank = ["bankName", "accountHolder", "accountNumber", "branchCode", "accountType"].some((k) => String(b[k] || "").trim());
  if (isDriver || anyBank || (existing && existing.bankName)) {
    clean.bankName = BANKS.includes(b.bankName) ? b.bankName : "";
    need(clean.bankName, "Choose the bank.");
    clean.accountHolder = short(b.accountHolder, 80);
    need(clean.accountHolder.length >= 3, "Enter the account holder name.");
    const acc = digits(b.accountNumber);
    if (acc) { if (acc.length >= 6 && acc.length <= 16) clean.accountNumber = acc; else errors.push("The account number must be 6 to 16 digits."); }
    else need(existing && existing.accountNumberEnc, "Enter the bank account number.");
    clean.branchCode = digits(b.branchCode);
    need(/^\d{6}$/.test(clean.branchCode), "Enter the 6-digit branch code.");
    clean.accountType = String(b.accountType || "").toUpperCase();
    need(ACCOUNT_TYPES.includes(clean.accountType), "Choose the account type.");
  }
  return { errors, clean };
}

// ── Display ─────────────────────────────────────────────────────────
const last4 = (v) => digits(v).slice(-4);
const mask = (l4) => (l4 ? "•••• " + l4 : "");

function daysUntil(date, now = new Date()) {
  if (!date) return null;
  return Math.floor((new Date(date).getTime() - startOfDay(now).getTime()) / 86400000);
}

// One line the admin list shows for each person.
function profileStatus(kind, p, now = new Date()) {
  if (!p) return { code: "MISSING", label: "No staff file yet", ok: false, flags: [] };
  const flags = [];
  if (kind === "DRIVER") {
    const l = daysUntil(p.licenceExpiry, now), v = daysUntil(p.vehicleDiscExpiry, now);
    if (l != null && l < 0) flags.push("Licence expired");
    else if (l != null && l <= EXPIRY_WARNING_DAYS) flags.push(`Licence expires in ${l} days`);
    if (v != null && v < 0) flags.push("Vehicle disc expired");
    else if (v != null && v <= EXPIRY_WARNING_DAYS) flags.push(`Vehicle disc expires in ${v} days`);
  }
  const expired = flags.some((f) => /expired$/.test(f));
  if (!p.verified) return { code: "UNVERIFIED", label: "Filed, not verified yet", ok: false, flags };
  if (expired) return { code: "EXPIRED", label: "Verified, but a document has expired", ok: false, flags };
  return { code: "VERIFIED", label: "Verified", ok: true, flags };
}

// What the admin form gets: everything except the encrypted values (masked last digits instead).
function publicView(p) {
  if (!p) return null;
  const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  return {
    id: p.id, kind: p.kind, fullName: p.fullName, email: p.email, phone: p.phone,
    addressLine: p.addressLine, suburb: p.suburb, city: p.city, postalCode: p.postalCode,
    idNumberMasked: mask(p.idLast4), licenceNumberMasked: mask(p.licenceLast4), accountNumberMasked: mask(p.accountLast4),
    licenceCode: p.licenceCode || "", licenceExpiry: iso(p.licenceExpiry),
    vehicleMake: p.vehicleMake || "", vehicleModel: p.vehicleModel || "", vehicleColour: p.vehicleColour || "",
    vehicleYear: p.vehicleYear || "", numberPlate: p.numberPlate || "", vehicleRegNumber: p.vehicleRegNumber || "",
    vehicleDiscExpiry: iso(p.vehicleDiscExpiry),
    bankName: p.bankName || "", accountHolder: p.accountHolder || "", branchCode: p.branchCode || "", accountType: p.accountType || "",
    verified: p.verified, verifiedAt: p.verifiedAt, verifiedBy: p.verifiedBy, updatedAt: p.updatedAt,
  };
}

module.exports = {
  BANKS, ACCOUNT_TYPES, LICENCE_CODES, KINDS, SENSITIVE, EXPIRY_WARNING_DAYS,
  isConfigured, encrypt, decrypt, idHash, checkSaId, luhnOk, normalisePlate, plateOk,
  validateProfile, profileStatus, publicView, last4, mask, daysUntil,
};
