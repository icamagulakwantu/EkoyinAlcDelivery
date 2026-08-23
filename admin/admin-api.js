// ============================================
// EKOYINI ADMIN DISPATCH DASHBOARD — real API version
// ============================================
//
// The old admin.js (kept for reference) stored orders in localStorage.
// This version calls the real backend (server.js) via the x-admin-token
// header, so the dashboard reflects real DB state and works across
// devices/browsers.
//
// ⚠️ KNOWN ISSUE (flagged, not yet fixed here):
// The PIN + OTP check below still runs entirely in the browser — it's
// UI-only. The actual security boundary is the x-admin-token header the
// server checks on every admin route. This needs to move to real
// server-side auth (Supabase Auth) before this dashboard is exposed on a
// public URL with real order data behind it.
// ============================================

// ============================================
// 🔐 TWO-FACTOR AUTHENTICATION (UI GATE — see note above)
// ============================================

const ADMIN_PIN = "2025";  // Change this to your 4-digit PIN
const FOUNDER_WHATSAPP = "27640045465";  // CHANGE TO YOUR PRIVATE NUMBER

let pinEntry = "";
let currentOtp = null;
let otpExpiryTime = null;
let otpTimerInterval = null;
let resendTimerInterval = null;
let resendCountdown = 30;

// ============================================
// STEP 1: PIN ENTRY
// ============================================
function addPinDigit(digit) {
    if (pinEntry.length >= 4) return;
    pinEntry += digit;
    updatePinDots();
    if (pinEntry.length === 4) setTimeout(verifyPin, 300);
}

function clearPin() {
    pinEntry = pinEntry.slice(0, -1);
    updatePinDots();
    document.getElementById('pinError').style.display = 'none';
}

function updatePinDots() {
    const dots = document.querySelectorAll('#pinDots .dot');
    dots.forEach((dot, index) => dot.classList.toggle('filled', index < pinEntry.length));
}

function verifyPin() {
    if (pinEntry === ADMIN_PIN) {
        document.getElementById('pinError').style.display = 'none';
        document.getElementById('stepPin').style.display = 'none';
        document.getElementById('stepOtp').style.display = 'block';
        pinEntry = "";
        updatePinDots();
        generateAndSendOtp();
    } else {
        document.getElementById('pinError').style.display = 'block';
        pinEntry = "";
        updatePinDots();
        const pinCard = document.getElementById('pinCard');
        if (pinCard) { pinCard.classList.add('shake'); setTimeout(() => pinCard.classList.remove('shake'), 500); }
    }
}

// ============================================
// STEP 2: OTP
// ============================================
function generateAndSendOtp() {
    currentOtp = Math.floor(100000 + Math.random() * 900000).toString();
    otpExpiryTime = Date.now() + (5 * 60 * 1000);
    sendOtpToWhatsApp(currentOtp);
    startOtpTimer();
    startResendTimer();
    clearOtpInputs();
    const otp1 = document.getElementById('otp1');
    if (otp1) otp1.focus();
    document.getElementById('otpError').style.display = 'none';
}

function sendOtpToWhatsApp(otp) {
    const message = `🔐 *Ekoyini Admin OTP*\n\nYour one-time access code is: *${otp}*\n\n⏰ Expires in 5 minutes.`;
    window.open(`https://wa.me/${FOUNDER_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank');
}

function startOtpTimer() {
    clearInterval(otpTimerInterval);
    otpTimerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiryTime - Date.now()) / 1000));
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        const timerEl = document.getElementById('otpTimer');
        if (timerEl) timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        if (remaining <= 0) {
            clearInterval(otpTimerInterval);
            currentOtp = null;
            const errorEl = document.getElementById('otpError');
            if (errorEl) { errorEl.textContent = 'OTP expired. Request a new one.'; errorEl.style.display = 'block'; }
        }
    }, 1000);
}

function startResendTimer() {
    resendCountdown = 30;
    const resendBtn = document.getElementById('resendBtn');
    const resendCountdownEl = document.getElementById('resendCountdown');
    if (resendBtn) resendBtn.disabled = true;
    clearInterval(resendTimerInterval);
    resendTimerInterval = setInterval(() => {
        resendCountdown--;
        if (resendCountdownEl) resendCountdownEl.textContent = resendCountdown;
        if (resendCountdown <= 0) {
            clearInterval(resendTimerInterval);
            if (resendBtn) { resendBtn.disabled = false; resendBtn.innerHTML = '🔄 Resend OTP'; }
        }
    }, 1000);
}

function resendOtp() {
    generateAndSendOtp();
}

// ============================================
// OTP INPUT HANDLING
// ============================================
function otpAutoFocus(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    if (input.value.length === 1) {
        const next = input.nextElementSibling;
        if (next && next.classList.contains('otp-box')) next.focus();
    }
    const allInputs = document.querySelectorAll('.otp-box');
    const allFilled = Array.from(allInputs).every(inp => inp.value.length === 1);
    if (allFilled) setTimeout(verifyOtp, 300);
}

function clearOtpInputs() {
    document.querySelectorAll('.otp-box').forEach(input => input.value = '');
}

function getOtpValue() {
    return Array.from(document.querySelectorAll('.otp-box')).map(input => input.value).join('');
}

function verifyOtp() {
    const enteredOtp = getOtpValue();
    if (!currentOtp) {
        document.getElementById('otpError').textContent = 'OTP expired. Request a new one.';
        document.getElementById('otpError').style.display = 'block';
        return;
    }
    if (Date.now() > otpExpiryTime) {
        document.getElementById('otpError').textContent = 'OTP expired. Request a new one.';
        document.getElementById('otpError').style.display = 'block';
        currentOtp = null;
        return;
    }
    if (enteredOtp === currentOtp) {
        clearInterval(otpTimerInterval);
        clearInterval(resendTimerInterval);
        currentOtp = null;
        grantAccess();
    } else {
        document.getElementById('otpError').textContent = 'Incorrect OTP. Check WhatsApp and try again.';
        document.getElementById('otpError').style.display = 'block';
        clearOtpInputs();
        const otp1 = document.getElementById('otp1');
        if (otp1) otp1.focus();
        const pinCard = document.getElementById('pinCard');
        if (pinCard) { pinCard.classList.add('shake'); setTimeout(() => pinCard.classList.remove('shake'), 500); }
    }
}

// ============================================
// GRANT / REVOKE ACCESS (OVERLAY SYSTEM)
// ============================================
function grantAccess() {
    sessionStorage.setItem('admin_2fa_authenticated', 'true');

    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.style.display = 'none';

    document.body.classList.remove('admin-locked');
    document.body.classList.add('admin-unlocked');

    ensureAdminToken();
    loadOrders();
}

function logout() {
    sessionStorage.removeItem('admin_2fa_authenticated');
    clearInterval(otpTimerInterval);
    clearInterval(resendTimerInterval);
    currentOtp = null;

    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.style.display = 'flex';

    document.body.classList.add('admin-locked');
    document.body.classList.remove('admin-unlocked');

    document.getElementById('stepPin').style.display = 'block';
    document.getElementById('stepOtp').style.display = 'none';
    pinEntry = "";
    updatePinDots();
    clearOtpInputs();
}

// ============================================
// CHECK AUTH ON PAGE LOAD
// ============================================
(function() {
    document.body.classList.add('admin-locked');
    if (sessionStorage.getItem('admin_2fa_authenticated') === 'true') {
        const overlay = document.getElementById('authOverlay');
        if (overlay) overlay.style.display = 'none';
        document.body.classList.remove('admin-locked');
        document.body.classList.add('admin-unlocked');
        // loadOrders() runs from DOMContentLoaded below
    }
})();

// ============================================
// ADMIN API TOKEN — the real security boundary.
// Not hardcoded here on purpose (it's a server secret, ADMIN_API_TOKEN in
// .env) — prompted for once per session and cached in sessionStorage.
// ============================================
function ensureAdminToken() {
    let token = sessionStorage.getItem('ekoyini_admin_token');
    if (!token) {
        token = prompt('Enter the admin API token (ADMIN_API_TOKEN from .env):') || '';
        sessionStorage.setItem('ekoyini_admin_token', token);
    }
    return token;
}

async function adminFetch(url, options = {}) {
    const token = ensureAdminToken();
    const res = await fetch(url, {
        ...options,
        headers: { ...(options.headers || {}), 'x-admin-token': token, 'Content-Type': 'application/json' },
    });
    if (res.status === 401) {
        sessionStorage.removeItem('ekoyini_admin_token');
        alert('Admin token rejected. Please re-enter it.');
    }
    return res;
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

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('admin_2fa_authenticated') === 'true') {
        loadOrders();
        setInterval(loadOrders, 30000);
    }
});
