// Hangout spots (tshisanyama places, butcheries) that people order to. The
// list lives in public/venues.json so the checkout page and the server read
// the same file. See _readme in that file.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "public", "venues.json");
let cache = null;

function loadVenues() {
  if (!cache) {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    cache = (data.venues || []).filter((v) => v && v.id && v.name && v.listed !== false);
  }
  return cache;
}
function findVenue(id) {
  if (typeof id !== "string" || !id) return null;
  return loadVenues().find((v) => v.id === id) || null;
}

// If the order names a spot, the spot decides where it goes: the address and
// pin always come from the venues file (so "cash at the spot" cannot be used
// for a different address), and the customer's own note is kept after the
// spot's name. Returns { venue: null } when no spot was chosen,
// { error } for an unknown one, else { venue, fields } to merge into the order.
function applyVenue(body) {
  const id = body && body.venueId;
  if (id == null || id === "") return { venue: null };
  const venue = findVenue(id);
  if (!venue) return { error: "That delivery spot isn't available any more. Please choose another or enter an address." };
  const note = typeof body.landmark === "string" ? body.landmark.trim() : "";
  const landmark = (note ? `${venue.name} — ${note}` : venue.name).slice(0, 200);
  const hasPin = Number.isFinite(venue.lat) && Number.isFinite(venue.lng);
  return {
    venue,
    fields: {
      address: venue.address,
      landmark,
      deliveryLat: hasPin ? venue.lat : null,
      deliveryLng: hasPin ? venue.lng : null,
    },
  };
}

module.exports = { loadVenues, findVenue, applyVenue };
