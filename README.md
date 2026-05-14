# ShopDesk POS 🛒
**Free Point-of-Sale system — Google Sheets backend + GitHub Pages hosting**

No monthly fees. No subscriptions. Your data lives in your own Google Sheet.

---

## 📁 Files
| File | Purpose |
|------|---------|
| `index.html` | Main POS app |
| `style.css` | Stylesheet |
| `app.js` | App logic |
| `google-apps-script.gs` | Paste into Google Apps Script |

---

## 🚀 Setup in 3 Steps

### Step 1 — Set up Google Sheets Backend

1. Go to [sheets.google.com](https://sheets.google.com) and create a **new spreadsheet**
2. Name it something like **"ShopDesk POS Data"**
3. Click **Extensions → Apps Script**
4. Delete all existing code in the editor
5. Open the file `google-apps-script.gs` from this repo, copy all of it, and paste it into the Apps Script editor
6. Click **Save** (💾 icon)
7. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy** → authorize if prompted → **Copy the Web App URL**

> ⚠️ The URL looks like: `https://script.google.com/macros/s/AKf.../exec`

---

### Step 2 — Host on GitHub Pages (Free)

1. Create a free account at [github.com](https://github.com)
2. Click **New Repository** → name it `my-pos` (or anything)
3. Upload these 3 files: `index.html`, `style.css`, `app.js`
4. Go to **Settings → Pages**
5. Under **Source**, select **Deploy from branch → main → / (root)**
6. Click **Save** — your POS will be live at:
   `https://YOUR-USERNAME.github.io/my-pos`

---

### Step 3 — Connect Everything

1. Open your GitHub Pages URL in any browser
2. Paste your **Apps Script Web App URL** into the setup screen
3. Enter your **Shop Name** and **Currency Symbol**
4. Click **Launch POS →**

Done! Your POS is live and connected to your Google Sheet. 🎉

---

## ✅ Features

- **Sell Tab** — Add products to cart, apply discounts, accept Cash/Card/Mobile payment, print receipts
- **Products Tab** — Add, edit, delete products with categories, pricing, and stock tracking
- **Sales Tab** — View sales history with date filters, daily totals, and CSV export
- **Auto stock deduction** — Stock counts update in Google Sheet after every sale
- **Settings** — Change shop name, currency, tax rate, receipt message at any time
- **Works on mobile** — Responsive layout works on tablet and phone browsers

---

## 🔒 Privacy & Cost

| Item | Cost |
|------|------|
| Google Sheets | Free (up to 15 GB) |
| Google Apps Script | Free (6 min/execution, 20k calls/day) |
| GitHub Pages | Free (1 GB storage, 100 GB/month bandwidth) |
| **Total** | **$0/month** |

Your data stays 100% in your own Google account. Nothing is shared with any third party.

---

## 🛠 Customization Tips

- **Add more categories**: Just type a category when adding a product
- **Change tax rate**: Go to ⚙ Settings in the POS
- **Barcode scanner**: Any USB/Bluetooth barcode scanner that types text will work with the search bar
- **Multiple devices**: The same GitHub Pages URL works on any device — all data syncs via Google Sheets
- **Backup**: Your Google Sheet IS the database — share it, download it as Excel anytime

---

## ❓ Troubleshooting

**"Connection failed" error**
- Re-check your Apps Script URL in Settings (⚙)
- Make sure the deployment is set to "Anyone" can access
- Try redeploying as a new version in Apps Script

**Products not loading**
- Open your Google Sheet — the "Products" tab should have been created automatically
- If not, redeploy the Apps Script

**Sale recorded but stock not updating**
- This is normal on the first sale after adding products — refresh the Products tab

---

Built with ❤️ — free forever.
