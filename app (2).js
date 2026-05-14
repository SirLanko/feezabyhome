/* ============================================
   ShopDesk POS — app.js  (CORS-safe via JSONP)
   ============================================ */

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
  const to   = document.getElementById('sales-date-to');
  if (from) { from.value = today; to.value = today; }
}

// ── CONFIG ─────────────────────────────────
function loadConfig() {
  try { config = JSON.parse(localStorage.getItem('shopdesk_config') || '{}'); }
  catch(e) { config = {}; }
  if (config.scriptUrl && config.shopName) launchPOS();
  else document.getElementById('setup-screen').classList.add('active');
}

function saveConfig() {
  const url  = document.getElementById('script-url').value.trim();
  const name = document.getElementById('shop-name').value.trim();
  const curr = document.getElementById('currency').value.trim() || '$';
  if (!url || !name) { showToast('Please fill in all required fields', 'error'); return; }
  if (!url.includes('script.google.com')) { showToast('Invalid Apps Script URL', 'error'); return; }
  config = { scriptUrl: url, shopName: name, currency: curr, taxRate: 0, receiptMsg: 'Thank you for your purchase!' };
  localStorage.setItem('shopdesk_config', JSON.stringify(config));
  launchPOS();
}

function launchPOS() {
  document.getElementById('setup-screen').classList.remove('active');
  document.getElementById('pos-screen').classList.add('active');
  document.getElementById('topbar-shop').textContent = config.shopName;
  document.getElementById('tax-label').textContent   = config.taxRate || 0;
  loadProducts();
}

// ── JSONP (GET reads — bypasses CORS fully) ──
function jsonpCall(params) {
  return new Promise((resolve, reject) => {
    const cbName = 'cb_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    const timer  = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out. Make sure Apps Script is deployed with "Anyone" access.'));
    }, 14000);

    function cleanup() {
      clearTimeout(timer);
      delete window[cbName];
      const el = document.getElementById(cbName);
      if (el) el.remove();
    }

    window[cbName] = function(data) { cleanup(); resolve(data); };

    const url = new URL(config.scriptUrl);
    url.searchParams.set('callback', cbName);
    Object.keys(params).forEach(k =>
      url.searchParams.set(k, typeof params[k] === 'object' ? JSON.stringify(params[k]) : String(params[k]))
    );

    const s  = document.createElement('script');
    s.id     = cbName;
    s.src    = url.toString();
    s.onerror = () => { cleanup(); reject(new Error('Failed to reach Apps Script. Check URL in Settings.')); };
    document.head.appendChild(s);
  });
}

// ── no-cors POST (writes — fire and forget) ──
function noCorsPOST(params) {
  const body = Object.keys(params)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(
      typeof params[k] === 'object' ? JSON.stringify(params[k]) : String(params[k])
    )).join('&');
  return fetch(config.scriptUrl, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  }).then(() => new Promise(r => setTimeout(() => r({ success: true }), 1600)))
    .catch(() => new Promise(r => setTimeout(() => r({ success: true }), 1600)));
}

// ── PRODUCTS ───────────────────────────────
async function loadProducts() {
  document.getElementById('product-grid').innerHTML = '<div class="loading-state">⏳ Connecting to Google Sheet…</div>';
  try {
    const res = await jsonpCall({ action: 'getProducts' });
    if (res.success) {
      products = res.data || [];
      renderProductGrid();
      renderProductsTable();
      populateCategoryFilter();
    } else {
      document.getElementById('product-grid').innerHTML = `<div class="loading-state">⚠ ${res.error || 'Error loading products'}</div>`;
    }
  } catch(e) {
    document.getElementById('product-grid').innerHTML = `<div class="loading-state">⚠ ${e.message}</div>`;
    showToast(e.message, 'error');
  }
}

function renderProductGrid() {
  const grid   = document.getElementById('product-grid');
  const search = (document.getElementById('product-search').value || '').toLowerCase();
  const cat    = document.getElementById('category-filter').value;
  const filtered = products.filter(p => {
    const ms = !search || p.name.toLowerCase().includes(search) || (p.barcode && String(p.barcode).toLowerCase().includes(search));
    const mc = !cat || p.category === cat;
    return ms && mc;
  });
  if (!filtered.length) { grid.innerHTML = '<div class="no-results">No products found.</div>'; return; }
  grid.innerHTML = filtered.map(p => {
    const stock = parseInt(p.stock) || 0;
    const sc = stock <= 0 ? 'low' : stock <= 5 ? '' : 'ok';
    return `<div class="product-card" onclick="addToCart('${escHtml(String(p.id))}')">
      <div class="pc-stock ${sc}">${stock <= 0 ? 'OUT' : stock}</div>
      <div class="pc-cat">${escHtml(p.category || '—')}</div>
      <div class="pc-name">${escHtml(p.name)}</div>
      <div class="pc-price">${config.currency}${parseFloat(p.price).toFixed(2)}</div>
    </div>`;
  }).join('');
}

function populateCategoryFilter() {
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const sel  = document.getElementById('category-filter');
  sel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
}

function filterProducts() { renderProductGrid(); }

function renderProductsTable() {
  const tbody = document.getElementById('products-tbody');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No products yet. Click "+ Add Product"</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `<tr>
    <td><strong>${escHtml(p.name)}</strong></td>
    <td>${escHtml(p.category||'—')}</td>
    <td>${config.currency}${parseFloat(p.price).toFixed(2)}</td>
    <td>${p.stock}</td>
    <td><code>${escHtml(p.barcode||'—')}</code></td>
    <td><div class="action-btns">
      <button class="btn-edit"   onclick="openProductModal('${escHtml(String(p.id))}')">Edit</button>
      <button class="btn-delete" onclick="deleteProduct('${escHtml(String(p.id))}')">Del</button>
    </div></td>
  </tr>`).join('');
}

// ── PRODUCT MODAL ──────────────────────────
function openProductModal(id = null) {
  ['p-name','p-category','p-price','p-barcode'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('p-stock').value = '0';
  document.getElementById('edit-row-id').value = '';
  document.getElementById('modal-title').textContent = 'Add Product';
  if (id) {
    const p = products.find(x => String(x.id) === String(id));
    if (p) {
      document.getElementById('modal-title').textContent = 'Edit Product';
      document.getElementById('edit-row-id').value  = p.id;
      document.getElementById('p-name').value       = p.name;
      document.getElementById('p-category').value   = p.category || '';
      document.getElementById('p-price').value      = p.price;
      document.getElementById('p-stock').value      = p.stock;
      document.getElementById('p-barcode').value    = p.barcode || '';
    }
  }
  document.getElementById('product-modal').classList.add('open');
}
function closeProductModal() { document.getElementById('product-modal').classList.remove('open'); }
function closeModalOnOverlay(e) { if (e.target === document.getElementById('product-modal')) closeProductModal(); }

async function saveProduct() {
  const name  = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  if (!name || isNaN(price)) { showToast('Name and Price are required', 'error'); return; }
  const data = {
    id:       document.getElementById('edit-row-id').value || ('p_' + Date.now()),
    name,
    category: document.getElementById('p-category').value.trim(),
    price,
    stock:    parseInt(document.getElementById('p-stock').value) || 0,
    barcode:  document.getElementById('p-barcode').value.trim()
  };
  showToast('Saving…');
  closeProductModal();
  await noCorsPOST({ action: 'saveProduct', ...data });
  showToast('Saved! Refreshing…', 'success');
  await loadProducts();
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  showToast('Deleting…');
  await noCorsPOST({ action: 'deleteProduct', id });
  showToast('Deleted', 'success');
  await loadProducts();
}

// ── CART ───────────────────────────────────
function addToCart(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  if (parseInt(p.stock) <= 0) { showToast('Out of stock!', 'error'); return; }
  const ex = cart.find(c => c.id === id);
  if (ex) ex.qty++;
  else cart.push({ id: p.id, name: p.name, price: parseFloat(p.price), qty: 1 });
  renderCart(); recalc();
}

function changeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  renderCart(); recalc();
}

function clearCart() {
  cart = [];
  renderCart(); recalc();
  ['customer-name','sale-note','cash-received'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('discount-val').value = 0;
  document.getElementById('change-due').textContent = config.currency + '0.00';
}

function renderCart() {
  const el = document.getElementById('cart-items');
  if (!cart.length) { el.innerHTML = '<div class="empty-cart">No items yet.<br/>Tap a product to add.</div>'; return; }
  el.innerHTML = cart.map(item => `<div class="cart-item">
    <div>
      <div class="cart-item-name">${escHtml(item.name)}</div>
      <div class="cart-item-price">${config.currency}${(item.price*item.qty).toFixed(2)}</div>
    </div>
    <div class="qty-controls">
      <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
      <span class="qty-num">${item.qty}</span>
      <button class="qty-btn" onclick="changeQty('${item.id}',1)">+</button>
    </div>
  </div>`).join('');
}

function recalc() {
  const sub  = cart.reduce((s,i) => s + i.price*i.qty, 0);
  const dv   = parseFloat(document.getElementById('discount-val').value) || 0;
  const dt   = document.getElementById('discount-type').value;
  const tax  = parseFloat(config.taxRate) || 0;
  const disc = dt === 'pct' ? sub*(dv/100) : Math.min(dv, sub);
  const after = sub - disc;
  const taxAmt = after * (tax/100);
  const total  = after + taxAmt;
  document.getElementById('subtotal').textContent    = config.currency + sub.toFixed(2);
  document.getElementById('tax-label').textContent   = tax;
  document.getElementById('tax-amount').textContent  = config.currency + taxAmt.toFixed(2);
  document.getElementById('grand-total').textContent = config.currency + total.toFixed(2);
  calcChange();
}

function calcChange() {
  const total = parseFloat(document.getElementById('grand-total').textContent.replace(/[^0-9.]/g,'')) || 0;
  const recv  = parseFloat(document.getElementById('cash-received').value) || 0;
  document.getElementById('change-due').textContent = config.currency + Math.max(0, recv-total).toFixed(2);
}

function selectPayment(btn) {
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPayment = btn.dataset.method;
  document.getElementById('cash-input-wrap').style.display = currentPayment === 'Cash' ? 'block' : 'none';
}

// ── CHECKOUT ───────────────────────────────
async function checkout() {
  if (!cart.length) { showToast('Cart is empty', 'error'); return; }
  const sub  = cart.reduce((s,i) => s + i.price*i.qty, 0);
  const dv   = parseFloat(document.getElementById('discount-val').value) || 0;
  const dt   = document.getElementById('discount-type').value;
  const tax  = parseFloat(config.taxRate) || 0;
  const disc = dt === 'pct' ? sub*(dv/100) : Math.min(dv, sub);
  const after = sub - disc;
  const taxAmt = after*(tax/100);
  const total  = after + taxAmt;
  const sale = {
    id: 'sale_' + Date.now(),
    datetime: new Date().toISOString(),
    customer: document.getElementById('customer-name').value.trim() || 'Walk-in',
    items: cart.map(i => `${i.name} x${i.qty}`).join('; '),
    itemsDetail: JSON.stringify(cart),
    payment: currentPayment,
    subtotal: sub.toFixed(2),
    discount: disc.toFixed(2),
    tax: taxAmt.toFixed(2),
    total: total.toFixed(2),
    note: document.getElementById('sale-note').value.trim()
  };
  showToast('Recording sale…');
  await noCorsPOST({ action: 'recordSale', ...sale });
  showToast('Sale complete ✓', 'success');
  showReceipt(sale);
  clearCart();
  setTimeout(loadProducts, 2000);
}

// ── RECEIPT ────────────────────────────────
function showReceipt(sale) {
  const line   = '─'.repeat(32);
  const center = (s, w=32) => ' '.repeat(Math.max(0, Math.floor((w-s.length)/2))) + s;
  const items  = JSON.parse(sale.itemsDetail || '[]');
  const itemLines = items.map(i =>
    `${i.name.substring(0,20).padEnd(20)} x${i.qty}  ${config.currency}${(i.price*i.qty).toFixed(2)}`
  ).join('\n');
  const r = [
    center(config.shopName),
    center(new Date(sale.datetime).toLocaleString()),
    line, itemLines, line,
    `${'Subtotal'.padEnd(22)}${config.currency}${sale.subtotal}`,
    `${'Discount'.padEnd(22)}-${config.currency}${sale.discount}`,
    `${'Tax'.padEnd(22)}${config.currency}${sale.tax}`,
    line,
    `${'TOTAL'.padEnd(22)}${config.currency}${sale.total}`,
    line,
    `Payment: ${sale.payment}`,
    `Customer: ${sale.customer}`,
    sale.note ? `Note: ${sale.note}` : null,
    line,
    center(config.receiptMsg || 'Thank you!'),
    center('Ref: ' + sale.id.slice(-8))
  ].filter(x => x !== null).join('\n');
  document.getElementById('receipt-content').textContent = r;
  document.getElementById('receipt-modal').classList.add('open');
}
function printReceipt()  { window.print(); }
function closeReceipt()  { document.getElementById('receipt-modal').classList.remove('open'); }
function closeReceiptOnOverlay(e) { if (e.target === document.getElementById('receipt-modal')) closeReceipt(); }

// ── SALES ──────────────────────────────────
async function loadSales() {
  const from  = document.getElementById('sales-date-from').value;
  const to    = document.getElementById('sales-date-to').value;
  const tbody = document.getElementById('sales-tbody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px">⏳ Loading…</td></tr>';
  try {
    const res = await jsonpCall({ action: 'getSales', from, to });
    if (res.success) { sales = res.data || []; renderSalesTable(); updateSumCards(); }
    else tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger)">Error: ${res.error}</td></tr>`;
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger)">${e.message}</td></tr>`;
  }
}

function renderSalesTable() {
  const tbody = document.getElementById('sales-tbody');
  if (!sales.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">No sales in this period</td></tr>'; return; }
  tbody.innerHTML = [...sales].reverse().map(s => `<tr>
    <td>${new Date(s.datetime).toLocaleString()}</td>
    <td>${escHtml(s.customer)}</td>
    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.items)}</td>
    <td>${escHtml(s.payment)}</td>
    <td>${config.currency}${parseFloat(s.discount||0).toFixed(2)}</td>
    <td>${config.currency}${parseFloat(s.tax||0).toFixed(2)}</td>
    <td><strong>${config.currency}${parseFloat(s.total).toFixed(2)}</strong></td>
    <td>${escHtml(s.note||'')}</td>
  </tr>`).join('');
}

function updateSumCards() {
  const today = new Date().toISOString().split('T')[0];
  const ts    = sales.filter(s => String(s.datetime).startsWith(today));
  const tt    = ts.reduce((a,s) => a+parseFloat(s.total||0), 0);
  const at    = sales.reduce((a,s) => a+parseFloat(s.total||0), 0);
  document.getElementById('sum-today').textContent = config.currency + tt.toFixed(2);
  document.getElementById('sum-count').textContent = sales.length;
  document.getElementById('sum-avg').textContent   = config.currency + (sales.length ? (at/sales.length).toFixed(2) : '0.00');
}

function exportCSV() {
  if (!sales.length) { showToast('No data to export', 'error'); return; }
  const h = ['Date/Time','Customer','Items','Payment','Subtotal','Discount','Tax','Total','Note'];
  const rows = sales.map(s => [s.datetime,s.customer,`"${s.items}"`,s.payment,s.subtotal,s.discount,s.tax,s.total,`"${s.note||''}"`]);
  const csv  = [h,...rows].map(r => r.join(',')).join('\n');
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `sales_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ── SETTINGS ───────────────────────────────
function openSettings() {
  document.getElementById('s-shop-name').value   = config.shopName || '';
  document.getElementById('s-currency').value    = config.currency || '$';
  document.getElementById('s-tax').value         = config.taxRate  || 0;
  document.getElementById('s-receipt-msg').value = config.receiptMsg || 'Thank you for your purchase!';
  document.getElementById('s-script-url').value  = config.scriptUrl || '';
  document.getElementById('settings-modal').classList.add('open');
}
function saveSettings() {
  config.shopName   = document.getElementById('s-shop-name').value.trim()  || config.shopName;
  config.currency   = document.getElementById('s-currency').value.trim()   || '$';
  config.taxRate    = parseFloat(document.getElementById('s-tax').value)    || 0;
  config.receiptMsg = document.getElementById('s-receipt-msg').value.trim();
  config.scriptUrl  = document.getElementById('s-script-url').value.trim() || config.scriptUrl;
  localStorage.setItem('shopdesk_config', JSON.stringify(config));
  document.getElementById('topbar-shop').textContent = config.shopName;
  document.getElementById('tax-label').textContent   = config.taxRate;
  closeSettings(); recalc();
  showToast('Settings saved!', 'success');
}
function closeSettings() { document.getElementById('settings-modal').classList.remove('open'); }
function closeSettingsOnOverlay(e) { if (e.target === document.getElementById('settings-modal')) closeSettings(); }

// ── TABS ───────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'sales')    loadSales();
  if (tab === 'products') renderProductsTable();
}

// ── UTILS ──────────────────────────────────
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' '+type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

// ── QUICK LOOKUP ────────────────────────────
function openLookup() {
  document.getElementById('lookup-input').value = '';
  document.getElementById('lookup-results').innerHTML = '<div class="lookup-empty">Start typing to search products…</div>';
  document.getElementById('lookup-modal').classList.add('open');
  setTimeout(() => document.getElementById('lookup-input').focus(), 100);
}

function closeLookup() {
  document.getElementById('lookup-modal').classList.remove('open');
}

function closeLookupOnOverlay(e) {
  if (e.target === document.getElementById('lookup-modal')) closeLookup();
}

function runLookup() {
  const query   = document.getElementById('lookup-input').value.trim().toLowerCase();
  const results = document.getElementById('lookup-results');

  if (!query) {
    results.innerHTML = '<div class="lookup-empty">Start typing to search products…</div>';
    return;
  }

  const found = products.filter(p =>
    p.name.toLowerCase().includes(query) ||
    (p.category && p.category.toLowerCase().includes(query)) ||
    (p.barcode  && String(p.barcode).toLowerCase().includes(query))
  );

  if (!found.length) {
    results.innerHTML = `<div class="lookup-no-results">❌ No product found for "<strong>${escHtml(query)}</strong>"</div>`;
    return;
  }

  results.innerHTML = found.map(p => {
    const stock = parseInt(p.stock) || 0;
    const stockClass = stock <= 0 ? 'out' : stock <= 5 ? 'low' : 'ok';
    const stockLabel = stock <= 0 ? 'Out of Stock' : stock <= 5 ? `Low: ${stock} left` : `In Stock: ${stock}`;
    return `
      <div class="lookup-item">
        <div class="lookup-item-left">
          <div class="lookup-item-name">${escHtml(p.name)}</div>
          <div class="lookup-item-meta">
            ${p.category ? '📁 ' + escHtml(p.category) : ''}
            ${p.barcode  ? ' &nbsp;|&nbsp; 🏷 ' + escHtml(String(p.barcode)) : ''}
          </div>
          <button class="lookup-add-btn" onclick="addFromLookup('${escHtml(String(p.id))}')">+ Add to Cart</button>
        </div>
        <div class="lookup-item-right">
          <div class="lookup-item-price">${config.currency}${parseFloat(p.price).toFixed(2)}</div>
          <div class="lookup-item-stock ${stockClass}">${stockLabel}</div>
        </div>
      </div>`;
  }).join('');
}

function addFromLookup(id) {
  addToCart(id);
  closeLookup();
  // switch to sell tab if not already there
  switchTab('sell');
  showToast('Added to cart!', 'success');
}
