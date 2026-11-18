// South African phone numbers in the one format WhatsApp links need:
// 27 + 9 digits, no "+", spaces or leading 0 (founder, 18 Nov 2026: the app
// adds the +27 itself so a busy dispatcher never has to).
//   "071 973 6683" -> "27719736683"   "+27 71 973 6683" -> "27719736683"
// Returns null when it isn't a South African mobile/landline number.
function toSaWhatsApp(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) return "27" + d.slice(1);
  if (d.length === 11 && d.startsWith("27")) return d;
  if (d.length === 9 && !d.startsWith("0")) return "27" + d;
  return null;
}

module.exports = { toSaWhatsApp };
