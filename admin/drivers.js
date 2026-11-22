// ============================================
// ADMIN: DRIVERS TAB (founder approved 20 Nov 2026)
// ============================================
// Add a driver, pause or resume them, reset a PIN. The PIN is shown ONCE, right after
// it is made, with a WhatsApp button to send the driver their sign-in details.

let driversList = [];
let driversPinBox = null; // { name, phone, pin } shown once

function driverAppUrl() { return `${window.location.origin}/driver.html`; }

function driverInviteText(d) {
    return `Hi ${d.name}, welcome to Ekoyini Driver.\nOpen: ${driverAppUrl()}\nCell: ${d.phone}\nPIN: ${d.pin}\nPlease keep your PIN private.`;
}

function driverWaLink(d) {
    return `https://wa.me/${String(d.phone).replace(/\D/g, '')}?text=${encodeURIComponent(driverInviteText(d))}`;
}

function driverRow(d) {
    const last = d.lastLoginAt ? new Date(d.lastLoginAt).toLocaleString('en-ZA') : 'never signed in';
    return `
        <div class="po-row${d.active ? '' : ' is-paid'}">
            <div class="po-who"><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.phone)}</span><small>${escapeHtml(d.vehicle || 'no vehicle saved')} · ${escapeHtml(last)}</small></div>
            <div class="po-amt">${d.active ? 'Active' : 'Paused'}</div>
            <div class="po-act">
                <button type="button" class="dispatch-btn po-btn" onclick="resetDriverPin('${escapeHtml(d.id)}')">Reset PIN</button>
                <button type="button" class="dispatch-btn po-btn" onclick="toggleDriver('${escapeHtml(d.id)}', ${d.active ? 'false' : 'true'})">${d.active ? 'Pause' : 'Resume'}</button>
            </div>
        </div>`;
}

function renderDrivers() {
    const body = document.getElementById('driversBody');
    const pin = driversPinBox;
    body.innerHTML = `
        ${pin ? `
        <div class="po-card" style="border:2px solid #1f7a4d;border-radius:16px;padding:14px;margin-bottom:14px;">
            <b>${escapeHtml(pin.name)}'s sign-in</b>
            <p style="margin:6px 0;font-size:14px;">Cell <b>${escapeHtml(pin.phone)}</b> &middot; PIN <b style="font-size:20px;letter-spacing:.1em;">${escapeHtml(pin.pin)}</b></p>
            <p style="margin:0 0 10px;font-size:12.5px;opacity:.8;">This PIN is shown once. Send it now. Next: complete their staff file (Staff files tab) with ID, licence, vehicle and bank details.</p>
            <a class="dispatch-btn" href="${escapeHtml(driverWaLink(pin))}" target="_blank" rel="noopener">Send on WhatsApp</a>
        </div>` : ''}
        <form class="admin-add-row" onsubmit="addDriver(event)" style="margin-bottom:14px;">
            <input id="drvName" placeholder="Driver name" maxlength="60" required>
            <input id="drvPhone" placeholder="Cell, e.g. 071 234 5678" inputmode="tel" required>
            <input id="drvVehicle" placeholder="Vehicle, e.g. Silver Polo" maxlength="60">
            <button type="submit" class="dispatch-btn">Add driver</button>
        </form>
        <p style="font-size:13px;opacity:.8;margin:0 0 12px;">Drivers sign in at <b>${escapeHtml(driverAppUrl())}</b>. Pausing a driver signs them out straight away.</p>
        ${driversList.length ? driversList.map(driverRow).join('') : '<div class="no-orders">No drivers yet. Add your first one above.</div>'}`;
}

async function loadDrivers() {
    const body = document.getElementById('driversBody');
    body.innerHTML = '<div class="no-orders">Loading drivers…</div>';
    try {
        const res = await adminFetch('/admin/drivers');
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
        driversList = await res.json();
        renderDrivers();
        loadTavernAccess();
    } catch (err) {
        body.innerHTML = `<div class="no-orders">Could not load drivers: ${escapeHtml(err.message)}</div>`;
    }
}

async function addDriver(e) {
    e.preventDefault();
    const payload = { name: document.getElementById('drvName').value, phone: document.getElementById('drvPhone').value, vehicle: document.getElementById('drvVehicle').value };
    const res = await adminFetch('/admin/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || 'Could not add the driver'); return; }
    driversPinBox = { name: data.driver.name, phone: data.driver.phone, pin: data.pin };
    await loadDrivers();
}

async function resetDriverPin(id) {
    const d = driversList.find((x) => x.id === id);
    if (!d || !confirm(`Make a new PIN for ${d.name}? Their old PIN stops working and they are signed out.`)) return;
    const res = await adminFetch(`/admin/drivers/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resetPin: true }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || 'Could not reset the PIN'); return; }
    driversPinBox = { name: d.name, phone: d.phone, pin: data.pin };
    await loadDrivers();
}

async function toggleDriver(id, active) {
    const res = await adminFetch(`/admin/drivers/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); alert(data.error || 'Could not update the driver'); return; }
    driversPinBox = null;
    await loadDrivers();
}

// ── Tavern portal access (founder approved 21 Nov 2026) ─────────────────────
// Switch a tavern's portal on, pause it, reset its PIN. The PIN shows once with a WhatsApp button.
let tavernAccessList = [];
let tavernPinBox = null; // { name, phone, pin }

function tavernAppUrl() { return `${window.location.origin}/tavern.html`; }

function tavernInviteText(t) {
    return `Hi, welcome to Ekoyini Tavern for ${t.name}.\nOpen: ${tavernAppUrl()}\nCell: ${t.phone}\nPIN: ${t.pin}\nHere you see the orders to pack and the collection PIN for drivers, mark items you have run out of, and see your daily payout. Please keep your PIN private.`;
}

function tavernWaLink(t) {
    return `https://wa.me/${String(t.phone).replace(/\D/g, '')}?text=${encodeURIComponent(tavernInviteText(t))}`;
}

function tavernAccessRow(t) {
    const a = t.access;
    const status = !a ? 'Not on' : (a.active ? 'Active' : 'Paused');
    const last = a ? (a.lastLoginAt ? 'last signed in ' + new Date(a.lastLoginAt).toLocaleString('en-ZA') : 'never signed in') : (t.signInOk ? 'portal is off' : 'save a valid cell number first');
    const buttons = !a
        ? `<button type="button" class="dispatch-btn po-btn"${t.signInOk ? '' : ' disabled'} onclick="tavernAccessAction('${escapeHtml(t.id)}', 'enable')">Switch on</button>`
        : `<button type="button" class="dispatch-btn po-btn" onclick="tavernAccessAction('${escapeHtml(t.id)}', 'reset')">Reset PIN</button>
           <button type="button" class="dispatch-btn po-btn" onclick="tavernAccessAction('${escapeHtml(t.id)}', '${a.active ? 'pause' : 'resume'}')">${a.active ? 'Pause' : 'Resume'}</button>`;
    return `
        <div class="po-row${a && a.active ? '' : ' is-paid'}">
            <div class="po-who"><b>${escapeHtml(t.name)}</b><span>${escapeHtml(t.phone || 'no cell number')}</span><small>${escapeHtml(t.area || '')} · ${escapeHtml(last)}${a ? ` · ${t.alertPhones} alert phone${t.alertPhones === 1 ? '' : 's'} · ${t.soldOut} sold out` : ''}</small></div>
            <div class="po-amt">${status}</div>
            <div class="po-act">${buttons}</div>
        </div>`;
}

function renderTavernAccess() {
    const body = document.getElementById('tavernAccessBody');
    if (!body) return;
    const pin = tavernPinBox;
    body.innerHTML = `
        ${pin ? `
        <div class="po-card" style="border:2px solid #1f7a4d;border-radius:16px;padding:14px;margin-bottom:14px;">
            <b>${escapeHtml(pin.name)}'s sign-in</b>
            <p style="margin:6px 0;font-size:14px;">Cell <b>${escapeHtml(pin.phone)}</b> &middot; PIN <b style="font-size:20px;letter-spacing:.1em;">${escapeHtml(pin.pin)}</b></p>
            <p style="margin:0 0 10px;font-size:12.5px;opacity:.8;">This PIN is shown once. Send it now.</p>
            <a class="dispatch-btn" href="${escapeHtml(tavernWaLink(pin))}" target="_blank" rel="noopener">Send on WhatsApp</a>
        </div>` : ''}
        <p style="font-size:13px;opacity:.8;margin:0 0 12px;">Taverns sign in at <b>${escapeHtml(tavernAppUrl())}</b> with their saved cell number and a PIN. They see the orders to pack and the collection PIN, mark items sold out and see their daily payout. Orders with a sold-out item go to the next nearest tavern.</p>
        ${tavernAccessList.length ? tavernAccessList.map(tavernAccessRow).join('') : '<div class="no-orders">No taverns yet. Add them in the Delivery tab.</div>'}`;
}

async function loadTavernAccess() {
    const body = document.getElementById('tavernAccessBody');
    if (!body) return;
    try {
        const res = await adminFetch('/admin/tavern-access');
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
        tavernAccessList = await res.json();
        renderTavernAccess();
    } catch (err) {
        body.innerHTML = `<div class="no-orders">Could not load taverns: ${escapeHtml(err.message)}</div>`;
    }
}

async function tavernAccessAction(id, action) {
    const t = tavernAccessList.find((x) => x.id === id);
    if (!t) return;
    if (action === 'reset' && !confirm(`Make a new PIN for ${t.name}? Their old PIN stops working and they are signed out.`)) return;
    if (action === 'pause' && !confirm(`Pause the portal for ${t.name}? They are signed out straight away.`)) return;
    const res = await adminFetch(`/admin/tavern-access/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || 'Could not update the tavern'); return; }
    tavernPinBox = data.pin ? { name: t.name, phone: t.phone, pin: data.pin } : null;
    await loadTavernAccess();
}

Object.assign(window, { addDriver, resetDriverPin, toggleDriver, tavernAccessAction });

const baseShowSectionForDrivers = window.showSection;
window.showSection = function (name, tabEl) {
    baseShowSectionForDrivers(name, tabEl);
    const section = document.getElementById('driversSection');
    if (section) section.style.display = name === 'drivers' ? 'block' : 'none';
    if (name === 'drivers') loadDrivers();
};
