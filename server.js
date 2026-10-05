// server.js
// ...

// Delivery is free only for orders above R1000.
const delivery = subtotal > 1000 ? 0 : 50;
const total = Math.round((subtotal - coolerDiscount - promoDiscount + delivery) * 100) / 100;
