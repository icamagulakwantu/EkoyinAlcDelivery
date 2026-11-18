const test = require("node:test");
const assert = require("node:assert");
const { toSaWhatsApp } = require("../lib/phone.js");

test("phone numbers are saved as 27... whatever way they are typed", () => {
  for (const typed of ["0719736683", "071 973 6683", "071-973-6683", "+27 71 973 6683", "27719736683", "719736683"]) {
    assert.equal(toSaWhatsApp(typed), "27719736683", typed);
  }
  assert.equal(toSaWhatsApp("12345"), null);
  assert.equal(toSaWhatsApp(""), null);
});
