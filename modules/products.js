// ============================================
// BizOps — Products Module (with Recipe Builder)
// ============================================

const ProductsModule = (() => {
    let products = [];
    let allMaterials = [];

    async function load() {
        const container = document.getElementById('products-content');

        try {
            products = await DB.Products.getAll();
            allMaterials = await DB.Materials.getAll();
            render(container);
        } catch (e) {
            container.innerHTML = `<div class="alert alert-danger"><i data-lucide="alert-circle"></i><span>Gagal memuat data: ${e.message}</span></div>`;
            lucide.createIcons();
        }

        document.getElementById('btn-add-product').onclick = () => showForm();
    }

    function render(container) {
        if (products.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-lucide="package"></i></div>
                    <h3>Belum Ada Produk</h3>
                    <p>Tambahkan produk yang Anda jual, lengkap dengan resep bahan mentahnya.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('btn-add-product').click()">
                        <i data-lucide="plus"></i> Tambah Produk
                    </button>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nama Produk</th>
                            <th class="text-right">Harga Jual</th>
                            <th class="text-right">HPP / pcs</th>
                            <th class="text-right">Profit / pcs</th>
                            <th>Margin</th>
                            <th>Bahan</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => {
                            const hpp = DB.Products.calculateHPP(p.recipes);
                            const profit = p.selling_price - hpp;
                            const margin = p.selling_price > 0 ? ((profit / p.selling_price) * 100).toFixed(1) : 0;
                            const isLoss = profit < 0;

                            return `
                                <tr>
                                    <td class="fw-bold">${p.name}</td>
                                    <td class="text-right currency">${DB.formatCurrency(p.selling_price)}</td>
                                    <td class="text-right currency text-purple">${DB.formatCurrency(hpp)}</td>
                                    <td class="text-right currency fw-bold ${isLoss ? 'text-danger' : 'text-success'}">${DB.formatCurrency(profit)}</td>
                                    <td>
                                        <span class="badge ${isLoss ? 'badge-danger' : margin >= 30 ? 'badge-success' : 'badge-warning'}">
                                            ${margin}%
                                        </span>
                                    </td>
                                    <td class="text-muted text-sm">${p.recipes ? p.recipes.length : 0} bahan</td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn btn-ghost btn-icon" onclick="ProductsModule.showDetail('${p.id}')" title="Detail">
                                                <i data-lucide="eye"></i>
                                            </button>
                                            <button class="btn btn-ghost btn-icon" onclick="ProductsModule.showForm('${p.id}')" title="Edit">
                                                <i data-lucide="pencil"></i>
                                            </button>
                                            <button class="btn btn-ghost btn-icon" onclick="ProductsModule.confirmDelete('${p.id}', '${p.name}')" title="Hapus">
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
        `;

        lucide.createIcons();
    }

    function showForm(id = null) {
        const product = id ? products.find(p => p.id === id) : null;
        const isEdit = !!product;
        const title = isEdit ? 'Edit Produk' : 'Tambah Produk';

        const existingRecipes = product?.recipes || [];

        const bodyHtml = `
            <form id="product-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Nama Produk *</label>
                        <input type="text" class="form-input" id="prod-name" value="${product?.name || ''}" placeholder="Contoh: Kopi Latte" required>
                        <div class="form-error" id="prod-name-error">Nama produk wajib diisi</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Harga Jual (Rp) *</label>
                        <input type="number" class="form-input" id="prod-price" value="${product?.selling_price || ''}" placeholder="0" min="0" step="500">
                        <div class="form-error" id="prod-price-error">Harga jual wajib diisi</div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Resep Bahan (per 1 pcs produk)</label>
                    <div id="recipe-list" class="recipe-list">
                        <!-- Recipe rows will be populated here -->
                    </div>
                    <button type="button" class="btn btn-ghost btn-sm" id="add-recipe-row">
                        <i data-lucide="plus"></i> Tambah Bahan
                    </button>
                </div>

                <div class="recipe-hpp-display" id="hpp-display">
                    <div class="hpp-label">HPP per pcs (kalkulasi otomatis)</div>
                    <div class="hpp-value" id="hpp-value">Rp0</div>
                </div>

                <div id="margin-warning" style="display:none;" class="alert alert-danger mt-md">
                    <i data-lucide="alert-triangle"></i>
                    <span>Harga jual lebih rendah dari HPP! Produk ini akan <strong>merugi</strong>.</span>
                </div>
            </form>
        `;

        const footerHtml = `
            <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" id="prod-save-btn">
                <i data-lucide="check"></i>
                <span>${isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}</span>
            </button>
        `;

        Modal.show(title, bodyHtml, footerHtml, { large: true });

        // Populate existing recipes
        const recipeListEl = document.getElementById('recipe-list');
        if (existingRecipes.length > 0) {
            existingRecipes.forEach(r => {
                addRecipeRow(recipeListEl, r.material_id, r.qty_per_pcs);
            });
        }

        // Add recipe row button
        document.getElementById('add-recipe-row').addEventListener('click', () => {
            addRecipeRow(recipeListEl);
        });

        // Save button
        document.getElementById('prod-save-btn').addEventListener('click', () => saveProduct(id));

        // Live HPP calculation
        document.getElementById('prod-price')?.addEventListener('input', recalcHPP);

        recalcHPP();
    }

    function addRecipeRow(listEl, materialId = '', qty = '') {
        const row = document.createElement('div');
        row.className = 'recipe-row';

        const materialOptions = allMaterials.map(m =>
            `<option value="${m.id}" ${m.id === materialId ? 'selected' : ''}>${m.name} (${DB.formatCurrency(m.price_per_unit)}/${m.unit})</option>`
        ).join('');

        row.innerHTML = `
            <select class="form-select recipe-material" onchange="ProductsModule.recalcHPP()">
                <option value="">-- Pilih Bahan --</option>
                ${materialOptions}
            </select>
            <input type="number" class="form-input recipe-qty" placeholder="Qty" value="${qty}" min="0.0001" step="0.01" onchange="ProductsModule.recalcHPP()" oninput="ProductsModule.recalcHPP()">
            <button type="button" class="btn btn-ghost btn-icon btn-xs" onclick="this.closest('.recipe-row').remove(); ProductsModule.recalcHPP();" title="Hapus">
                <i data-lucide="x"></i>
            </button>
        `;

        listEl.appendChild(row);
        lucide.createIcons();
    }

    function recalcHPP() {
        const rows = document.querySelectorAll('.recipe-row');
        let hpp = 0;

        rows.forEach(row => {
            const matId = row.querySelector('.recipe-material')?.value;
            const qty = parseFloat(row.querySelector('.recipe-qty')?.value) || 0;
            if (matId) {
                const mat = allMaterials.find(m => m.id === matId);
                if (mat) {
                    hpp += mat.price_per_unit * qty;
                }
            }
        });

        const hppEl = document.getElementById('hpp-value');
        if (hppEl) hppEl.textContent = DB.formatCurrency(hpp);

        // Check margin
        const sellingPrice = parseFloat(document.getElementById('prod-price')?.value) || 0;
        const warningEl = document.getElementById('margin-warning');
        if (warningEl) {
            warningEl.style.display = sellingPrice > 0 && sellingPrice < hpp ? 'flex' : 'none';
            lucide.createIcons();
        }
    }

    async function saveProduct(id) {
        const name = document.getElementById('prod-name').value.trim();
        const price = parseFloat(document.getElementById('prod-price').value);

        // Validate
        let valid = true;
        if (!name) {
            document.getElementById('prod-name').classList.add('error');
            document.getElementById('prod-name-error').classList.add('visible');
            valid = false;
        }
        if (isNaN(price) || price < 0) {
            document.getElementById('prod-price').classList.add('error');
            document.getElementById('prod-price-error').classList.add('visible');
            valid = false;
        }
        if (!valid) return;

        // Gather recipes
        const recipes = [];
        const rows = document.querySelectorAll('.recipe-row');
        rows.forEach(row => {
            const matId = row.querySelector('.recipe-material')?.value;
            const qty = parseFloat(row.querySelector('.recipe-qty')?.value) || 0;
            if (matId && qty > 0) {
                recipes.push({ material_id: matId, qty_per_pcs: qty });
            }
        });

        const productData = { name, selling_price: price };

        try {
            if (id) {
                await DB.Products.update(id, productData, recipes);
                Toast.show('Produk berhasil diperbarui', 'success');
            } else {
                await DB.Products.create(productData, recipes);
                Toast.show('Produk berhasil ditambahkan', 'success');
            }
            Modal.close();
            load();
        } catch (e) {
            Toast.show('Gagal menyimpan: ' + e.message, 'error');
        }
    }

    function showDetail(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;

        const hpp = DB.Products.calculateHPP(product.recipes);
        const profit = product.selling_price - hpp;
        const margin = product.selling_price > 0 ? ((profit / product.selling_price) * 100).toFixed(1) : 0;

        const bodyHtml = `
            <div class="stats-grid" style="margin-bottom: var(--space-lg);">
                <div class="glass-card stat-card" style="padding:var(--space-md);">
                    <div class="stat-label">Harga Jual</div>
                    <div class="stat-value text-accent" style="font-size:1.3rem;">${DB.formatCurrency(product.selling_price)}</div>
                </div>
                <div class="glass-card stat-card" style="padding:var(--space-md);">
                    <div class="stat-label">HPP / pcs</div>
                    <div class="stat-value text-purple" style="font-size:1.3rem;">${DB.formatCurrency(hpp)}</div>
                </div>
                <div class="glass-card stat-card" style="padding:var(--space-md);">
                    <div class="stat-label">Profit / pcs</div>
                    <div class="stat-value ${profit >= 0 ? 'text-success' : 'text-danger'}" style="font-size:1.3rem;">${DB.formatCurrency(profit)}</div>
                </div>
            </div>

            <h4 style="margin-bottom:var(--space-md); font-size:0.9rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Resep per 1 pcs</h4>
            ${product.recipes && product.recipes.length > 0 ? `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Bahan</th>
                                <th class="text-right">Qty</th>
                                <th class="text-right">Harga/Unit</th>
                                <th class="text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${product.recipes.map(r => {
                                const matName = r.materials?.name || 'Unknown';
                                const matPrice = r.materials?.price_per_unit || 0;
                                const matUnit = r.materials?.unit || '';
                                const sub = matPrice * r.qty_per_pcs;
                                return `
                                    <tr>
                                        <td>${matName}</td>
                                        <td class="text-right">${DB.formatNumber(r.qty_per_pcs)} ${matUnit}</td>
                                        <td class="text-right currency">${DB.formatCurrency(matPrice)}</td>
                                        <td class="text-right currency fw-bold">${DB.formatCurrency(sub)}</td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr style="background:rgba(168,85,247,0.05);">
                                <td colspan="3" class="fw-bold">Total HPP</td>
                                <td class="text-right currency fw-bold text-purple">${DB.formatCurrency(hpp)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-muted text-sm">Belum ada resep.</p>'}

            <div style="margin-top:var(--space-lg); padding:var(--space-md); background:rgba(255,255,255,0.02); border-radius:var(--radius-md); display:flex; justify-content:space-between;">
                <span class="text-muted text-sm">Profit Margin</span>
                <span class="badge ${profit < 0 ? 'badge-danger' : margin >= 30 ? 'badge-success' : 'badge-warning'}">${margin}%</span>
            </div>
        `;

        Modal.show(`Detail: ${product.name}`, bodyHtml, '', { large: true });
    }

    function confirmDelete(id, name) {
        Confirm.show(
            'Hapus Produk',
            `Yakin ingin menghapus "${name}"? Produk yang sudah punya riwayat penjualan tidak bisa dihapus.`,
            async () => {
                try {
                    await DB.Products.delete(id);
                    Toast.show(`"${name}" berhasil dihapus`, 'success');
                    load();
                } catch (e) {
                    Toast.show('Gagal menghapus: ' + e.message, 'error');
                }
            }
        );
    }

    return { load, showForm, showDetail, confirmDelete, recalcHPP };
})();
