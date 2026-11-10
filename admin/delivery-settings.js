// ============================================
// ADMIN: DELIVERY TAB
// ============================================
// Loaded after driver-reports.js. Lets admins turn surge pricing on or off
// and save each tavern's coordinates (used to measure delivery distance).
// Wraps showSection the same way driver-reports.js does.

let deliveryTaverns = [];

function renderTavernLocationRow(t) {
    const id = esc(t.id);
    const hasLocation = t.latitude != null && t.longitude != null;
    return `
        <div class="activity-row">
            <div class="activity-row-top">
                <span class="activity-action">${esc(t.name)} · ${esc(t.area)}</span>
                <span class="activity-time">${hasLocation ? 'Location saved' : 'No location yet'}</span>
            </div>
            <div class="admin-add-row">
                <input type="text" id="tavernLat-${id}" placeholder="Latitude, e.g. -26.2041" value="${hasLocation ? esc(t.latitude) : ''}">
                <input type="text" id="tavernLng-${id}" placeholder="Longitude, e.g. 28.0473" value="${hasLocation ? esc(t.longitude) : ''}">
                <button class="dispatch-btn" onclick="saveTavernLocation('${id}')">Save</button>
                ${hasLocation ? `<button class="secondary-btn" onclick="clearTavernLocation('${id}')">Clear</button>` : ''}
            </div>
        </div>`;
}

function renderDeliverySettings(data) {
    deliveryTaverns = data.taverns;
    const withLocation = data.taverns.filter((t) => t.latitude != null && t.longitude != null).length;
    document.getElementById('deliverySettingsBody').innerHTML = `
        <div class="activity-row">
            <div class="activity-row-top">
                <span class="activity-action">Surge pricing: ${data.surgesEnabled ? 'ON' : 'OFF'}</span>
            </div>
            <div class="activity-detail">Peak (4 PM to 10 PM) adds R20. Late night (10 PM to 4 AM) adds R30. Both go 100% to the driver. South African time.</div>
            <div class="activity-detail">Delivery fee: R35 for the first 3 km, then R6 a km to the nearest dark store. Heavy orders add R1.50 a kg above 20 kg (a crate of 12 quarts is about 15 kg). All of it goes to the driver.</div>
            <div class="order-actions">
                <button class="btn ${data.surgesEnabled ? 'btn-deliver' : 'btn-assign'}" onclick="setSurgesEnabled(${!data.surgesEnabled})">${data.surgesEnabled ? 'Turn surges off' : 'Turn surges on'}</button>
            </div>
        </div>
        <div class="activity-row">
            <div class="activity-detail"><strong>${withLocation} of ${data.taverns.length}</strong> taverns have a saved location. Customers are asked to pin their location at checkout as soon as at least one tavern has one. Distance is measured to the nearest tavern with a location. Find coordinates by long-pressing the tavern on Google Maps.</div>
        </div>
        <div class="activity-row">
            <div class="activity-row-top"><span class="activity-action">Add a tavern / dark store</span></div>
            <div class="activity-detail">Long-press the tavern in Google Maps, copy the two numbers at the top (like -33.8734, 25.5612) and paste them below.</div>
            <div class="admin-add-row">
                <input type="text" id="newTavernName" placeholder="Name, e.g. Siba's Tavern" maxlength="80">
                <input type="text" id="newTavernArea" placeholder="Area, e.g. Motherwell NU10" maxlength="60">
                <input type="tel" id="newTavernPhone" placeholder="Phone (optional)" maxlength="20">
                <input type="text" id="newTavernLocation" placeholder="Location, e.g. -33.8734, 25.5612" maxlength="60">
                <button class="dispatch-btn" onclick="addTavern()">Add</button>
            </div>
        </div>
        ${data.taverns.map(renderTavernLocationRow).join('')}`;
}

async function loadDeliverySettings() {
    const body = document.getElementById('deliverySettingsBody');
    body.innerHTML = '<div class="no-orders">Loading…</div>';
    try {
        const res = await adminFetch('/admin/delivery-settings');
        if (!res.ok) throw new Error('Failed to load delivery settings');
        renderDeliverySettings(await res.json());
    } catch (err) {
        console.error(err);
        body.innerHTML = '<div class="no-orders">Failed to load delivery settings</div>';
    }
}

async function setSurgesEnabled(enabled) {
    try {
        const res = await adminFetch('/admin/delivery-settings', {
            method: 'PATCH',
            body: JSON.stringify({ surgesEnabled: enabled }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to save');
        }
        loadDeliverySettings();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}
window.setSurgesEnabled = setSurgesEnabled;

async function sendTavernLocation(id, latitude, longitude) {
    try {
        const res = await adminFetch(`/admin/taverns/${encodeURIComponent(id)}/location`, {
            method: 'PATCH',
            body: JSON.stringify({ latitude, longitude }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to save location');
        }
        loadDeliverySettings();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

function saveTavernLocation(id) {
    const lat = document.getElementById(`tavernLat-${id}`).value.trim();
    const lng = document.getElementById(`tavernLng-${id}`).value.trim();
    if (!lat || !lng) {
        alert('Enter both a latitude and a longitude');
        return;
    }
    sendTavernLocation(id, lat, lng);
}
window.saveTavernLocation = saveTavernLocation;

async function addTavern() {
    const body = {
        name: document.getElementById('newTavernName').value,
        area: document.getElementById('newTavernArea').value,
        phone: document.getElementById('newTavernPhone').value,
        location: document.getElementById('newTavernLocation').value,
    };
    try {
        const res = await adminFetch('/admin/taverns', { method: 'POST', body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to add the tavern');
        loadDeliverySettings();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}
window.addTavern = addTavern;

function clearTavernLocation(id) {
    sendTavernLocation(id, null, null);
}
window.clearTavernLocation = clearTavernLocation;

const baseShowSectionForDelivery = window.showSection;
window.showSection = function (name, tabEl) {
    baseShowSectionForDelivery(name, tabEl);
    document.getElementById('deliverySection').style.display = name === 'delivery' ? 'block' : 'none';
    if (name === 'delivery') loadDeliverySettings();
};
