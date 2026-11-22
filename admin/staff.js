// ============================================
// ADMIN: STAFF FILES TAB (founder approved 22 Nov 2026, super-admin only)
// ============================================
// A proper file for every driver and dispatcher: SA ID, home address, licence, vehicle, number plate and
// bank details. Numbers are stored encrypted; this page only shows the last 4 digits until "Show full details".

let staffPeople = [];
let staffKeyReady = true;
let staffOpen = null; // { person, profile, status, options }
let staffRevealTimer = null;

const staffChipClass = (code) => (code === 'VERIFIED' ? 'ok' : code === 'UNVERIFIED' ? 'warn' : 'bad');

function staffRow(p) {
    const flags = (p.status.flags || []).map((f) => `<span class="sf-flag">${escapeHtml(f)}</span>`).join('');
    return `
        <div class="po-row">
            <div class="po-who"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.kind === 'DRIVER' ? 'Driver' : 'Dispatcher')} · ${escapeHtml(p.sub)}</span>
                <small><span class="sf-chip ${staffChipClass(p.status.code)}">${escapeHtml(p.status.label)}</span>${flags}</small></div>
            <div class="po-act"><button type="button" class="dispatch-btn po-btn" onclick="openStaffFile('${escapeHtml(p.kind)}','${escapeHtml(encodeURIComponent(p.ref))}')">${p.status.code === 'MISSING' ? 'Start file' : 'Open file'}</button></div>
        </div>`;
}

function renderStaffList() {
    const body = document.getElementById('staffBody');
    body.innerHTML = `<div class="sf-wrap">
        ${staffKeyReady ? '' : '<div class="sf-error"><b>Staff data key not set.</b> Files cannot be saved until the key is added on Render.</div>'}
        <p style="font-size:13px;opacity:.8;margin:0 0 10px;">Every driver and dispatcher needs a complete, verified file: valid South African ID, home address, and for drivers a valid licence, vehicle and number plate, and bank details. ID, licence and account numbers are stored encrypted, only you can see them, and every time you show them it is logged.</p>
        ${staffPeople.length ? staffPeople.map(staffRow).join('') : '<div class="no-orders">No drivers or dispatchers yet.</div>'}
    </div>`;
}

async function loadStaff() {
    const body = document.getElementById('staffBody');
    body.innerHTML = '<div class="no-orders">Loading staff files…</div>';
    try {
        const res = await adminFetch('/admin/staff');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed');
        staffPeople = data.people;
        staffKeyReady = data.keyReady;
        staffOpen = null;
        renderStaffList();
    } catch (err) {
        body.innerHTML = `<div class="no-orders">Could not load staff files: ${escapeHtml(err.message)}</div>`;
    }
}

function sfField(id, label, value, extra = '') {
    return `<div><label for="sf_${id}">${escapeHtml(label)}</label><input id="sf_${id}" value="${escapeHtml(value ?? '')}" ${extra}></div>`;
}
function sfSelect(id, label, value, options) {
    return `<div><label for="sf_${id}">${escapeHtml(label)}</label><select id="sf_${id}"><option value="">Choose…</option>${options.map((o) => `<option value="${escapeHtml(o)}"${o === value ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select></div>`;
}

function renderStaffForm(error) {
    const { person, profile, status, options } = staffOpen;
    const p = profile || {};
    const isDriver = person.kind === 'DRIVER';
    const keep = (masked) => (masked ? `placeholder="Saved ${masked}. Leave blank to keep"` : '');
    const v = {
        fullName: p.fullName ?? (isDriver ? person.name : ''),
        phone: p.phone ?? person.phone,
        email: p.email ?? person.email,
    };
    const body = document.getElementById('staffBody');
    body.innerHTML = `<div class="sf-wrap sf-form">
        <button type="button" class="po-undo" onclick="loadStaff()">← All staff</button>
        <h3 style="margin-top:10px;">${escapeHtml(isDriver ? person.name : person.email)} <span class="sf-chip ${staffChipClass(status.code)}">${escapeHtml(status.label)}</span></h3>
        ${(status.flags || []).map((f) => `<span class="sf-flag">${escapeHtml(f)}</span>`).join('')}
        ${staffKeyReady ? '' : '<div class="sf-error"><b>Staff data key not set.</b> This file cannot be saved yet.</div>'}
        ${error ? `<div class="sf-error">${escapeHtml(error)}</div>` : ''}
        <h3>Personal</h3>
        <div class="sf-grid">
            ${sfField('fullName', 'Full name and surname (as on ID)', v.fullName, 'maxlength="80"')}
            ${sfField('idNumber', 'South African ID number', '', `maxlength="17" inputmode="numeric" autocomplete="off" ${keep(p.idNumberMasked)}`)}
            ${sfField('phone', 'Cell number', v.phone, 'inputmode="tel"')}
            ${sfField('email', 'Email', v.email, 'type="email" maxlength="120"')}
        </div>
        <h3>Home address</h3>
        <div class="sf-grid">
            ${sfField('addressLine', 'Street address', p.addressLine, 'maxlength="120"')}
            ${sfField('suburb', 'Suburb or township', p.suburb, 'maxlength="60"')}
            ${sfField('city', 'Town or city', p.city, 'maxlength="60"')}
            ${sfField('postalCode', 'Postal code', p.postalCode, 'inputmode="numeric" maxlength="4"')}
        </div>
        ${isDriver ? `
        <h3>Driver's licence</h3>
        <div class="sf-grid">
            ${sfField('licenceNumber', "Licence number", '', `maxlength="24" autocomplete="off" ${keep(p.licenceNumberMasked)}`)}
            ${sfSelect('licenceCode', 'Licence code', p.licenceCode, options.licenceCodes)}
            ${sfField('licenceExpiry', 'Licence expiry date', p.licenceExpiry, 'type="date"')}
        </div>
        <h3>Vehicle</h3>
        <div class="sf-grid">
            ${sfField('vehicleMake', 'Make', p.vehicleMake, 'maxlength="40"')}
            ${sfField('vehicleModel', 'Model', p.vehicleModel, 'maxlength="40"')}
            ${sfField('vehicleColour', 'Colour', p.vehicleColour, 'maxlength="30"')}
            ${sfField('vehicleYear', 'Year', p.vehicleYear, 'inputmode="numeric" maxlength="4"')}
            ${sfField('numberPlate', 'Number plate', p.numberPlate, 'maxlength="14" style="text-transform:uppercase"')}
            ${sfField('vehicleRegNumber', 'Registration certificate number', p.vehicleRegNumber, 'maxlength="30"')}
            ${sfField('vehicleDiscExpiry', 'Vehicle licence disc expiry', p.vehicleDiscExpiry, 'type="date"')}
        </div>` : ''}
        <h3>Bank details ${isDriver ? '(for daily payouts)' : '(optional)'}</h3>
        <div class="sf-grid">
            ${sfSelect('bankName', 'Bank', p.bankName, options.banks)}
            ${sfField('accountHolder', 'Account holder name', p.accountHolder, 'maxlength="80"')}
            ${sfField('accountNumber', 'Account number', '', `inputmode="numeric" maxlength="20" autocomplete="off" ${keep(p.accountNumberMasked)}`)}
            ${sfField('branchCode', 'Branch code (6 digits)', p.branchCode, 'inputmode="numeric" maxlength="6"')}
            ${sfSelect('accountType', 'Account type', p.accountType, options.accountTypes)}
        </div>
        <div class="sf-actions">
            <button type="button" class="dispatch-btn" onclick="saveStaffFile()">Save file</button>
            ${profile ? `<button type="button" class="dispatch-btn" onclick="toggleStaffVerified(${profile.verified ? 'false' : 'true'})">${profile.verified ? 'Remove verified tick' : 'I checked the documents: mark verified'}</button>
            <button type="button" class="dispatch-btn" onclick="revealStaffDetails()">Show full details</button>` : ''}
        </div>
        <p style="font-size:12.5px;opacity:.75;">Saving any change removes the verified tick until you check the documents again.${profile && profile.verifiedBy ? ` Last verified by ${escapeHtml(profile.verifiedBy)}.` : ''}</p>
        <div id="sfReveal"></div>
    </div>`;
}

async function openStaffFile(kind, refEncoded) {
    const body = document.getElementById('staffBody');
    body.innerHTML = '<div class="no-orders">Loading…</div>';
    const res = await adminFetch(`/admin/staff/${kind.toLowerCase()}/${refEncoded}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { body.innerHTML = `<div class="no-orders">${escapeHtml(data.error || 'Could not open the file')}</div>`; return; }
    staffKeyReady = data.keyReady;
    staffOpen = data;
    renderStaffForm();
}

const STAFF_FIELDS = ['fullName', 'idNumber', 'phone', 'email', 'addressLine', 'suburb', 'city', 'postalCode', 'licenceNumber', 'licenceCode', 'licenceExpiry',
    'vehicleMake', 'vehicleModel', 'vehicleColour', 'vehicleYear', 'numberPlate', 'vehicleRegNumber', 'vehicleDiscExpiry',
    'bankName', 'accountHolder', 'accountNumber', 'branchCode', 'accountType'];

function staffUrl(suffix = '') {
    const { person } = staffOpen;
    return `/admin/staff/${person.kind.toLowerCase()}/${encodeURIComponent(person.ref)}${suffix}`;
}

async function saveStaffFile() {
    const payload = {};
    for (const f of STAFF_FIELDS) { const el = document.getElementById('sf_' + f); if (el) payload[f] = el.value; }
    const res = await adminFetch(staffUrl(), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { renderStaffForm(data.error || 'Could not save the file'); window.scrollTo(0, 0); return; }
    staffOpen.profile = data.profile;
    staffOpen.status = data.status;
    renderStaffForm();
    alert('Saved. Mark it verified once you have checked the original documents.');
}

async function toggleStaffVerified(verified) {
    if (verified && !confirm('Confirm you have seen the original ID, driver\'s licence and vehicle papers and they match this file.')) return;
    const res = await adminFetch(staffUrl('/verify'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verified }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { renderStaffForm(data.error || 'Could not update'); return; }
    staffOpen.profile = data.profile;
    staffOpen.status = data.status;
    renderStaffForm();
}

async function revealStaffDetails() {
    if (!confirm('Show the full ID, licence and account numbers? This is written to the activity log.')) return;
    const res = await adminFetch(staffUrl('/reveal'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json().catch(() => ({}));
    const box = document.getElementById('sfReveal');
    if (!res.ok) { box.innerHTML = `<div class="sf-error">${escapeHtml(data.error || 'Could not show the details')}</div>`; return; }
    box.innerHTML = `<div class="sf-reveal"><b>ID number:</b> ${escapeHtml(data.idNumber)}<br>
        ${data.licenceNumber ? `<b>Licence number:</b> ${escapeHtml(data.licenceNumber)}<br>` : ''}
        ${data.accountNumber ? `<b>Account number:</b> ${escapeHtml(data.accountNumber)}<br>` : ''}
        <small>Hidden again in 30 seconds.</small></div>`;
    clearTimeout(staffRevealTimer);
    staffRevealTimer = setTimeout(() => { const b = document.getElementById('sfReveal'); if (b) b.innerHTML = ''; }, 30000);
}

Object.assign(window, { loadStaff, openStaffFile, saveStaffFile, toggleStaffVerified, revealStaffDetails });

const baseShowSectionForStaff = window.showSection;
window.showSection = function (name, tabEl) {
    baseShowSectionForStaff(name, tabEl);
    const section = document.getElementById('staffSection');
    if (section) section.style.display = name === 'staff' ? 'block' : 'none';
    if (name === 'staff') loadStaff();
};
