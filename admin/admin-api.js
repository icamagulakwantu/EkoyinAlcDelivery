// ============================================
// EKOYINI ADMIN DISPATCH DASHBOARD — real API version
// ============================================
//
// The old admin.js (kept for reference) stored orders in localStorage.
// This version calls the real backend (server.js) with the logged-in
// admin's Supabase session token, so the dashboard reflects real DB state,
// works across devices/browsers, and ties every admin action to a real
// person instead of a shared PIN.
// ============================================

// ============================================
// 🔐 ADMIN LOGIN — real Supabase Auth (per-person, server-verified)
// ============================================
// Login itself uses the same Supabase project as customer accounts
// (ekoyiniAuth from /auth.js). What makes an account an *admin* account is
// the server: server.js checks the logged-in user's email against the
// ADMIN_EMAILS allowlist on every /orders, /admin/* etc. request — a
// non-admin account can log in here but every API call will 401.

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('adminLoginError');
    errEl.style.display = 'none';
    const btn = document.getElementById('adminLoginBtn');
    btn.disabled = true;
    btn.textContent = 'Logging in…';
    try {
        await signIn(document.getElementById('adminEmail').value.trim(), document.getElementById('adminPassword').value);
        await tryEnterDashboard();
    } catch (err) {
        errEl.textContent = err.message || 'Login failed. Check your email and password.';
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Log In';
    }
});

// After a successful Supabase login, confirm the account is actually on
// the ADMIN_EMAILS allowlist by hitting a real admin route — a customer
// account can authenticate with Supabase but isn't an admin.
async function tryEnterDashboard() {
    const errEl = document.getElementById('adminLoginError');
    const res = await adminFetch('/orders');
    if (res.status === 401) {
        errEl.textContent = 'Logged in, but this account is not on the admin list. Ask an existing admin to add your email to ADMIN_EMAILS.';
        errEl.style.display = 'block';
        await signOut();
        return;
    }
    grantAccess();
    loadOrders();
    setInterval(loadOrders, 30000);
}

function grantAccess() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.style.display = 'none';
    document.body.classList.remove('admin-locked');
    document.body.classList.add('admin-unlocked');
}

async function logout() {
    await signOut();
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.style.display = 'flex';
    document.body.classList.add('admin-locked');
    document.body.classList.remove('admin-unlocked');
    document.getElementById('adminEmail').value = '';
    document.getElementById('adminPassword').value = '';
}

// ============================================
// CHECK AUTH ON PAGE LOAD — resume an existing Supabase session
// ============================================
document.body.classList.add('admin-locked');
(async function() {
    const session = await getSession();
    if (session) await tryEnterDashboard();
})();

async function adminFetch(url, options = {}) {
    return authedFetch(url, { ...options, headers: { ...(options.headers || {}), 'Content-Type': 'application/json' } });
}

// ============================================
// LOAD & DISPLAY ORDERS (real backend)
// ============================================
let allOrders = [];
let currentFilter = 'all';
let currentAssignOrderCode = null;

async function loadOrders() {
    const container = document.getElementById('ordersList');
    try {
        const res = await adminFetch('/orders');
        if (!res.ok) throw new Error('Failed to load orders');
        allOrders = await res.json();
    } catch (err) {
        console.error(err);
        if (container) container.innerHTML = '<div class="no-orders">❌ Failed to load orders</div>';
        return;
    }

    updateStats(allOrders);

    let filteredOrders = allOrders;
    if (currentFilter !== 'all') {
        filteredOrders = allOrders.filter(o => o.status === currentFilter);
    }

    if (filteredOrders.length === 0) {
        container.innerHTML = '<div class="no-orders">📭 No orders found</div>';
        return;
    }

    container.innerHTML = filteredOrders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <span class="order-code">${order.code}</span>
                <span class="order-status status-${order.status}">${formatStatus(order.status)}</span>
            </div>
            <div class="order-details">
                <p>📍 <strong>Delivery:</strong> ${order.address}</p>
                <p>👤 <strong>Customer:</strong> ${order.customerName || 'N/A'} · ${order.customerPhone || 'N/A'}</p>
                <p>🕐 <strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <div class="order-items">
                ${order.items.map(item => `
                    <div class="item-row">
                        <span>${item.name} x${item.quantity}</span>
                        <span>R${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `).join('')}
                <div class="total-row">
                    <span>Total</span>
                    <span>R${order.total.toFixed(2)}</span>
                </div>
            </div>
            ${order.tavern ? `
                <div class="assigned-info">
                    <p>🏪 <strong>Tavern:</strong> ${order.tavern.name} (${order.tavern.area})</p>
                    <p>🛵 <strong>Driver:</strong> ${order.driverName || 'N/A'}</p>
                    ${order.driverPhone ? `<p>📱 <strong>Driver WhatsApp:</strong> ${order.driverPhone}</p>` : ''}
                </div>
            ` : ''}
            <div class="order-actions">
                ${getActionButtons(order)}
            </div>
        </div>
    `).join('');
}

function getActionButtons(order) {
    let buttons = '';
    if (order.status === 'PAYMENT_PENDING' || order.status === 'PENDING') {
        buttons += `<button class="btn btn-assign" onclick="openAssignModal('${order.code}')">🏪 Assign</button>`;
    }
    if (order.status === 'PENDING' && order.tavern) {
        buttons += `<button class="btn btn-dispatch" onclick="sendDispatchWhatsApp('${order.code}')">📲 Send WhatsApp & Dispatch</button>`;
    }
    if (order.status === 'DISPATCHED') {
        buttons += `<button class="btn btn-deliver" onclick="markDelivered('${order.code}')">✅ Deliver</button>`;
    }
    buttons += `<button class="btn btn-delete" onclick="deleteOrder('${order.code}')">🗑</button>`;
    return buttons;
}

function formatStatus(status) {
    const map = {
        PAYMENT_PENDING: '💰 Payment Pending',
        PENDING: '📦 Ready',
        DISPATCHED: '🛵 Dispatched',
        DELIVERED: '✅ Delivered',
    };
    return map[status] || status;
}

function updateStats(orders) {
    document.getElementById('pendingCount').innerText = orders.filter(o => o.status === 'PAYMENT_PENDING' || o.status === 'PENDING').length;
    document.getElementById('dispatchedCount').innerText = orders.filter(o => o.status === 'DISPATCHED').length;
    document.getElementById('deliveredCount').innerText = orders.filter(o => o.status === 'DELIVERED').length;
}

// ============================================
// FILTER
// ============================================
function filterOrders(filter, tabEl) {
    currentFilter = filter;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    loadOrders();
}

// ============================================
// ASSIGN MODAL (real taverns from the DB)
// ============================================
let taverns = [];

async function openAssignModal(orderCode) {
    currentAssignOrderCode = orderCode;
    document.getElementById('assignOrderCode').innerText = orderCode;
    const select = document.getElementById('tavernSelect');
    select.innerHTML = '<option value="">Loading taverns…</option>';
    document.getElementById('driverName').value = '';
    document.getElementById('driverPhone').value = '';
    document.getElementById('driverVehicle').value = '';
    document.getElementById('assignModal').style.display = 'flex';

    try {
        const res = await adminFetch('/admin/taverns');
        taverns = await res.json();
        select.innerHTML = '<option value="">-- Choose Tavern --</option>' +
            taverns.map(t => `<option value="${t.id}">${t.name} (${t.area})</option>`).join('');
    } catch (err) {
        console.error(err);
        select.innerHTML = '<option value="">Failed to load taverns</option>';
    }
}

function closeAssignModal() {
    document.getElementById('assignModal').style.display = 'none';
    currentAssignOrderCode = null;
}

async function dispatchOrder() {
    const tavernId = document.getElementById('tavernSelect').value;
    const driverName = document.getElementById('driverName').value.trim();
    const driverPhone = document.getElementById('driverPhone').value.trim();
    const driverVehicle = document.getElementById('driverVehicle').value.trim();

    if (!tavernId) { alert('Please select a tavern'); return; }
    if (!driverName) { alert('Please enter driver name'); return; }
    if (!driverPhone) { alert('Please enter driver WhatsApp number'); return; }

    try {
        const res = await adminFetch(`/order/${currentAssignOrderCode}/assign`, {
            method: 'PATCH',
            body: JSON.stringify({ tavernId, driverName, driverPhone, driverVehicle }),
        });
        if (!res.ok) throw new Error('Assign failed');
        closeAssignModal();
        loadOrders();
        alert('Order assigned! Use "📲 Send WhatsApp & Dispatch" on the order card to notify the tavern and driver.');
    } catch (err) {
        console.error(err);
        alert('Failed to assign order');
    }
}

// ============================================
// WHATSAPP MESSAGES
// ============================================
function sendTavernWhatsApp(orderCode, tavern, order) {
    const itemList = order.items.map(item => `${item.name} (x${item.quantity})`).join('\n');
    const message = `🍺 *Ekoyini Order - ${orderCode}*\n\n🏪 *Tavern:* ${tavern.name}\n🛒 *Items:*\n${itemList}\n\n💰 *Total:* R${order.total}\n📍 *Delivery:* ${order.address}\n\n⚠️ *Please prepare this order.*\nDriver will collect and deliver.\nCode: *${orderCode}*`;
    window.open(`https://wa.me/${tavern.phone}?text=${encodeURIComponent(message)}`, '_blank');
}

function sendDriverWhatsApp(orderCode, driverName, driverPhone, order) {
    const tavern = order.tavern;
    const message = `🛵 *Ekoyini Delivery - ${orderCode}*\n\n👋 Hi ${driverName}!\n\n🏪 *Pickup:* ${tavern.name} (${tavern.area})\n📍 *Deliver to:* ${order.address}\n\n🛒 *Order:*\n${order.items.map(item => `${item.name} x${item.quantity}`).join('\n')}\n\n💰 *Total:* R${order.total}\n🔑 *Order Code:* ${orderCode}\n\n⚠️ *Customer will give you this code.*\nConfirm delivery by replying to this message.`;
    window.open(`https://wa.me/${driverPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

async function sendDispatchWhatsApp(orderCode) {
    const order = allOrders.find(o => o.code === orderCode);
    if (!order || !order.tavern || !order.driverName) {
        alert('Please assign tavern and driver first');
        return;
    }
    sendTavernWhatsApp(orderCode, order.tavern, order);
    sendDriverWhatsApp(orderCode, order.driverName, order.driverPhone, order);

    // Sending the dispatch WhatsApp *is* the dispatch action — move the
    // order to DISPATCHED so the "Deliver" button appears next.
    try {
        const res = await adminFetch(`/order/${orderCode}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'DISPATCHED' }),
        });
        if (!res.ok) throw new Error('Failed to update status');
        loadOrders();
    } catch (err) {
        console.error(err);
    }
    alert('WhatsApp messages sent to tavern and driver!');
}

// ============================================
// MARK DELIVERED / DISPATCHED / DELETE
// ============================================
async function markDelivered(orderCode) {
    if (!confirm('Mark this order as delivered?')) return;
    try {
        const res = await adminFetch(`/order/${orderCode}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'DELIVERED' }),
        });
        if (!res.ok) throw new Error('Failed to update status');
        loadOrders();
    } catch (err) {
        console.error(err);
        alert('Failed to mark as delivered');
    }
}

async function deleteOrder(orderCode) {
    if (!confirm('Delete this order permanently?')) return;
    try {
        const res = await adminFetch(`/order/${orderCode}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        loadOrders();
    } catch (err) {
        console.error(err);
        alert('Failed to delete order');
    }
}

