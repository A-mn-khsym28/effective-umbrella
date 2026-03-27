// ============================================
// BizOps — Sales (POS-style) Module
// ============================================

const SalesModule = (() => {
    let products = [];
    let cart = [];
    let salesHistory = [];

    async function load() {
        const container = document.getElementById('sales-content');

        try {
            products = await DB.Products.getAll();
            const todayStart = DB.DateHelper.todayStart();
            const todayEnd = DB.DateHelper.todayEnd();
            salesHistory = await DB.Sales.getAll(todayStart, todayEnd);
            render(container);
        } catch (e) {
            container.innerHTML = `<div class="alert alert-danger"><i data-lucide="alert-circle"></i><span>Gagal memuat data: ${e.message}</span></div>`;
            lucide.createIcons();
        }

        document.getElementById('btn-new-sale').onclick = () => showNewSaleModal();
    }

    function render(container) {
        container.innerHTML = `
            <!-- Today's Sales History -->
            <div class="glass-card mb-lg" style="padding: var(--space-md);">
                <div class="d-flex align-center" style="justify-content:space-between; margin-bottom:var(--space-md);">
                    <h3 style="font-size:1rem;">Penjualan Hari Ini</h3>
                    <span class="badge badge-accent">${salesHistory.length} transaksi</span>
                </div>
                ${salesHistory.length === 0 ? `
                    <div class="empty-state" style="padding:var(--space-lg);">
                        <div class="empty-state-icon"><i data-lucide="shopping-cart"></i></div>
                        <h3>Belum Ada Penjualan</h3>
                        <p>Klik "Transaksi Baru" untuk mencatat penjualan.</p>
                    </div>
                ` : `
                    <div class="table-container" style="border:none;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Waktu</th>
                                    <th>Item</th>
                                    <th class="text-right">Revenue</th>
                                    <th class="text-right">Modal</th>
                                    <th class="text-right">Profit</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${salesHistory.map(sale => {
                                    const itemSummary = sale.sales_items
                                        ? sale.sales_items.map(i => `${i.products?.name || '?'} ×${i.qty}`).join(', ')
                                        : '-';
                                    return `
                                        <tr>
                                            <td class="text-sm">${DB.DateHelper.formatDateTime(sale.created_at)}</td>
                                            <td class="text-sm" style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${itemSummary}">${itemSummary}</td>
                                            <td class="text-right currency">${DB.formatCurrency(sale.total_revenue)}</td>
                                            <td class="text-right currency text-muted">${DB.formatCurrency(sale.total_cost)}</td>
                                            <td class="text-right currency fw-bold ${sale.total_profit >= 0 ? 'text-success' : 'text-danger'}">${DB.formatCurrency(sale.total_profit)}</td>
                                            <td>
                                                <div class="table-actions">
                                                    <button class="btn btn-ghost btn-icon btn-xs" onclick="SalesModule.showSaleDetail('${sale.id}')" title="Detail">
                                                        <i data-lucide="eye"></i>
                                                    </button>
                                                    <button class="btn btn-ghost btn-icon btn-xs" onclick="SalesModule.confirmDeleteSale('${sale.id}')" title="Hapus">
                                                        <i data-lucide="trash-2"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;

        lucide.createIcons();
    }

    function showNewSaleModal() {
        if (products.length === 0) {
            Toast.show('Tambahkan produk terlebih dahulu', 'warning');
            return;
        }

        cart = [];

        const productOptions = products.map(p => {
            const hpp = DB.Products.calculateHPP(p.recipes);
            return `<option value="${p.id}" data-price="${p.selling_price}" data-hpp="${hpp}">${p.name} — ${DB.formatCurrency(p.selling_price)}</option>`;
        }).join('');

        const bodyHtml = `
            <div class="pos-layout" style="grid-template-columns:1fr;">
                <!-- Add Item Section -->
                <div class="glass-card mb-md" style="padding:var(--space-md);">
                    <h4 style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:var(--space-md);">Tambah Item</h4>
                    <div style="display:grid; grid-template-columns:1fr 80px auto; gap:var(--space-sm); align-items:end;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Produk</label>
                            <select class="form-select" id="sale-product">
                                <option value="">-- Pilih Produk --</option>
                                ${productOptions}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Qty</label>
                            <input type="number" class="form-input" id="sale-qty" value="1" min="1" step="1">
                        </div>
                        <button class="btn btn-primary btn-sm" id="sale-add-item" style="margin-bottom:0; height:42px;">
                            <i data-lucide="plus"></i>
                        </button>
                    </div>
                </div>

                <!-- Cart -->
                <div class="glass-card" style="padding:0;">
                    <div style="padding: var(--space-md) var(--space-lg);">
                        <h4 style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Keranjang</h4>
                    </div>
                    <div id="cart-items">
                        <div class="empty-state" style="padding:var(--space-lg);">
                            <p class="text-sm text-muted">Keranjang kosong</p>
                        </div>
                    </div>
                    <div class="cart-summary" id="cart-summary" style="display:none;">
                        <div class="cart-summary-row">
                            <span>Revenue</span>
                            <span id="cart-revenue" class="currency">Rp0</span>
                        </div>
                        <div class="cart-summary-row">
                            <span>Total Modal (HPP)</span>
                            <span id="cart-cost" class="currency cost-value">Rp0</span>
                        </div>
                        <div class="cart-summary-row total">
                            <span>Profit</span>
                            <span id="cart-profit" class="currency profit-value">Rp0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
            <button class="btn btn-success" id="sale-submit">
                <i data-lucide="check-circle"></i>
                <span>Simpan Penjualan</span>
            </button>
        `;

        Modal.show('Transaksi Baru', bodyHtml, footerHtml, { large: true });

        document.getElementById('sale-add-item').addEventListener('click', addToCart);
        document.getElementById('sale-submit').addEventListener('click', submitSale);

        // Allow Enter key on qty input
        document.getElementById('sale-qty').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addToCart();
            }
        });
    }

    function addToCart() {
        const select = document.getElementById('sale-product');
        const qtyInput = document.getElementById('sale-qty');
        const productId = select.value;
        const qty = parseInt(qtyInput.value) || 0;

        if (!productId) {
            Toast.show('Pilih produk terlebih dahulu', 'warning');
            return;
        }
        if (qty <= 0) {
            Toast.show('Jumlah harus lebih dari 0', 'warning');
            return;
        }

        const product = products.find(p => p.id === productId);
        if (!product) return;

        const hpp = DB.Products.calculateHPP(product.recipes);

        // Check if product already in cart
        const existing = cart.find(c => c.product_id === productId);
        if (existing) {
            existing.qty += qty;
        } else {
            cart.push({
                product_id: productId,
                name: product.name,
                selling_price_at_time: product.selling_price,
                cost_per_pcs: hpp,
                qty: qty
            });
        }

        // Reset
        select.value = '';
        qtyInput.value = '1';
        select.focus();

        renderCart();
    }

    function renderCart() {
        const itemsEl = document.getElementById('cart-items');
        const summaryEl = document.getElementById('cart-summary');

        if (cart.length === 0) {
            itemsEl.innerHTML = `<div class="empty-state" style="padding:var(--space-lg);"><p class="text-sm text-muted">Keranjang kosong</p></div>`;
            summaryEl.style.display = 'none';
            return;
        }

        let totalRevenue = 0;
        let totalCost = 0;

        itemsEl.innerHTML = cart.map((item, idx) => {
            const subtotalRev = item.selling_price_at_time * item.qty;
            const subtotalCost = item.cost_per_pcs * item.qty;
            const subtotalProfit = subtotalRev - subtotalCost;
            totalRevenue += subtotalRev;
            totalCost += subtotalCost;

            return `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-meta">
                            Harga: ${DB.formatCurrency(item.selling_price_at_time)} | 
                            HPP: ${DB.formatCurrency(item.cost_per_pcs)} | 
                            Profit: <span class="${subtotalProfit >= 0 ? 'text-success' : 'text-danger'}">${DB.formatCurrency(subtotalProfit)}</span>
                        </div>
                    </div>
                    <div class="cart-item-qty">
                        <button class="btn btn-ghost btn-xs" onclick="SalesModule.updateCartQty(${idx}, ${item.qty - 1})">−</button>
                        <input type="number" value="${item.qty}" readonly style="width:40px; text-align:center; padding:4px; background:var(--bg-page); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font-family:var(--font); font-size:0.85rem;">
                        <button class="btn btn-ghost btn-xs" onclick="SalesModule.updateCartQty(${idx}, ${item.qty + 1})">+</button>
                    </div>
                    <div class="cart-item-subtotal">${DB.formatCurrency(subtotalRev)}</div>
                    <button class="btn btn-ghost btn-icon btn-xs" onclick="SalesModule.removeFromCart(${idx})">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            `;
        }).join('');

        const totalProfit = totalRevenue - totalCost;
        summaryEl.style.display = 'block';
        document.getElementById('cart-revenue').textContent = DB.formatCurrency(totalRevenue);
        document.getElementById('cart-cost').textContent = DB.formatCurrency(totalCost);
        const profitEl = document.getElementById('cart-profit');
        profitEl.textContent = DB.formatCurrency(totalProfit);
        profitEl.className = `currency ${totalProfit >= 0 ? 'profit-value text-success' : 'text-danger'}`;

        lucide.createIcons();
    }

    function updateCartQty(index, newQty) {
        if (newQty <= 0) {
            cart.splice(index, 1);
        } else {
            cart[index].qty = newQty;
        }
        renderCart();
    }

    function removeFromCart(index) {
        cart.splice(index, 1);
        renderCart();
    }

    async function submitSale() {
        if (cart.length === 0) {
            Toast.show('Keranjang masih kosong', 'warning');
            return;
        }

        const items = cart.map(c => ({
            product_id: c.product_id,
            qty: c.qty,
            selling_price_at_time: c.selling_price_at_time,
            cost_per_pcs: c.cost_per_pcs
        }));

        try {
            await DB.Sales.processSale(items);
            Toast.show('Penjualan berhasil dicatat! 🎉', 'success');
            cart = [];
            Modal.close();
            load();
        } catch (e) {
            const msg = e.message || 'Gagal menyimpan penjualan';
            if (msg.includes('Stok bahan') || msg.includes('tidak mencukupi')) {
                Toast.show('Stok bahan mentah tidak mencukupi untuk pesanan ini', 'error');
            } else {
                Toast.show('Gagal: ' + msg, 'error');
            }
        }
    }

    function showSaleDetail(saleId) {
        const sale = salesHistory.find(s => s.id === saleId);
        if (!sale) return;

        const bodyHtml = `
            <div class="stats-grid" style="margin-bottom:var(--space-lg); grid-template-columns:1fr 1fr 1fr;">
                <div class="glass-card" style="padding:var(--space-md); text-align:center;">
                    <div class="text-xs text-muted" style="text-transform:uppercase; letter-spacing:0.04em;">Revenue</div>
                    <div class="fw-extrabold text-accent" style="font-size:1.1rem;">${DB.formatCurrency(sale.total_revenue)}</div>
                </div>
                <div class="glass-card" style="padding:var(--space-md); text-align:center;">
                    <div class="text-xs text-muted" style="text-transform:uppercase; letter-spacing:0.04em;">Modal</div>
                    <div class="fw-extrabold text-purple" style="font-size:1.1rem;">${DB.formatCurrency(sale.total_cost)}</div>
                </div>
                <div class="glass-card" style="padding:var(--space-md); text-align:center;">
                    <div class="text-xs text-muted" style="text-transform:uppercase; letter-spacing:0.04em;">Profit</div>
                    <div class="fw-extrabold ${sale.total_profit >= 0 ? 'text-success' : 'text-danger'}" style="font-size:1.1rem;">${DB.formatCurrency(sale.total_profit)}</div>
                </div>
            </div>

            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th class="text-right">Qty</th>
                            <th class="text-right">Harga Jual</th>
                            <th class="text-right">HPP/pcs</th>
                            <th class="text-right">Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(sale.sales_items || []).map(item => {
                            const itemProfit = (item.selling_price_at_time - item.cost_per_pcs) * item.qty;
                            return `
                                <tr>
                                    <td class="fw-bold">${item.products?.name || 'Unknown'}</td>
                                    <td class="text-right">${item.qty}</td>
                                    <td class="text-right currency">${DB.formatCurrency(item.selling_price_at_time)}</td>
                                    <td class="text-right currency text-muted">${DB.formatCurrency(item.cost_per_pcs)}</td>
                                    <td class="text-right currency fw-bold ${itemProfit >= 0 ? 'text-success' : 'text-danger'}">${DB.formatCurrency(itemProfit)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="text-sm text-muted mt-md">
                Waktu: ${DB.DateHelper.formatDateTime(sale.created_at)}
            </div>
        `;

        Modal.show('Detail Transaksi', bodyHtml, '', { large: true });
    }

    function confirmDeleteSale(saleId) {
        Confirm.show(
            'Hapus Transaksi',
            'Yakin ingin menghapus transaksi ini? Stok bahan TIDAK akan dikembalikan secara otomatis.',
            async () => {
                try {
                    await DB.Sales.delete(saleId);
                    Toast.show('Transaksi berhasil dihapus', 'success');
                    load();
                } catch (e) {
                    Toast.show('Gagal menghapus: ' + e.message, 'error');
                }
            }
        );
    }

    return { load, updateCartQty, removeFromCart, showSaleDetail, confirmDeleteSale };
})();
