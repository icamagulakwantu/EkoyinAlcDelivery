// ============================================
// ADMIN: DELIVERY TAB
// ============================================
// Loaded after driver-reports.js. Lets admins turn surge pricing on or off
// and explains the delivery fee. Taverns (adding them, their locations,
// numbers, portal and receipt details) live in the Taverns tab (taverns.js,
// founder 23 Nov 2026). Wraps showSection the same way driver-reports.js does.

function renderDeliverySettings(data) {
    const withLocation = data.taverns.filter((t) => t.latitude != null && t.longitude != null).length;
    document.getElementById('deliverySettingsBody').innerHTML = `
        <div class="activity-row">
            <div class="activity-row-top">
                <span class="activity-action">Surge pricing: ${data.surgesEnabled ? 'ON' : 'OFF'}</span>
            </div>
            <div class="activity-detail">Peak (4 PM to 10 PM) adds R20. Late night (10 PM to 4 AM) adds R30. Both go 100% to the driver. South African time.</div>
            <div class="activity-detail">Delivery fee: R40 for the first 3 km, then R6 a km to the nearest dark store. Heavy orders add R1.50 a kg above 20 kg (a crate of 12 quarts is about 15 kg). All of it goes to the driver.</div>
            <div class="order-actions">
                <button class="btn ${data.surgesEnabled ? 'btn-deliver' : 'btn-assign'}" onclick="setSurgesEnabled(${!data.surgesEnabled})">${data.surgesEnabled ? 'Turn surges off' : 'Turn surges on'}</button>
            </div>
        </div>
        <div class="activity-row">
            <div class="activity-detail"><strong>${withLocation} of ${data.taverns.length}</strong> taverns have a saved location. Distance is measured to the nearest tavern with a location. Add taverns, their locations and WhatsApp numbers in the <a href="#" onclick="showSection('taverns', document.getElementById('sectionTabTaverns')); return false;">Taverns tab</a>.</div>
        </div>`;
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

const baseShowSectionForDelivery = window.showSection;
window.showSection = function (name, tabEl) {
    baseShowSectionForDelivery(name, tabEl);
    document.getElementById('deliverySection').style.display = name === 'delivery' ? 'block' : 'none';
    if (name === 'delivery') loadDeliverySettings();
};

