const { COOLER_ELIGIBLE, coolerDiscountPct, deliveryFee, roundCurrency, computeDerivedTotals } = require("./public/pricing.js");

// Shared total calculation (subtotal → minus Cooler Box and promo → plus
// delivery). Previously copy-pasted in three places.
function computeOrderTotal(subtotal, coolerDiscount, promoDiscount) {
  const totals = computeDerivedTotals({ subtotal, coolerDiscount, promoDiscount });
  return totals.total;
}

function computePromoDiscount(subtotal, coolerDiscount, promo) {
  if (!promo) return 0;
  return roundCurrency((subtotal - coolerDiscount) * (promo.discountPct / 100));
}
