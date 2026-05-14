/* ============================================
   ShopDesk POS — app.js
   ============================================ */

// ── STATE ──────────────────────────────────
let config = {};
let products = [];
let cart = [];
let sales = [];
let currentPayment = 'Cash';

// ── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  updateClock();
  setInterval(updateClock, 1000);
  setDefaultDates();
});

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const from = document.getElementById('sales-date-from');
  const to = document.getElementById('sales-date-to');
  if (from) { from.value = today; to.value = today; }
}

// ── CONFIG ─────────────────────────────────
function loadConfig() {
  try {
    config = JSON.parse(localStorage.getItem('shopdesk_config') || '{}');
  } catch(e) { config = {}; }

  if (config.scriptUrl && config.shopName) {
    launchPOS();
  } else {
    document.getElementById('setup-screen').classList.add('active');
  }
}

function saveConfig() {
  const url = document.getElementById('script-url').value.trim();
  const name = document.getElementById('shop-name').value.trim();
  const curr = document.getElementById('currency').value.trim() || '$';

  if (!url || !name) { showToast('Please fill in all required fields', 'error'); return; }
  if (!url.startsWith('https://script.google.com')) {
    showToast('Invalid Apps Script URL', 'error'); return;
  }

  config = {
    scriptUrl: url,
    shopName: name,
    currency: curr,
    taxRate: 0,
    receiptMsg: 'Thank you for your purchase!'
  };
  localStorage.setItem('shopdesk_config', JSON.stringify(config));
  launchPOS();
}

function launchPOS() {
  document.getElementById('setup-screen').classList.remove('active');
  document.getElementById('pos-screen').classList.add('active');
  document.getElementById('topbar-shop').textContent = config.shopName;
  document.getElementById('tax-label').textContent = config.taxRate || 0;
  loadProducts();
}

// ── API CALLS ──────────────────────────────
async function apiCall(action, data = {}) {
  const url = new URL(config.scriptUrl);
  url.searchParams.set('action', action);
  // For reads: GET. For writes: POST via no-cors workaround (fetch mode=cors with GET params)
  const payload = { action, ...data };

  // We use GET with encoded JSON for simplicity with Apps Script
  url.searchParams.set('payload', JSON.stringify(payload));
  try {
    const res = await fetch(url.toString(), { redirect: 'follow' });
    const json = await res.json();
    return json;
  } catch (e) {
    console.error('API Error', e);
    throw e;
  }
}

async function apiPost(action, data = {}) {
  try {
    const res = await fetch(config.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, ...data }),
      redirect: 'follow'
    });
    const json = await res.json();
    return json;
  } catch (e) {
    console.error('API Error', e);
    throw e;
  }
}

// ── PRODUCTS ───────────────────────────────
async function loadProducts() {
  document.getElementById('product-grid').innerHTML = '<div class="loading-state">Loading products…</div>';
  try {
    const res = await apiCall('getProducts');
    if (res.success) {
      products = res.data || [];
      renderProductGrid();
      renderProductsTable();
      populateCategoryFilter();
    } else {
      document.getElementById('product-grid').innerHTML = '<div class="loading-state">⚠ Could not load products</div>';
    }
  } catch(e) {
    document.getElementById('product-grid').innerHTML =
      '<div class="loading-state">⚠ Connection failed. Check your Script URL in settings.</div>';
  }
}

function renderProductGrid() {
  const grid = document.getElementById('product-grid');
  const search = document.getElementById('product-search').value.toLowerCase();
  const cat = document.getElementById('category-filter').value;

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search) ||
      (p.barcode && p.barcode.toLowerCase().includes(search));
    const matchCat = !cat || p.category === cat;
    return matchSearch && matchCat;
  });

  if (!filtered.length) {
    grid.innerHTML = '<div class="no-results">No products found.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="product-card" onclick="addToCart('${escHtml(p.id)}')">
      <div class="pc-stock ${p.stock <= 0 ? 'low' : p.stock <= 5 ? '' : 'ok'}">
        ${p.stock <= 0 ? 'OUT' : p.stock}
      </div>
      <div class="pc-cat">${escHtml(p.category || '—')}</div>
      <div class="pc-name">${escHtml(p.name)}</div>
      <div class="pc-price">${config.currency}${parseFloat(p.price).toFixed(2)}</div>
    </div>
  `).join('');
}

function populateCategoryFilter() {
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const sel = document.getElementById('category-filter');
  sel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
}

function filterProducts() { renderProductGrid(); }

function renderProductsTable() {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><strong>${escHtml(p.name)}</strong></td>
      <td>${escHtml(p.category || '—')}</td>
      <td>${config.currency}${parseFloat(p.price).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td><code>${escHtml(p.barcode || '—')}</code></td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="openProductModal('${escHtml(p.id)}')">Edit</button>
          <button class="btn-delete" onclick="deleteProduct('${escHtml(p.id)}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No products yet. Add your first product!</td></tr>';
}

// ── PRODUCT MODAL ──────────────────────────
function openProductModal(id = null) {
  document.getElementById('p-name').value = '';
  document.getElementById('p-category').value = '';
  document.getElementById('p-price').value = '';
  document.getElementById('p-stock').value = '0';
  document.getElementById('p-barcode').value = '';
  document.getElementById('edit-row-id').value = '';
  document.getElementById('modal-title').textContent = 'Add Product';

  if (id) {
    const p = products.find(x => x.id === id);
    if (p) {
      document.getElementById('modal-title').textContent = 'Edit Product';
      document.getElementById('edit-row-id').value = p.id;
      document.getElementById('p-name').value = p.name;
      document.getElementById('p-category').value = p.category || '';
      document.getElementById('p-price').value = p.price;
      document.getElementById('p-stock').value = p.stock;
      document.getElementById('p-barcode').value = p.barcode || '';
    }
  }
  document.getElementById('product-modal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('product-modal')) closeProductModal();
}

async function saveProduct() {
  const name = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  if (!name || isNaN(price)) { showToast('Name and Price are required', 'error'); return; }

  const data = {
    id: document.getElementById('edit-row-id').value || ('p_' + Date.now()),
    name,
    category: document.getElementById('p-category').value.trim(),
    price,
    stock: parseInt(document.getElementById('p-stock').value) || 0,
    barcode: document.getElementById('p-barcode').value.trim()
  };

  showToast('Saving…');
  try {
    const res = await apiPost('saveProduct', data);
    if (res.success) {
      showToast('Product saved!', 'success');
      closeProductModal();
      loadProducts();
    } else {
      showToast(res.error || 'Save failed', 'error');
    }
  } catch(e) { showToast('Connection error', 'error'); }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    const res = await apiPost('deleteProduct', { id });
    if (res.success) { showToast('Deleted', 'success'); loadProducts(); }
    else showToast(res.error || 'Delete failed', 'error');
  } catch(e) { showToast('Connection error', 'error'); }
}

// ── CART ───────────────────────────────────
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (p.stock !== undefined && p.stock <= 0) {
    showToast('Out of stock!', 'error'); return;
  }
  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
  }
  renderCart();
  recalc();
}

function changeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  renderCart();
  recalc();
}

function clearCart() {
  cart = [];
  renderCart();
  recalc();
  document.getElementById('customer-name').value = '';
  document.getElementById('sale-note').value = '';
  document.getElementById('discount-val').value = 0;
  document.getElementById('cash-received').value = '';
  document.getElementById('change-due').textContent = config.currency + '0.00';
}

function renderCart() {
  const container = document.getElementById('cart-items');
  if (!cart.length) {
    container.innerHTML = '<div class="empty-cart">No items yet.<br/>Tap a product to add.</div>';
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-price">${config.currency}${(item.price * item.qty).toFixed(2)}</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

function recalc() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountVal = parseFloat(document.getElementById('discount-val').value) || 0;
  const discountType = document.getElementById('discount-type').value;
  const taxRate = parseFloat(config.taxRate) || 0;

  let discountAmt = 0;
  if (discountType === 'pct') discountAmt = subtotal * (discountVal / 100);
  else discountAmt = Math.min(discountVal, subtotal);

  const afterDiscount = subtotal - discountAmt;
  const taxAmt = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmt;

  document.getElementById('subtotal').textContent = config.currency + subtotal.toFixed(2);
  document.getElementById('tax-label').textContent = taxRate;
  document.getElementById('tax-amount').textContent = config.currency + taxAmt.toFixed(2);
  document.getElementById('grand-total').textContent = config.currency + total.toFixed(2);
  calcChange();
}

function calcChange() {
  const total = parseFloat(document.getElementById('grand-total').textContent.replace(/[^0-9.]/g,'')) || 0;
  const received = parseFloat(document.getElementById('cash-received').value) || 0;
  const change = Math.max(0, received - total);
  document.getElementById('change-due').textContent = config.currency + change.toFixed(2);
}

function selectPayment(btn) {
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPayment = btn.dataset.method;
  const cashWrap = document.getElementById('cash-input-wrap');
  cashWrap.style.display = currentPayment === 'Cash' ? 'block' : 'none';
}

// ── CHECKOUT ───────────────────────────────
async function checkout() {
  if (!cart.length) { showToast('Cart is empty', 'error'); return; }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountVal = parseFloat(document.getElementById('discount-val').value) || 0;
  const discountType = document.getElementById('discount-type').value;
  const taxRate = parseFloat(config.taxRate) || 0;

  let discountAmt = 0;
  if (discountType === 'pct') discountAmt = subtotal * (discountVal / 100);
  else discountAmt = Math.min(discountVal, subtotal);

  const afterDiscount = subtotal - discountAmt;
  const taxAmt = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmt;

  const saleData = {
    id: 'sale_' + Date.now(),
    datetime: new Date().toISOString(),
    customer: document.getElementById('customer-name').value.trim() || 'Walk-in',
    items: cart.map(i => `${i.name} x${i.qty}`).join('; '),
    itemsDetail: JSON.stringify(cart),
    payment: currentPayment,
    subtotal: subtotal.toFixed(2),
    discount: discountAmt.toFixed(2),
    tax: taxAmt.toFixed(2),
    total: total.toFixed(2),
    note: document.getElementById('sale-note').value.trim()
  };

  showToast('Processing sale…');
  try {
    const res = await apiPost('recordSale', saleData);
    if (res.success) {
      showToast('Sale recorded!', 'success');
      showReceipt(saleData);
      clearCart();
      loadProducts(); // refresh stock
    } else {
      showToast(res.error || 'Failed to record sale', 'error');
    }
  } catch(e) { showToast('Connection error', 'error'); }
}

// ── RECEIPT ────────────────────────────────
function showReceipt(sale) {
  const line = '─'.repeat(32);
  const center = (str, w=32) => {
    const pad = Math.max(0, Math.floor((w - str.length) / 2));
    return ' '.repeat(pad) + str;
  };

  const items = JSON.parse(sale.itemsDetail || '[]');
  const itemLines = items.map(i =>
    `${i.name.substring(0,20).padEnd(20)} x${i.qty}  ${config.currency}${(i.price*i.qty).toFixed(2)}`
  ).join('\n');

  const receipt = `
${center(config.shopName)}
${center(new Date(sale.datetime).toLocaleString())}
${line}
${itemLines}
${line}
${'Subtotal'.padEnd(22)}${config.currency}${sale.subtotal}
${'Discount'.padEnd(22)}-${config.currency}${sale.discount}
${'Tax'.padEnd(22)}${config.currency}${sale.tax}
${line}
${'TOTAL'.padEnd(22)}${config.currency}${sale.total}
${line}
Payment: ${sale.payment}
Customer: ${sale.customer}
${sale.note ? 'Note: ' + sale.note : ''}
${line}
${center(config.receiptMsg || 'Thank you!')}
${center('Ref: ' + sale.id.slice(-8))}
  `.trim();

  document.getElementById('receipt-content').textContent = receipt;
  document.getElementById('receipt-modal').classList.add('open');
}

function printReceipt() { window.print(); }
function closeReceipt() { document.getElementById('receipt-modal').classList.remove('open'); }
function closeReceiptOnOverlay(e) {
  if (e.target === document.getElementById('receipt-modal')) closeReceipt();
}

// ── SALES ──────────────────────────────────
async function loadSales() {
  const from = document.getElementById('sales-date-from').value;
  const to = document.getElementById('sales-date-to').value;

  const tbody = document.getElementById('sales-tbody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px">Loading…</td></tr>';

  try {
    const res = await apiCall('getSales', { from, to });
    if (res.success) {
      sales = res.data || [];
      renderSalesTable();
      updateSumCards();
    } else {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger)">Failed to load sales</td></tr>';
    }
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger)">Connection error</td></tr>';
  }
}

function renderSalesTable() {
  const tbody = document.getElementById('sales-tbody');
  if (!sales.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">No sales in this period</td></tr>';
    return;
  }
  tbody.innerHTML = [...sales].reverse().map(s => `
    <tr>
      <td>${new Date(s.datetime).toLocaleString()}</td>
      <td>${escHtml(s.customer)}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.items)}</td>
      <td>${escHtml(s.payment)}</td>
      <td>${config.currency}${parseFloat(s.discount||0).toFixed(2)}</td>
      <td>${config.currency}${parseFloat(s.tax||0).toFixed(2)}</td>
      <td><strong>${config.currency}${parseFloat(s.total).toFixed(2)}</strong></td>
      <td>${escHtml(s.note || '')}</td>
    </tr>
  `).join('');
}

function updateSumCards() {
  const today = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.datetime.startsWith(today));
  const todayTotal = todaySales.reduce((a, s) => a + parseFloat(s.total || 0), 0);
  const allTotal = sales.reduce((a, s) => a + parseFloat(s.total || 0), 0);

  document.getElementById('sum-today').textContent = config.currency + todayTotal.toFixed(2);
  document.getElementById('sum-count').textContent = sales.length;
  document.getElementById('sum-avg').textContent = config.currency + (sales.length ? (allTotal / sales.length).toFixed(2) : '0.00');
}

function exportCSV() {
  if (!sales.length) { showToast('No data to export', 'error'); return; }
  const headers = ['Date/Time','Customer','Items','Payment','Subtotal','Discount','Tax','Total','Note'];
  const rows = sales.map(s => [
    s.datetime, s.customer, `"${s.items}"`, s.payment, s.subtotal, s.discount, s.tax, s.total, `"${s.note||''}"`
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sales_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ── SETTINGS ───────────────────────────────
function openSettings() {
  document.getElementById('s-shop-name').value = config.shopName || '';
  document.getElementById('s-currency').value = config.currency || '$';
  document.getElementById('s-tax').value = config.taxRate || 0;
  document.getElementById('s-receipt-msg').value = config.receiptMsg || 'Thank you for your purchase!';
  document.getElementById('s-script-url').value = config.scriptUrl || '';
  document.getElementById('settings-modal').classList.add('open');
}

function saveSettings() {
  config.shopName = document.getElementById('s-shop-name').value.trim() || config.shopName;
  config.currency = document.getElementById('s-currency').value.trim() || '$';
  config.taxRate = parseFloat(document.getElementById('s-tax').value) || 0;
  config.receiptMsg = document.getElementById('s-receipt-msg').value.trim();
  config.scriptUrl = document.getElementById('s-script-url').value.trim() || config.scriptUrl;
  localStorage.setItem('shopdesk_config', JSON.stringify(config));
  document.getElementById('topbar-shop').textContent = config.shopName;
  document.getElementById('tax-label').textContent = config.taxRate;
  closeSettings();
  recalc();
  showToast('Settings saved!', 'success');
}

function closeSettings() { document.getElementById('settings-modal').classList.remove('open'); }
function closeSettingsOnOverlay(e) {
  if (e.target === document.getElementById('settings-modal')) closeSettings();
}

// ── TAB SWITCH ─────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'sales') loadSales();
  if (tab === 'products') renderProductsTable();
}

// ── UTILITIES ──────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}
