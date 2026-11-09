// ============================================
// ADMIN: REPORTS TAB
// ============================================
// Sales, best sellers, busiest times, top areas and payment mix, plus CSV
// downloads (super admins only; every download is written to the activity
// log). Wraps showSection like driver-reports.js and delivery-settings.js.

let reportsDays = 30;

function reportBars(list, valueKey, fmt) {
    if (!list || !list.length) return '<div class="no-orders" style="padding:12px">No data yet</div>';
    const max = Math.max(...list.map((r) => Number(r[valueKey]) || 0), 1);
    return list.map((r) => `
        <div class="rep-bar-row">
            <span class="rep-bar-name">${esc(r.name)}</span>
            <span class="rep-bar-track"><span class="rep-bar-fill" style="width:${Math.round(((Number(r[valueKey]) || 0) / max) * 100)}%"></span></span>
            <span class="rep-bar-val">${esc(fmt(r))}</span>
        </div>`).join('');
}

async function loadReports() {
    const body = document.getElementById('reportsBody');
    body.innerHTML = '<div class="no-orders">Building report…</div>';
    try {
        const res = await adminFetch(`/admin/reports?days=${reportsDays}`);
        if (!res.ok) throw new Error('Failed');
        const r = await res.json();
        const isSuper = currentAdminRole === 'SUPER_ADMIN';
        body.innerHTML = `
            <div class="rep-range">
                ${[7, 30, 90, 365].map((d) => `<button type="button" class="rep-range-btn${d === reportsDays ? ' active' : ''}" onclick="setReportDays(${d})">${d === 365 ? '12 months' : `${d} days`}</button>`).join('')}
            </div>
            <div class="rep-tiles">
                <div class="rep-tile"><b>${formatRand(r.revenue)}</b><span>Sales</span></div>
                <div class="rep-tile"><b>${r.orders}</b><span>Orders</span></div>
                <div class="rep-tile"><b>${formatRand(r.averageOrder)}</b><span>Average order</span></div>
                <div class="rep-tile"><b>${r.repeatRate}%</b><span>Repeat customers (${r.repeatCustomers}/${r.customers})</span></div>
                <div class="rep-tile"><b>${r.marketingOptIns}</b><span>Opted in to specials</span></div>
                <div class="rep-tile"><b>${r.cancelled}</b><span>Cancelled · ${r.awaitingPayment} awaiting EFT</span></div>
            </div>
            <div class="rep-grid">
                <section class="rep-card"><h3>Best sellers (by sales)</h3>${reportBars(r.topProducts, 'revenue', (x) => `${formatRand(x.revenue)} · ${x.count} sold`)}</section>
                <section class="rep-card"><h3>Top areas</h3>${reportBars(r.topAreas, 'count', (x) => `${x.count} orders · ${formatRand(x.revenue)}`)}</section>
                <section class="rep-card"><h3>Orders by day</h3>${reportBars(r.byDay, 'count', (x) => `${x.count}`)}</section>
                <section class="rep-card"><h3>Busiest hours (SA time)</h3>${reportBars(r.busiestHours, 'count', (x) => `${x.count} orders`)}</section>
                <section class="rep-card"><h3>Payment methods</h3>${reportBars(r.payments.map((p) => ({ ...p, name: { card: 'Card', eft: 'EFT', cod: 'Cash on delivery' }[p.name] || p.name })), 'count', (x) => `${x.count}`)}</section>
            </div>
            <section class="rep-card rep-exports">
                <h3>Downloads</h3>
                ${isSuper ? `
                    <p>Opens in Excel or Google Sheets. Every download is recorded in the Activity log.</p>
                    <button type="button" class="dispatch-btn" onclick="downloadExport('/admin/export/marketing.csv')">Marketing list (opted-in customers only)</button>
                    <button type="button" class="secondary-btn" onclick="downloadExport('/admin/export/orders.csv?days=${reportsDays}')">Orders, last ${reportsDays === 365 ? '12 months' : `${reportsDays} days`}</button>
                    <p class="rep-note">POPIA: only message people on the marketing list, and only about Ekoyini. Never share or sell the list. Each row has an unsubscribe link to include in your messages.</p>`
                    : '<p>Downloads are for super admins only.</p>'}
            </section>`;
    } catch (err) {
        console.error(err);
        body.innerHTML = '<div class="no-orders">Failed to load the report</div>';
    }
}

function setReportDays(d) { reportsDays = d; loadReports(); }
window.setReportDays = setReportDays;

async function downloadExport(url) {
    try {
        const res = await adminFetch(url);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Download failed');
            return;
        }
        const blob = await res.blob();
        const name = (res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'ekoyini-export.csv';
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
        console.error(err);
        alert('Download failed');
    }
}
window.downloadExport = downloadExport;

const baseShowSectionForReports = window.showSection;
window.showSection = function (name, tabEl) {
    baseShowSectionForReports(name, tabEl);
    const section = document.getElementById('reportsSection');
    if (section) section.style.display = name === 'sales' ? 'block' : 'none';
    if (name === 'sales') loadReports();
};
