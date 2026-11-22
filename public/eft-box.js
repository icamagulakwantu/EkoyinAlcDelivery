// The EFT banking box on the order-confirmation and tracking pages (22 Nov 2026).
// Shows the account, the amount and the reference (the order code) for an EFT order that is waiting for payment,
// with copy buttons. Details come from the server (GET /api/order/:code/eft), never from the page.
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (n) => 'R' + Number(n || 0).toFixed(2);
  const row = (label, value, copy) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(0,0,0,.08);">
      <div><div style="font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.5px;">${esc(label)}</div><div style="font-weight:700;font-size:15px;">${esc(value)}</div></div>
      ${copy ? `<button type="button" data-copy="${esc(copy)}" style="border:0;border-radius:999px;padding:7px 12px;background:#17140e;color:#faf6ee;font-size:12px;font-weight:700;">Copy</button>` : ''}
    </div>`;

  async function mount(slot, code) {
    if (!slot || !code) return;
    try {
      const res = await fetch(`/api/order/${encodeURIComponent(code)}/eft`);
      if (!res.ok) return;
      const d = await res.json();
      if (!d.configured) return; // dispatch sends the details, as before
      const b = d.details;
      slot.innerHTML = `<div style="text-align:left;margin:14px 0;padding:14px 16px;border-radius:16px;background:#fff;border:1px solid rgba(0,0,0,.1);">
        <div style="font-weight:800;margin-bottom:4px;">Pay by EFT</div>
        <div style="background:#fff3cd;border-radius:10px;padding:10px 12px;margin:0 0 6px;font-size:13px;font-weight:700;line-height:1.45;">Pay now, and choose <u>Immediate payment</u> or <u>PayShap</u> in your banking app. A normal EFT can take until the next business day. We will not pack or send your order until the money has reflected in our account.</div>
        ${row('Amount to pay', rand(d.amount), Number(d.amount).toFixed(2))}
        ${row('Bank', b.bankName)}
        ${row('Account name', b.accountName)}
        ${row('Account number', b.accountNumberSpaced, b.accountNumber)}
        ${row('Branch code', b.branchCode, b.branchCode)}
        ${row('Account type', b.accountType)}
        ${row('Payment reference (important)', d.reference, d.reference)}
        <p style="font-size:12px;opacity:.75;margin:10px 0 0;line-height:1.4;">Use the reference exactly, so we can match your payment. We start packing the moment it reflects. Only pay into the account shown here, on this page or in your confirmation email. We never change banking details by WhatsApp or phone.</p>
      </div>`;
      slot.querySelectorAll('[data-copy]').forEach((btn) => {
        btn.onclick = async () => {
          try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); } catch { btn.textContent = 'Select it'; }
        };
      });
    } catch (_) { /* the page keeps its normal EFT note */ }
  }
  window.EkoyiniEft = { mount };
})();
