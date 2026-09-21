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
// ADMIN LOGIN — real Supabase Auth (per-person, server-verified)
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
let currentAdminRole = null;

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

    try {
        const meRes = await adminFetch('/admin/me');
        const me = await meRes.json();
        currentAdminRole = me.role;
        if (currentAdminRole === 'SUPER_ADMIN') {
            document.getElementById('sectionTabAdmins').style.display = 'block';
            document.getElementById('sectionTabActivity').style.display = 'block';
        }
    } catch (err) {
        console.error('Failed to load admin role:', err);
    }

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
        if (container) container.innerHTML = '<div class="no-orders">Failed to load orders</div>';
        return;
    }

    updateStats(allOrders);

    let filteredOrders = allOrders;
    if (currentFilter !== 'all') {
        filteredOrders = allOrders.filter(o => o.status === currentFilter);
    }

    if (filteredOrders.length === 0) {
        container.innerHTML = '<div class="no-orders">No orders found</div>';
        return;
    }

    container.innerHTML = filteredOrders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <span class="order-code">${order.code}</span>
                <span class="order-status status-${order.status}">${formatStatus(order.status)}</span>
            </div>
            <div class="order-details">
                <p>${formatPaymentBadge(order)}${order.codFlagged ? formatCodFlagBadge(order) : ''}</p>
                <p><strong>Delivery:</strong> ${order.address}</p>
                <p><strong>Customer:</strong> ${order.customerName || 'N/A'} · ${order.customerPhone || 'N/A'}</p>
                <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
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
                    <p><strong>Tavern:</strong> ${order.tavern.name} (${order.tavern.area})</p>
                    <p><strong>Driver:</strong> ${order.driverName || 'N/A'}</p>
                    ${order.driverPhone ? `<p><strong>Driver WhatsApp:</strong> ${order.driverPhone}</p>` : ''}
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
    // EFT is the one payment method that needs a human to actually check
    // the bank statement — COD is paid at the door and card is confirmed
    // automatically by the Yoco webhook, so neither ever needs this button.
    if (order.status === 'PAYMENT_PENDING' && order.paymentMethod === 'eft') {
        buttons += `<button class="btn btn-confirm-payment" onclick="confirmPayment('${order.code}')">Confirm Payment Received</button>`;
    }
    if (order.status === 'PAYMENT_PENDING' || order.status === 'PENDING') {
        buttons += `<button class="btn btn-assign" onclick="openAssignModal('${order.code}')">Assign</button>`;
    }
    if (order.status === 'PENDING' && order.tavern) {
        buttons += `<button class="btn btn-dispatch" onclick="sendDispatchWhatsApp('${order.code}')">Send WhatsApp to Tavern & Driver</button>`;
        buttons += `<button class="btn btn-assign" onclick="markPickedUpManually('${order.code}')" title="Only if the driver can't use their own confirm-pickup link">Mark Picked Up (Manual)</button>`;
    }
    if (order.status === 'DISPATCHED') {
        buttons += `<button class="btn btn-deliver" onclick="markDelivered('${order.code}')">Deliver</button>`;
    }
    // Deleting an order is a super-admin-only action (also enforced
    // server-side) — a dispatcher shouldn't be able to erase order history.
    if (currentAdminRole === 'SUPER_ADMIN') {
        buttons += `<button class="btn btn-delete" onclick="deleteOrder('${order.code}')">Delete</button>`;
    }
    return buttons;
}

// Payment method is captured at checkout but was never surfaced here —
// the admin had no way to tell a COD order (cash collected at the door,
// nothing to verify) from an EFT order (needs the bank statement checked
// before dispatch) without opening the DB directly.
function formatPaymentBadge(order) {
    const method = (order.paymentMethod || 'cod').toLowerCase();
    if (method === 'eft') {
        return '<span class="payment-badge eft">EFT — verify bank statement before dispatching</span>';
    }
    if (method === 'card') {
        return '<span class="payment-badge">Card</span>';
    }
    return '<span class="payment-badge cod">Pay on Delivery</span>';
}

// COD orders that deviate sharply from the customer's own purchase history
// (see assessCodEligibility in server.js) get flagged, not blocked — this
// is the "worth a second look before dispatch" signal for that.
function formatCodFlagBadge(order) {
    const reason = (order.codFlagReason || 'Unusual order for this customer').replace(/"/g, '&quot;');
    return ` <span class="payment-badge cod-flag" title="${reason}">⚠ Review before dispatch</span>`;
}

function formatStatus(status) {
    const map = {
        PAYMENT_PENDING: 'Awaiting EFT Payment',
        PENDING: 'Packing',
        DISPATCHED: 'Dispatched',
        DELIVERED: 'Delivered',
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
        alert('Order assigned! Use "Send WhatsApp & Dispatch" on the order card to notify the tavern and driver.');
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
    const message = `*Ekoyini Order - ${orderCode}*\n\n*Tavern:* ${tavern.name}\n*Items:*\n${itemList}\n\n*Total:* R${order.total}\n*Delivery:* ${order.address}\n\n*Please prepare this order.*\nDriver will collect and deliver.\nCode: *${orderCode}*`;
    window.open(`https://wa.me/${tavern.phone}?text=${encodeURIComponent(message)}`, '_blank');
}

function sendDriverWhatsApp(orderCode, driverName, driverPhone, order) {
    const tavern = order.tavern;
    // driverShareToken is generated at assign time (see PATCH /order/:code/assign)
    // and is the only thing authorizing driver-track.html to post live location
    // updates for this order — no driver account exists, so the link itself is
    // the credential. Only include it if it's actually there.
    const shareLink = order.driverShareToken
        ? `${window.location.origin}/driver-track.html?code=${encodeURIComponent(orderCode)}&token=${encodeURIComponent(order.driverShareToken)}`
        : null;
    const message = `*Ekoyini Delivery - ${orderCode}*\n\nHi ${driverName}!\n\n*Pickup:* ${tavern.name} (${tavern.area})\n*Deliver to:* ${order.address}\n\n*Order:*\n${order.items.map(item => `${item.name} x${item.quantity}`).join('\n')}\n\n*Total:* R${order.total}\n*Order Code:* ${orderCode}\n${shareLink ? `\n*Open this link once you've collected the order — confirm pickup, then share your live location so the customer can track you:*\n${shareLink}\n` : ''}\n*Customer will give you this code.*\nThe same link also lets you mark it delivered once it's dropped off.`;
    window.open(`https://wa.me/${driverPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

function sendDispatchWhatsApp(orderCode) {
    const order = allOrders.find(o => o.code === orderCode);
    if (!order || !order.tavern || !order.driverName) {
        alert('Please assign tavern and driver first');
        return;
    }
    sendTavernWhatsApp(orderCode, order.tavern, order);
    sendDriverWhatsApp(orderCode, order.driverName, order.driverPhone, order);

    // No status change here — the order moves to DISPATCHED when the
    // driver taps "Confirm Pickup" on their own driver-track.html link
    // (POST /order/:code/confirm-pickup), not just because a message was
    // sent. See markPickedUpManually() for the fallback when a driver
    // can't use that link.
    alert('WhatsApp messages sent to tavern and driver! The order moves to Dispatched once the driver confirms pickup on their link.');
}

// Fallback for a driver who can't use the driver-track.html link (no
// smartphone, bad signal) — an admin can still move the order forward
// manually instead of it being stuck waiting on a confirmation that will
// never come.
async function markPickedUpManually(orderCode) {
    if (!confirm('Mark this order as picked up / dispatched manually?')) return;
    try {
        const res = await adminFetch(`/order/${orderCode}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'DISPATCHED' }),
        });
        if (!res.ok) throw new Error('Failed to update status');
        loadOrders();
    } catch (err) {
        console.error(err);
        alert('Failed to update status');
    }
}

// EFT-only — check the bank statement for this order's amount before
// clicking. This is the one alert the customer actually asked for: it
// moves PAYMENT_PENDING → PENDING and triggers the "payment received,
// order being packed" email server-side.
async function confirmPayment(orderCode) {
    if (!confirm('Confirm you\'ve verified this EFT payment in the bank statement?')) return;
    try {
        const res = await adminFetch(`/order/${orderCode}/confirm-payment`, { method: 'PATCH' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to confirm payment');
        }
        loadOrders();
    } catch (err) {
        console.error(err);
        alert(err.message || 'Failed to confirm payment');
    }
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

// ============================================
// SECTION SWITCHING (Orders / Inventory / Admins)
// ============================================
let inventoryLoaded = false;
let adminsLoaded = false;
let activityLoaded = false;

function showSection(name, tabEl) {
    document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    document.getElementById('ordersSection').style.display = name === 'orders' ? 'block' : 'none';
    document.getElementById('inventorySection').style.display = name === 'inventory' ? 'block' : 'none';
    document.getElementById('adminsSection').style.display = name === 'admins' ? 'block' : 'none';
    document.getElementById('activitySection').style.display = name === 'activity' ? 'block' : 'none';

    if (name === 'inventory' && !inventoryLoaded) { inventoryLoaded = true; loadInventory(); }
    if (name === 'admins' && !adminsLoaded) { adminsLoaded = true; loadAdmins(); }
    if (name === 'activity' && !activityLoaded) { activityLoaded = true; loadActivity(); }
}
window.showSection = showSection;

// ============================================
// ACTIVITY LOG (super-admin only — who did what, when)
// ============================================
async function loadActivity() {
    const list = document.getElementById('activityList');
    list.innerHTML = '<div class="no-orders">Loading…</div>';
    try {
        const res = await adminFetch('/admin/audit-log');
        if (!res.ok) throw new Error('Failed to load activity');
        const logs = await res.json();
        if (logs.length === 0) {
            list.innerHTML = '<div class="no-orders">No admin activity yet</div>';
            return;
        }
        list.innerHTML = logs.map(l => `
            <div class="activity-row">
                <div class="activity-row-top">
                    <span class="activity-action">${l.action.replace(/_/g, ' ')}</span>
                    <span class="activity-time">${new Date(l.createdAt).toLocaleString()}</span>
                </div>
                ${l.targetId ? `<div class="activity-detail">${l.targetId}${l.detail ? ` — ${l.detail}` : ''}</div>` : ''}
                <div class="activity-admin">by ${l.adminEmail}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error(err);
        list.innerHTML = '<div class="no-orders">Failed to load activity</div>';
    }
}

// ============================================
// INVENTORY (view: any admin; edit: super-admin only)
// ============================================
let inventoryProducts = [];

async function loadInventory() {
    const list = document.getElementById('inventoryList');
    list.innerHTML = '<div class="no-orders">Loading…</div>';
    try {
        const res = await adminFetch('/admin/products');
        if (!res.ok) throw new Error('Failed to load products');
        inventoryProducts = await res.json();
        renderInventory();
    } catch (err) {
        console.error(err);
        list.innerHTML = '<div class="no-orders">Failed to load inventory</div>';
    }
}

function renderInventory() {
    const list = document.getElementById('inventoryList');
    const q = (document.getElementById('invSearch').value || '').trim().toLowerCase();
    const filtered = q
        ? inventoryProducts.filter(p => p.name.toLowerCase().includes(q))
        : inventoryProducts;

    if (filtered.length === 0) {
        list.innerHTML = '<div class="no-orders">No products match that search</div>';
        return;
    }

    const canEdit = currentAdminRole === 'SUPER_ADMIN';
    list.innerHTML = filtered.map(p => `
        <div class="inv-row${p.stock <= 0 ? ' zero-stock' : ''}">
            <div class="inv-row-info">
                <div class="inv-row-name">${p.name}</div>
                <div class="inv-row-meta">${p.category.replace(/_/g, ' ')} · ${p.bottleFormat}</div>
            </div>
            <div class="inv-row-stock">
                <input type="number" min="0" id="stock-${p.id}" value="${p.stock}" ${canEdit ? '' : 'disabled'}>
                ${canEdit ? `<button onclick="saveStock('${p.id}')">Save</button>` : ''}
            </div>
        </div>
    `).join('');
}
window.renderInventory = renderInventory;

async function saveStock(id) {
    const input = document.getElementById(`stock-${id}`);
    const stock = parseInt(input.value, 10);
    if (!Number.isInteger(stock) || stock < 0) {
        alert('Stock must be a non-negative whole number');
        return;
    }
    try {
        const res = await adminFetch(`/admin/products/${id}/stock`, {
            method: 'PATCH',
            body: JSON.stringify({ stock }),
        });
        if (!res.ok) throw new Error('Failed to save');
        const product = inventoryProducts.find(p => p.id === id);
        if (product) product.stock = stock;
        renderInventory();
    } catch (err) {
        console.error(err);
        alert('Failed to save stock');
    }
}
window.saveStock = saveStock;

// ============================================
// MANAGE ADMINS (super-admin only — page already hides the tab, server
// still enforces requireSuperAdmin on every /admin/admins route)
// ============================================
async function loadAdmins() {
    const list = document.getElementById('adminsList');
    list.innerHTML = '<div class="no-orders">Loading…</div>';
    try {
        const res = await adminFetch('/admin/admins');
        if (!res.ok) throw new Error('Failed to load admins');
        const data = await res.json();
        renderAdmins(data.admins, data.bootstrapped);
    } catch (err) {
        console.error(err);
        list.innerHTML = '<div class="no-orders">Failed to load admins</div>';
    }
}

function renderAdmins(admins, bootstrapped) {
    const list = document.getElementById('adminsList');
    const bootstrappedRows = bootstrapped.map(email => `
        <div class="admin-row">
            <span class="admin-row-email">${email}<span class="admin-role-badge super">Super Admin</span></span>
            <span style="font-size:10px;color:#999;">via ADMIN_EMAILS</span>
        </div>
    `).join('');
    const dbRows = admins.map(a => `
        <div class="admin-row">
            <span class="admin-row-email">${a.email}<span class="admin-role-badge${a.role === 'SUPER_ADMIN' ? ' super' : ''}">${a.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Dispatcher'}</span></span>
            <button onclick="removeAdmin('${a.id}')">Remove</button>
        </div>
    `).join('');
    list.innerHTML = bootstrappedRows + dbRows || '<div class="no-orders">No admins yet</div>';
}

async function addAdmin() {
    const email = document.getElementById('newAdminEmail').value.trim();
    const role = document.getElementById('newAdminRole').value;
    if (!email) { alert('Please enter an email'); return; }
    try {
        const res = await adminFetch('/admin/admins', {
            method: 'POST',
            body: JSON.stringify({ email, role }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to add admin');
        }
        document.getElementById('newAdminEmail').value = '';
        loadAdmins();
    } catch (err) {
        console.error(err);
        alert(err.message || 'Failed to add admin');
    }
}
window.addAdmin = addAdmin;

async function removeAdmin(id) {
    if (!confirm('Remove this admin\'s access?')) return;
    try {
        const res = await adminFetch(`/admin/admins/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to remove admin');
        loadAdmins();
    } catch (err) {
        console.error(err);
        alert('Failed to remove admin');
    }
}
window.removeAdmin = removeAdmin;

