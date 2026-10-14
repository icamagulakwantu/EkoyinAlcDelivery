// ============================================
// ADMIN: DRIVER REPORTS TAB
// ============================================
// Loaded after admin-api.js. Adds a "Driver reports" section by wrapping
// showSection (defined in admin-api.js) so the existing tabs keep working.

const REPORT_CATEGORY_LABELS = {
    RUDE: 'Rude behaviour',
    UNSAFE: 'Unsafe driving / felt unsafe',
    LATE: 'Very late',
    TAMPERED: 'Order tampered with',
    OTHER: 'Something else',
};

let driverReportsLoaded = false;

function renderDriverReport(r) {
    const id = esc(r.id);
    const next = r.status === 'OPEN'
        ? `<button class="btn btn-assign" onclick="setDriverReportStatus('${id}', 'REVIEWED')">Mark reviewed</button>`
        : '';
    const resolve = r.status !== 'RESOLVED'
        ? `<button class="btn btn-deliver" onclick="setDriverReportStatus('${id}', 'RESOLVED')">Resolve</button>`
        : '';
    return `
        <div class="activity-row">
            <div class="activity-row-top">
                <span class="activity-action">${esc(REPORT_CATEGORY_LABELS[r.category] || r.category)} · ${esc(r.status)}</span>
                <span class="activity-time">${esc(new Date(r.createdAt).toLocaleString())}</span>
            </div>
            <div class="activity-detail"><strong>Driver:</strong> ${esc(r.driverName || 'N/A')}${r.driverPhone ? ` (${esc(r.driverPhone)})` : ''} · <strong>Order:</strong> ${esc(r.orderCode)}</div>
            <div class="activity-detail">${esc(r.message)}</div>
            <div class="activity-admin">Reported by ${esc(r.customerName || 'customer')}${r.customerPhone ? ` · ${esc(r.customerPhone)}` : ''}</div>
            <div class="order-actions">${next}${resolve}</div>
        </div>`;
}

async function loadDriverReports() {
    const list = document.getElementById('driverReportsList');
    list.innerHTML = '<div class="no-orders">Loading…</div>';
    try {
        const res = await adminFetch('/admin/driver-reports');
        if (!res.ok) throw new Error('Failed to load driver reports');
        const reports = await res.json();
        list.innerHTML = reports.length
            ? reports.map(renderDriverReport).join('')
            : '<div class="no-orders">No driver reports yet</div>';
    } catch (err) {
        console.error(err);
        list.innerHTML = '<div class="no-orders">Failed to load driver reports</div>';
    }
}

async function setDriverReportStatus(id, status) {
    try {
        const res = await adminFetch(`/admin/driver-reports/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error('Failed to update report');
        loadDriverReports();
    } catch (err) {
        console.error(err);
        alert('Failed to update report');
    }
}
window.setDriverReportStatus = setDriverReportStatus;

const baseShowSection = window.showSection;
window.showSection = function (name, tabEl) {
    baseShowSection(name, tabEl);
    document.getElementById('driverReportsSection').style.display = name === 'reports' ? 'block' : 'none';
    if (name === 'reports' && !driverReportsLoaded) {
        driverReportsLoaded = true;
        loadDriverReports();
    } else if (name === 'reports') {
        loadDriverReports();
    }
};
