# 🧾 BizOps — Business Management SPA

A lightweight, premium Single-Page Application for small business management — track inventory, calculate Cost of Goods Sold (HPP), record sales, and analyze Profit & Loss reports.

Built with **Vanilla JS** + **Supabase** (PostgreSQL). No frameworks, no build tools — just open and run.

---

## ✨ Features

| Module | What it does |
|--------|-------------|
| **Dashboard** | Today's revenue, cost, profit stats · 7-day trend chart · Low stock alerts · Top selling products |
| **Bahan Mentah** | CRUD raw materials · Track stock levels · Low stock warnings · Add stock feature |
| **Produk** | Manage products · Dynamic recipe builder · Live HPP (COGS) calculation · Profit margin display |
| **Penjualan** | POS-style cart interface · Per-item profit breakdown · Automatic stock deduction |
| **Laporan** | Daily / Weekly / Monthly P&L · Revenue vs Cost vs Profit charts · Export to Excel (4 sheets) |

### Additional Features
- 🔔 Toast notifications & confirmation dialogs
- 📱 Fully responsive (mobile-friendly)
- 💾 Backup & import data (JSON)
- 📊 Excel export with P&L Summary, Sales Detail, Products & HPP, Stock Report
- 🎨 Warm Minimal light mode design (cream, coral, sage green palette)

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+ Modules), HTML5, CSS3
- **Backend:** [Supabase](https://supabase.com) (PostgreSQL + REST API)
- **Charts:** [Chart.js](https://www.chartjs.org/)
- **Icons:** [Lucide Icons](https://lucide.dev/)
- **Excel Export:** [SheetJS](https://sheetjs.com/)
- **No build step** — all libraries loaded via CDN

---

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/A-mn-khsym28/effective-umbrella.git
cd effective-umbrella
```

### 2. Setup Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a **New Project**
3. Go to **SQL Editor** (left sidebar)
4. Copy the entire contents of `supabase-schema.sql` → Paste → Click **Run**
5. Go to **Settings → API** and copy your:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

> ⚠️ **Important:** You must run the SQL schema before using the app. It creates all tables, indexes, triggers, and the atomic sale processing function.

### 3. Start the app

```bash
# Option 1: Node.js
npx -y http-server . -p 8080 -c-1 --cors

# Option 2: Python
python3 -m http.server 8080
```

Open **http://localhost:8080** in your browser.

### 4. Connect to Supabase

On first launch, you'll see a config screen. Paste your **Supabase URL** and **anon key**, then click **Connect**. Credentials are saved in your browser's `localStorage` (not in the code).

---

## 📖 How to Use

### Step 1: Add Raw Materials (Bahan Mentah)

Go to **Bahan Mentah** → Click **+ Tambah Bahan**

Fill in:
- **Nama Bahan** — e.g. "Tepung Terigu"
- **Satuan** — e.g. "kg"
- **Harga per Unit** — e.g. 12000
- **Stok Awal** — e.g. 50
- **Minimum Stok** — e.g. 10 (triggers low stock alert)

### Step 2: Create Products (Produk)

Go to **Produk** → Click **+ Tambah Produk**

Fill in:
- **Nama Produk** — e.g. "Risol Mayo"
- **Harga Jual** — e.g. 15000

Build the recipe:
- Click **+ Tambah Bahan** to add ingredients
- Select a raw material and enter qty per piece
- The **HPP (COGS)** is calculated live as you add ingredients
- A warning appears if selling price < HPP (selling at a loss)

### Step 3: Record Sales (Penjualan)

Go to **Penjualan** → Click **+ Transaksi Baru**

- Select a product from the dropdown
- Set quantity → Click **+** to add to cart
- The cart shows per-item HPP, selling price, and profit
- Click **Simpan Penjualan** to record

> Raw material stock is automatically deducted based on the product recipe. If stock is insufficient, the sale is blocked.

### Step 4: View Reports (Laporan)

Go to **Laporan**

- Switch between **Harian** (daily), **Mingguan** (weekly), **Bulanan** (monthly)
- Use the date picker to view different periods
- See total Revenue, Cost, Profit, and Margin
- View the breakdown per product with individual margins
- Check current stock values

### Step 5: Export to Excel

On the **Laporan** page, click **Export Excel**. The downloaded `.xlsx` file contains 4 sheets:

| Sheet | Content |
|-------|---------|
| P&L Summary | Total revenue, cost, profit, margin |
| Detail Penjualan | Every sale item with prices and profit |
| Produk & HPP | All products with COGS breakdown |
| Stok Bahan Mentah | Current stock levels and values |

---

## 📁 Project Structure

```
├── index.html              # SPA layout & CDN imports
├── style.css               # Design system (Warm Minimal theme)
├── app.js                  # Router, state, Toast/Confirm/Modal utilities
├── db.js                   # Supabase client & CRUD operations
├── supabase-schema.sql     # Database schema & RPC functions
└── modules/
    ├── dashboard.js         # Dashboard stats & charts
    ├── materials.js         # Raw material management
    ├── products.js          # Product & recipe builder
    ├── sales.js             # POS sales interface
    └── reports.js           # P&L reports & Excel export
```

---

## 🗄️ Database Schema

| Table | Purpose |
|-------|---------|
| `materials` | Raw materials with stock tracking |
| `products` | Products with selling prices |
| `recipes` | Links products to materials (qty per piece) |
| `sales` | Sale transactions with totals |
| `sales_items` | Individual items in each sale |

Key function: `process_sale` — an atomic RPC that records the sale and deducts material stock in a single transaction.

---

## 🔐 Security Notes

- Supabase credentials are stored in browser `localStorage`, not in the codebase
- Row Level Security (RLS) is enabled with permissive policies (suitable for single-user or trusted environments)
- For production use, add authentication and restrict RLS policies

---

## 📄 License

MIT — free to use, modify, and distribute.
