// ============================================
// EKOYINI ADMIN DISPATCH DASHBOARD
// ============================================
//
// ⚠️ KNOWN ISSUE (flagged, not yet fixed here):
// The PIN + OTP check below runs entirely in the browser. It is UI-only —
// it does NOT protect the /orders data, since ADMIN_PIN and currentOtp are
// both readable in devtools and the comparison happens client-side.
// This needs to move to real server-side auth (Supabase Auth) before this
// dashboard is exposed on a public URL with real order data behind it.
// ============================================

// ============================================
// 🔐 TWO-FACTOR AUTHENTICATION (CANNOT BYPASS)
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

    // Remove the full-screen overlay
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.style.display = 'none';

    // Unlock body scrolling
    document.body.classList.remove('admin-locked');
    document.body.classList.add('admin-unlocked');

    loadOrders();
}

function logout() {
    sessionStorage.removeItem('admin_2fa_authenticated');
    clearInterval(otpTimerInterval);
    clearInterval(resendTimerInterval);
    currentOtp = null;

    // Show the overlay again
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.style.display = 'flex';

    // Lock body scrolling
    document.body.classList.add('admin-locked');
    document.body.classList.remove('admin-unlocked');

    // Reset PIN and OTP screens
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
    // ALWAYS lock the page first
    document.body.classList.add('admin-locked');

    // Only unlock if previously authenticated in this session
    if (sessionStorage.getItem('admin_2fa_authenticated') === 'true') {
        const overlay = document.getElementById('authOverlay');
        if (overlay) overlay.style.display = 'none';
        document.body.classList.remove('admin-locked');
        document.body.classList.add('admin-unlocked');
        // loadOrders will be called by DOMContentLoaded below
    }
})();

// ============================================
// YOUR CENTRAL WHATSAPP NUMBER
// ============================================
const CENTRAL_DISPATCHER_PHONE = "27640045465";

// Taverns database
const taverns = [
    { id: 1, name: "Extreme Liquor Store", area: "Zwide", phone: "27841234567" },
    { id: 2, name: "Mama's Corner Tavern", area: "KwaZakhele", phone: "27721234567" },
    { id: 3, name: "New Brighton Liquor", area: "New Brighton", phone: "27839876543" },
    { id: 4, name: "Central Bottle Store", area: "Central", phone: "27739876543" },
    { id: 5, name: "Motherwell Drinks Hub", area: "Motherwell", phone: "27851239876" },
];

let currentFilter = 'all';
let currentAssignOrderCode = null;

// ============================================
// LOAD & DISPLAY ORDERS
// ============================================
function loadOrders() {
    const orders = JSON.parse(localStorage.getItem('ekoyini_orders') || '[]');
    const container = document.getElementById('ordersList');

    updateStats(orders);

    let filteredOrders = orders;
    if (currentFilter !== 'all') {
        filteredOrders = orders.filter(o => o.status === currentFilter);
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
                <p>🕐 <strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
            </div>
            <div class="order-items">
                ${order.items.map(item => `
                    <div class="item-row">
                        <span>${item.name} x${item.quantity}</span>
                        <span>R${item.price * item.quantity}</span>
                    </div>
                `).join('')}
                <div class="total-row">
                    <span>Total</span>
                    <span>R${order.total}</span>
                </div>
            </div>
            ${order.assignedTavern ? `
                <div class="assigned-info">
                    <p>🏪 <strong>Tavern:</strong> ${order.assignedTavern.name} (${order.assignedTavern.area})</p>
                    <p>🛵 <strong>Driver:</strong> ${order.assignedDriver.name || 'N/A'}</p>
                    ${order.assignedDriver && order.assignedDriver.phone ? `<p>📱 <strong>Driver WhatsApp:</strong> ${order.assignedDriver.phone}</p>` : ''}
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
    if (order.status === 'payment_pending' || order.status === 'pending') {
        buttons += `<button class="btn btn-assign" onclick="openAssignModal('${order.code}')">🏪 Assign</button>`;
    }
    if (order.status === 'pending' && order.assignedTavern) {
        buttons += `<button class="btn btn-dispatch" onclick="sendDispatchWhatsApp('${order.code}')">📲 Send WhatsApp</button>`;
    }
    if (order.status === 'dispatched') {
        buttons += `<button class="btn btn-deliver" onclick="markDelivered('${order.code}')">✅ Deliver</button>`;
    }
    buttons += `<button class="btn btn-delete" onclick="deleteOrder('${order.code}')">🗑</button>`;
    return buttons;
}

function formatStatus(status) {
    const map = {
        'payment_pending': '💰 Payment Pending',
        'pending': '📦 Ready',
        'dispatched': '🛵 Dispatched',
        'delivered': '✅ Delivered'
    };
    return map[status] || status;
}

function updateStats(orders) {
    document.getElementById('pendingCount').innerText = orders.filter(o => o.status === 'payment_pending' || o.status === 'pending').length;
    document.getElementById('dispatchedCount').innerText = orders.filter(o => o.status === 'dispatched').length;
    document.getElementById('deliveredCount').innerText = orders.filter(o => o.status === 'delivered').length;
}

// ============================================
// FILTER
// ============================================
function filterOrders(filter) {
    currentFilter = filter;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    loadOrders();
}

// ============================================
// ASSIGN MODAL
// ============================================
function openAssignModal(orderCode) {
    currentAssignOrderCode = orderCode;
    document.getElementById('assignOrderCode').innerText = orderCode;
    const select = document.getElementById('tavernSelect');
    select.innerHTML = '<option value="">-- Choose Tavern --</option>' +
        taverns.map(t => `<option value="${t.id}">${t.name} (${t.area})</option>`).join('');
    document.getElementById('driverName').value = '';
    document.getElementById('driverPhone').value = '';
    document.getElementById('driverVehicle').value = '';
    document.getElementById('assignModal').style.display = 'flex';
}

function closeAssignModal() {
    document.getElementById('assignModal').style.display = 'none';
    currentAssignOrderCode = null;
}

function dispatchOrder() {
    const tavernId = document.getElementById('tavernSelect').value;
    const driverName = document.getElementById('driverName').value.trim();
    const driverPhone = document.getElementById('driverPhone').value.trim();
    const driverVehicle = document.getElementById('driverVehicle').value.trim();

    if (!tavernId) { alert('Please select a tavern'); return; }
    if (!driverName) { alert('Please enter driver name'); return; }
    if (!driverPhone) { alert('Please enter driver WhatsApp number'); return; }

    const tavern = taverns.find(t => t.id == tavernId);
    const orders = JSON.parse(localStorage.getItem('ekoyini_orders') || '[]');
    const orderIndex = orders.findIndex(o => o.code === currentAssignOrderCode);

    if (orderIndex !== -1) {
        orders[orderIndex].assignedTavern = { name: tavern.name, area: tavern.area, phone: tavern.phone };
        orders[orderIndex].assignedDriver = { name: driverName, phone: driverPhone, vehicle: driverVehicle };
        orders[orderIndex].status = 'pending';
        localStorage.setItem('ekoyini_orders', JSON.stringify(orders));
    }

    sendTavernWhatsApp(currentAssignOrderCode, tavern, orders[orderIndex]);
    sendDriverWhatsApp(currentAssignOrderCode, driverName, driverPhone, orders[orderIndex]);
    closeAssignModal();
    loadOrders();
    alert('Order assigned! WhatsApp messages sent to tavern and driver.');
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
    const tavern = order.assignedTavern;
    const message = `🛵 *Ekoyini Delivery - ${orderCode}*\n\n👋 Hi ${driverName}!\n\n🏪 *Pickup:* ${tavern.name} (${tavern.area})\n📍 *Deliver to:* ${order.address}\n\n🛒 *Order:*\n${order.items.map(item => `${item.name} x${item.quantity}`).join('\n')}\n\n💰 *Total:* R${order.total}\n🔑 *Order Code:* ${orderCode}\n\n⚠️ *Customer will give you this code.*\nConfirm delivery by replying to this message.`;
    window.open(`https://wa.me/${driverPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

function sendDispatchWhatsApp(orderCode) {
    const orders = JSON.parse(localStorage.getItem('ekoyini_orders') || '[]');
    const order = orders.find(o => o.code === orderCode);
    if (!order || !order.assignedTavern || !order.assignedDriver) {
        alert('Please assign tavern and driver first');
        return;
    }
    sendTavernWhatsApp(orderCode, order.assignedTavern, order);
    sendDriverWhatsApp(orderCode, order.assignedDriver.name, order.assignedDriver.phone, order);
    alert('WhatsApp messages sent to tavern and driver!');
}

// ============================================
// MARK DELIVERED / DELETE
// ============================================
function markDelivered(orderCode) {
    if (!confirm('Mark this order as delivered?')) return;
    const orders = JSON.parse(localStorage.getItem('ekoyini_orders') || '[]');
    const orderIndex = orders.findIndex(o => o.code === orderCode);
    if (orderIndex !== -1) {
        orders[orderIndex].status = 'delivered';
        localStorage.setItem('ekoyini_orders', JSON.stringify(orders));
    }
    loadOrders();
}

function deleteOrder(orderCode) {
    if (!confirm('Delete this order permanently?')) return;
    let orders = JSON.parse(localStorage.getItem('ekoyini_orders') || '[]');
    orders = orders.filter(o => o.code !== orderCode);
    localStorage.setItem('ekoyini_orders', JSON.stringify(orders));
    loadOrders();
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Only load orders if already authenticated
    if (sessionStorage.getItem('admin_2fa_authenticated') === 'true') {
        loadOrders();
        setInterval(loadOrders, 30000);
    }
});
