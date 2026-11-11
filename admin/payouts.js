// ============================================
// ADMIN: PAYOUTS TAB (founder, 11 Nov 2026)
// ============================================
// Who is owed what for delivered orders: drivers (delivery, surge and
// priority fees, less cash they collected) and taverns (the shelf price of
// what they sold, plus bottles & crates). Amounts come from the server.
// Pay in the banking app, then tap "Mark as paid" (super admins).

const payoutsDay = (offset) => {
    const d = new Date(Date.now() + 2 * 3600 * 1000 - offset * 86400000);
    return d.toISOString().slice(0, 10);
};
let payoutsRange = { from: payoutsDay(1), to: payoutsDay(1) };
let payoutsData = null;

function payoutRow(type, x) {
    const isSuper = currentAdminRole === 'SUPER_ADMIN';
    const owes = type === 'DRIVER' && x.owed < 0;
    const detail = type === 'DRIVER'
        ? `${x.orders.length} deliver${x.orders.length === 1 ? 'y' : 'ies'} · earned ${formatRand(x.earned)}${x.cashCollected ? ` · holds ${formatRand(x.cashCollected)} cash` : ''}`
        : `${x.orders.length} order${x.orders.length === 1 ? '' : 's'} · ${x.orders.map((o) => o.code).join(', ')}`;
    const keyJs = JSON.stringify(x.key).replace(/"/g, '&quot;');
    let action = '';
    if (x.paid) {
        action = `<span class="po-paid">Paid ${formatRand(x.paid.amount)}${isSuper ? ` <button type="button" class="po-undo" onclick="unmarkPayout('${type}', ${keyJs})">undo</button>` : ''}</span>`;
    } else if (isSuper && x.owed !== 0) {
        action = `<button type="button" class="dispatch-btn po-btn" onclick="markPayout('${type}', ${keyJs})">${owes ? 'Mark as received' : 'Mark as paid'}</button>`;
    }
    return `
        <div class="po-row${x.paid ? ' is-paid' : ''}">
            <div class="po-who"><b>${esc(x.name)}</b><span>${esc(x.phone || '')}</span><small>${esc(detail)}</small></div>
            <div class="po-amt${owes ? ' owes' : ''}">${owes ? `owes ${formatRand(-x.owed)}` : formatRand(x.owed)}</div>
            <div class="po-act">${action}</div>
        </div>`;
}

async function loadPayouts() {
    const body = document.getElementById('payoutsBody');
    body.innerHTML = '<div class="no-orders">Working out payouts…</div>';
    try {
        const res = await adminFetch(`/admin/payouts?from=${payoutsRange.from}&to=${payoutsRange.to}`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
        const p = payoutsData = await res.json();
        const single = p.from === p.to;
        const isSuper = currentAdminRole === 'SUPER_ADMIN';
        body.innerHTML = `
            <div class="rep-range">
                <button type="button" class="rep-range-btn${single && p.from === payoutsDay(1) ? ' active' : ''}" onclick="setPayoutRange(1, 1)">Yesterday</button>
                <button type="button" class="rep-range-btn${single && p.from === payoutsDay(0) ? ' active' : ''}" onclick="setPayoutRange(0, 0)">Today so far</button>
                <button type="button" class="rep-range-btn${!single && p.from === payoutsDay(7) ? ' active' : ''}" onclick="setPayoutRange(7, 1)">Last 7 days</button>
                <input type="date" class="po-date" value="${esc(p.from)}" onchange="setPayoutDate(this.value)" aria-label="Pick a day">
            </div>
            <p class="po-period">${single ? `Delivered on <b>${esc(p.from)}</b>` : `Delivered <b>${esc(p.from)}</b> to <b>${esc(p.to)}</b>`} · ${p.totals.orders} order${p.totals.orders === 1 ? '' : 's'}</p>
            <div class="rep-tiles">
                <div class="rep-tile"><b>${formatRand(p.totals.sales)}</b><span>Customers paid</span></div>
                <div class="rep-tile"><b>${formatRand(p.totals.toDrivers)}</b><span>Drivers earned</span></div>
                <div class="rep-tile"><b>${formatRand(p.totals.toTaverns)}</b><span>Owed to taverns</span></div>
                <div class="rep-tile"><b>${formatRand(p.totals.yocoFees)}</b><span>Yoco card fees (est.)</span></div>
                <div class="rep-tile"><b>${formatRand(p.totals.ekoyini)}</b><span>Ekoyini keeps</span></div>
                <div class="rep-tile"><b>${formatRand(p.totals.cashCollected)}</b><span>Cash held by drivers</span></div>
            </div>
            ${p.unassigned.length ? `<p class="po-warn">No tavern or driver recorded on: ${esc(p.unassigned.join(', '))}. Fix these orders so they are paid.</p>` : ''}
            <section class="rep-card po-card">
                <div class="po-head"><h3>Drivers <small>pay daily at 12:00</small></h3><button type="button" class="secondary-btn" onclick="copyPayoutList('DRIVER')">Copy list</button></div>
                ${p.drivers.length ? p.drivers.map((d) => payoutRow('DRIVER', d)).join('') : '<div class="no-orders" style="padding:12px">No deliveries</div>'}
            </section>
            <section class="rep-card po-card">
                <div class="po-head"><h3>Taverns <small>pay daily at 12:00 · shelf price of what they sold + bottles</small></h3><button type="button" class="secondary-btn" onclick="copyPayoutList('TAVERN')">Copy list</button></div>
                ${p.taverns.length ? p.taverns.map((t) => payoutRow('TAVERN', t)).join('') : '<div class="no-orders" style="padding:12px">No tavern sales</div>'}
            </section>
            <p class="rep-note po-note">How it is worked out: a tavern gets the item price less our markup (7% beer, cider and wine, 5% spirits and mixers) plus the bottles & crates charge. A driver gets 100% of the delivery, surge and priority fees; cash they collected on cash orders is taken off (red means the driver owes Ekoyini). Ekoyini keeps the rest and carries the Cooler Box, promo and Yoco costs.${isSuper ? '' : ' Only super admins can mark payments.'}</p>`;
    } catch (err) {
        console.error(err);
        body.innerHTML = `<div class="no-orders">${esc(err.message || 'Failed to load payouts')}</div>`;
    }
}

function setPayoutRange(fromDaysAgo, toDaysAgo) {
    payoutsRange = { from: payoutsDay(fromDaysAgo), to: payoutsDay(toDaysAgo) };
    loadPayouts();
}
function setPayoutDate(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    payoutsRange = { from: day, to: day };
    loadPayouts();
}

async function markPayout(type, key) {
    const list = type === 'DRIVER' ? payoutsData.drivers : payoutsData.taverns;
    const x = list.find((i) => i.key === key);
    if (!x) return;
    const words = x.owed < 0 ? `Record that ${x.name} paid Ekoyini ${formatRand(-x.owed)}?` : `Record that you paid ${x.name} ${formatRand(x.owed)}?`;
    if (!confirm(words)) return;
    try {
        const res = await adminFetch('/admin/payouts/paid', { method: 'POST', body: JSON.stringify({ from: payoutsData.from, to: payoutsData.to, payeeType: type, payeeKey: key }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
        loadPayouts();
    } catch (err) {
        alert(err.message || 'Could not record the payment');
    }
}

async function unmarkPayout(type, key) {
    if (!confirm('Undo this "paid" mark?')) return;
    try {
        const res = await adminFetch('/admin/payouts/paid', { method: 'DELETE', body: JSON.stringify({ period: payoutsData.period, payeeType: type, payeeKey: key }) });
        if (!res.ok) throw new Error('Failed');
        loadPayouts();
    } catch (err) {
        alert('Could not undo');
    }
}

// Plain text for the banking app / WhatsApp: one line per person still unpaid.
async function copyPayoutList(type) {
    const list = (type === 'DRIVER' ? payoutsData.drivers : payoutsData.taverns).filter((x) => !x.paid && x.owed > 0);
    if (!list.length) { alert('Nobody left to pay in this list'); return; }
    const period = payoutsData.from === payoutsData.to ? payoutsData.from : `${payoutsData.from} to ${payoutsData.to}`;
    const text = [`Ekoyini ${type === 'DRIVER' ? 'driver' : 'tavern'} payouts, ${period}`]
        .concat(list.map((x) => `${x.name} (${x.phone || 'no phone'}): ${formatRand(x.owed)}`))
        .concat([`Total: ${formatRand(list.reduce((s, x) => s + x.owed, 0))}`]).join('\n');
    try {
        await navigator.clipboard.writeText(text);
        alert('Copied. Paste it into your notes or banking app.');
    } catch {
        prompt('Copy this list:', text);
    }
}

Object.assign(window, { setPayoutRange, setPayoutDate, markPayout, unmarkPayout, copyPayoutList });

const baseShowSectionForPayouts = window.showSection;
window.showSection = function (name, tabEl) {
    baseShowSectionForPayouts(name, tabEl);
    const section = document.getElementById('payoutsSection');
    if (section) section.style.display = name === 'payouts' ? 'block' : 'none';
    if (name === 'payouts') loadPayouts();
};
