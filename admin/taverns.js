// ============================================
// ADMIN: TAVERNS TAB (founder, 23 Nov 2026: "make one Taverns tab")
// ============================================
// Everything about a partner tavern in one place: add it, its WhatsApp
// number (also its portal sign-in), its map location (delivery distance and
// nearest tavern), its portal (switch on, reset PIN, pause) and the details
// printed on the customer's receipt. Super admins edit; dispatchers can see
// the list and send portal PINs, as before.

let tavernsList = [];
let tavernsPinBox = null; // { name, phone, pin } shown once

const tavernsPortalUrl = () => `${window.location.origin}/tavern.html`;
const isSuperAdmin = () => currentAdminRole === 'SUPER_ADMIN';

function tavernsInviteLink(t) {
    const text = `Hi, welcome to Ekoyini Tavern for ${t.name}.\nOpen: ${tavernsPortalUrl()}\nCell: ${t.phone}\nPIN: ${t.pin}\nHere you see the orders to pack and the collection PIN for drivers, mark items you have run out of, and see your daily payout. Please keep your PIN private.`;
    return `https://wa.me/${String(t.phone).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

// "-33.87, 25.56" (as Google Maps copies it) -> [lat, lng], or null.
function parseLatLng(text) {
    const m = String(text || '').match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    return m ? [m[1], m[2]] : null;
}

function tavernPortalPart(t) {
    const a = t.access;
    const status = !a ? 'Portal off' : (a.active ? 'Portal on' : 'Portal paused');
    const last = a ? (a.lastLoginAt ? 'last signed in ' + new Date(a.lastLoginAt).toLocaleString('en-ZA') : 'never signed in') : '';
    const extra = a ? ` · ${t.alertPhones} alert phone${t.alertPhones === 1 ? '' : 's'} · ${t.soldOut} sold out` : '';
    const id = esc(t.id);
    const buttons = !a
        ? `<button type="button" class="dispatch-btn po-btn"${t.signInOk ? '' : ' disabled title="Save a WhatsApp number first"'} onclick="tavernPortal('${id}', 'enable')">Switch on portal</button>`
        : `<button type="button" class="dispatch-btn po-btn" onclick="tavernPortal('${id}', 'reset')">Reset PIN</button>
           <button type="button" class="dispatch-btn po-btn" onclick="tavernPortal('${id}', '${a.active ? 'pause' : 'resume'}')">${a.active ? 'Pause' : 'Resume'}</button>`;
    return `
        <div class="activity-detail" style="margin-top:8px;"><strong>${status}</strong>${last ? ' · ' + esc(last) : ''}${esc(extra)}${!a && !t.signInOk ? ' · save a WhatsApp number to switch it on' : ''}</div>
        <div class="order-actions">${buttons}</div>`;
}

function tavernCard(t) {
    const id = esc(t.id);
    const hasLocation = t.latitude != null && t.longitude != null;
    const edit = isSuperAdmin();
    return `
        <div class="activity-row">
            <div class="activity-row-top">
                <span class="activity-action">${esc(t.name)} · ${esc(t.area)}</span>
                <span class="activity-time">${t.phone ? esc(t.phone) : 'no number'} · ${hasLocation ? 'location saved' : 'no location'}</span>
            </div>
            ${edit ? `
            <div class="admin-add-row">
                <input type="tel" id="tvPhone-${id}" placeholder="WhatsApp number, e.g. 072 123 4567" maxlength="20" value="${esc(t.phone || '')}">
                <button class="dispatch-btn" onclick="saveTavernPhone('${id}')">Save number</button>
            </div>
            <div class="admin-add-row">
                <input type="text" id="tvLoc-${id}" placeholder="Location, e.g. -33.8734, 25.5612" maxlength="60" value="${hasLocation ? esc(`${t.latitude}, ${t.longitude}`) : ''}">
                <button class="dispatch-btn" onclick="saveTavernLocation('${id}')">Save location</button>
                ${hasLocation ? `<button class="secondary-btn" onclick="clearTavernLocation('${id}')">Clear</button>` : ''}
            </div>` : ''}
            ${tavernPortalPart(t)}
            ${edit ? `
            <details class="activity-detail" style="margin-top:8px;">
                <summary>Receipt details: ${t.vatNumber ? 'VAT ' + esc(t.vatNumber) : 'no VAT number saved'}${t.liquorLicenceNumber ? ' · licence saved' : ''}</summary>
                <p style="font-size:12.5px;opacity:.8;margin:6px 0;">Shown on the customer's receipt when this tavern sells and packs an order. Leave the VAT number blank if the tavern is not VAT registered.</p>
                <div class="admin-add-row">
                    <input type="text" id="tavernLegal-${id}" placeholder="Legal or trading name on their receipt" maxlength="100" value="${esc(t.legalName || '')}">
                    <input type="text" id="tavernVat-${id}" placeholder="VAT number (10 digits, starts with 4)" maxlength="14" inputmode="numeric" value="${esc(t.vatNumber || '')}">
                    <input type="text" id="tavernLicence-${id}" placeholder="Liquor licence number" maxlength="40" value="${esc(t.liquorLicenceNumber || '')}">
                    <input type="text" id="tavernAddress-${id}" placeholder="Street address" maxlength="150" value="${esc(t.address || '')}">
                    <button class="dispatch-btn" onclick="saveTavernDetails('${id}')">Save details</button>
                </div>
            </details>` : ''}
        </div>`;
}

function renderTaverns() {
    const body = document.getElementById('tavernsBody');
    const pin = tavernsPinBox;
    const withLocation = tavernsList.filter((t) => t.latitude != null && t.longitude != null).length;
    const onPortal = tavernsList.filter((t) => t.access && t.access.active).length;
    body.innerHTML = `
        ${pin ? `
        <div class="po-card" style="border:2px solid #1f7a4d;border-radius:16px;padding:14px;margin-bottom:14px;">
            <b>${esc(pin.name)}'s portal sign-in</b>
            <p style="margin:6px 0;font-size:14px;">Cell <b>${esc(pin.phone)}</b> &middot; PIN <b style="font-size:20px;letter-spacing:.1em;">${esc(pin.pin)}</b></p>
            <p style="margin:0 0 10px;font-size:12.5px;opacity:.8;">This PIN is shown once. Send it now.</p>
            <a class="wa-btn" href="${esc(tavernsInviteLink(pin))}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5.1 5.2-1.4A9.9 9.9 0 1 0 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1 1 7 3.8zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>Send PIN on WhatsApp</a>
        </div>` : ''}
        <div class="activity-row">
            <div class="activity-detail"><strong>${tavernsList.length}</strong> taverns · <strong>${withLocation}</strong> with a location · <strong>${onPortal}</strong> on the portal. Orders go to the nearest tavern with a location; delivery distance is measured from it. Taverns sign in at <b>${esc(tavernsPortalUrl())}</b> with their WhatsApp number and a PIN.</div>
        </div>
        ${isSuperAdmin() ? `
        <div class="activity-row">
            <div class="activity-row-top"><span class="activity-action">Add a tavern / dark store</span></div>
            <div class="activity-detail">For the location, long-press the tavern in Google Maps and copy the two numbers at the top (like -33.8734, 25.5612).</div>
            <div class="admin-add-row">
                <input type="text" id="newTavernName" placeholder="Name, e.g. Siba's Tavern" maxlength="80">
                <input type="text" id="newTavernArea" placeholder="Area, e.g. Motherwell NU10" maxlength="60">
                <input type="tel" id="newTavernPhone" placeholder="WhatsApp number" maxlength="20">
                <input type="text" id="newTavernLocation" placeholder="Location, e.g. -33.8734, 25.5612" maxlength="60">
                <button class="dispatch-btn" onclick="addTavern()">Add</button>
            </div>
        </div>` : ''}
        ${tavernsList.length ? tavernsList.map(tavernCard).join('') : '<div class="no-orders">No taverns yet.</div>'}`;
}

async function loadTaverns() {
    const body = document.getElementById('tavernsBody');
    if (!tavernsList.length) body.innerHTML = '<div class="no-orders">Loading taverns…</div>';
    try {
        const [settingsRes, accessRes] = await Promise.all([adminFetch('/admin/delivery-settings'), adminFetch('/admin/tavern-access')]);
        if (!settingsRes.ok || !accessRes.ok) throw new Error('Could not load the taverns');
        const settings = await settingsRes.json();
        const access = new Map((await accessRes.json()).map((a) => [a.id, a]));
        tavernsList = settings.taverns.map((t) => {
            const a = access.get(t.id) || {};
            return { ...t, access: a.access || null, signInOk: !!a.signInOk, soldOut: a.soldOut || 0, alertPhones: a.alertPhones || 0 };
        });
        renderTaverns();
    } catch (err) {
        console.error(err);
        body.innerHTML = `<div class="no-orders">${esc(err.message || 'Could not load the taverns')}</div>`;
    }
}

// One helper for every save: send, show the server's error, reload.
async function tavernSend(url, method, payload) {
    try {
        const res = await adminFetch(url, { method, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save');
        return data;
    } catch (err) {
        alert(err.message);
        return null;
    }
}

async function addTavern() {
    const val = (k) => document.getElementById(k).value;
    const ok = await tavernSend('/admin/taverns', 'POST', { name: val('newTavernName'), area: val('newTavernArea'), phone: val('newTavernPhone'), location: val('newTavernLocation') });
    if (ok) loadTaverns();
}

async function saveTavernPhone(id) {
    const phone = document.getElementById(`tvPhone-${id}`).value.trim();
    const t = tavernsList.find((x) => x.id === id);
    const digits = (v) => String(v || '').replace(/\D/g, '').replace(/^0/, '27');
    if (t && t.access && t.phone && digits(phone) !== digits(t.phone) && !confirm(`${t.name} signs in to the portal with this number. Change it? They will be signed out and must sign in with the new number (same PIN).`)) return;
    if (await tavernSend(`/admin/taverns/${encodeURIComponent(id)}/phone`, 'PATCH', { phone })) loadTaverns();
}

async function saveTavernLocation(id) {
    const pair = parseLatLng(document.getElementById(`tvLoc-${id}`).value);
    if (!pair) { alert('Paste the location as two numbers, like -33.8734, 25.5612 (long-press the spot in Google Maps)'); return; }
    if (await tavernSend(`/admin/taverns/${encodeURIComponent(id)}/location`, 'PATCH', { latitude: pair[0], longitude: pair[1] })) loadTaverns();
}

async function clearTavernLocation(id) {
    if (await tavernSend(`/admin/taverns/${encodeURIComponent(id)}/location`, 'PATCH', { latitude: null, longitude: null })) loadTaverns();
}

async function saveTavernDetails(id) {
    const val = (k) => document.getElementById(`${k}-${id}`).value;
    const ok = await tavernSend(`/admin/taverns/${encodeURIComponent(id)}/details`, 'PATCH', { legalName: val('tavernLegal'), vatNumber: val('tavernVat'), liquorLicenceNumber: val('tavernLicence'), address: val('tavernAddress') });
    if (ok) loadTaverns();
}

async function tavernPortal(id, action) {
    const t = tavernsList.find((x) => x.id === id);
    if (!t) return;
    if (action === 'reset' && !confirm(`Make a new PIN for ${t.name}? Their old PIN stops working and they are signed out.`)) return;
    if (action === 'pause' && !confirm(`Pause the portal for ${t.name}? They are signed out straight away.`)) return;
    const data = await tavernSend(`/admin/tavern-access/${encodeURIComponent(id)}`, 'POST', { action });
    if (!data) return;
    tavernsPinBox = data.pin ? { name: t.name, phone: t.phone, pin: data.pin } : null;
    loadTaverns();
}

Object.assign(window, { addTavern, saveTavernPhone, saveTavernLocation, clearTavernLocation, saveTavernDetails, tavernPortal });

const baseShowSectionForTaverns = window.showSection;
window.showSection = function (name, tabEl) {
    baseShowSectionForTaverns(name, tabEl);
    const section = document.getElementById('tavernsSection');
    if (section) section.style.display = name === 'taverns' ? 'block' : 'none';
    if (name === 'taverns') { tavernsPinBox = null; loadTaverns(); }
};
