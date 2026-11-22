// Receipt details for a partner tavern (founder approved 22 Nov 2026): legal name, VAT number, liquor licence
// number, address. All optional; a blank value clears it. South African VAT numbers are 10 digits starting with 4.
const short = (v, n) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, n) : "");

function cleanTaxDetails(body) {
  const b = body || {};
  const errors = [];
  const clean = {};
  clean.legalName = short(b.legalName, 100) || null;
  clean.address = short(b.address, 150) || null;
  const vat = String(b.vatNumber == null ? "" : b.vatNumber).replace(/\s+/g, "");
  if (vat) {
    if (/^4\d{9}$/.test(vat)) clean.vatNumber = vat;
    else errors.push("A South African VAT number is 10 digits and starts with 4. Leave it blank if the tavern is not VAT registered.");
  } else clean.vatNumber = null;
  const lic = short(b.liquorLicenceNumber, 40);
  if (lic && !/^[A-Za-z0-9][A-Za-z0-9 \-\/]{1,39}$/.test(lic)) errors.push("The liquor licence number can only have letters, digits, spaces, - and /.");
  else clean.liquorLicenceNumber = lic || null;
  return { errors, clean };
}

module.exports = { cleanTaxDetails };
