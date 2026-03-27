// ============================================
// BizOps — Materials (Bahan Mentah) Module
// ============================================

const MaterialsModule = (() => {
    let materials = [];

    async function load() {
        const container = document.getElementById('materials-content');

        try {
            materials = await DB.Materials.getAll();
            render(container);
        } catch (e) {
            container.innerHTML = `<div class="alert alert-danger"><i data-lucide="alert-circle"></i><span>Gagal memuat data: ${e.message}</span></div>`;
            lucide.createIcons();
        }

        // Setup add button
        document.getElementById('btn-add-material').onclick = () => showForm();
    }

    function render(container) {
        if (materials.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-lucide="boxes"></i></div>
                    <h3>Belum Ada Bahan Mentah</h3>
                    <p>Tambahkan bahan mentah yang digunakan untuk membuat produk Anda.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('btn-add-material').click()">
                        <i data-lucide="plus"></i> Tambah Bahan
                    </button>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        const lowStockCount = materials.filter(m => m.stock < m.min_stock).length;

        container.innerHTML = `
            ${lowStockCount > 0 ? `
                <div class="alert alert-warning">
                    <i data-lucide="alert-triangle"></i>
                    <span><strong>${lowStockCount} bahan</strong> memiliki stok di bawah minimum!</span>
                </div>
            ` : ''}
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nama Bahan</th>
                            <th>Satuan</th>
                            <th class="text-right">Harga/Unit</th>
                            <th class="text-right">Stok</th>
                            <th class="text-right">Min. Stok</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${materials.map(m => {
                            const isLow = m.stock < m.min_stock;
                            return `
                                <tr>
                                    <td class="fw-bold">${m.name}</td>
                                    <td>${m.unit}</td>
                                    <td class="text-right currency">${DB.formatCurrency(m.price_per_unit)}</td>
                                    <td class="text-right fw-bold ${isLow ? 'text-danger' : ''}">${DB.formatNumber(m.stock)}</td>
                                    <td class="text-right text-muted">${DB.formatNumber(m.min_stock)}</td>
                                    <td>
                                        ${isLow
                                            ? '<span class="badge badge-danger"><i data-lucide="alert-triangle"></i> Low</span>'
                                            : '<span class="badge badge-success"><i data-lucide="check"></i> OK</span>'
                                        }
                                    </td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn btn-ghost btn-icon" onclick="MaterialsModule.showForm('${m.id}')" title="Edit">
                                                <i data-lucide="pencil"></i>
                                            </button>
                                            <button class="btn btn-ghost btn-icon" onclick="MaterialsModule.addStock('${m.id}')" title="Tambah Stok">
                                                <i data-lucide="package-plus"></i>
                                            </button>
                                            <button class="btn btn-ghost btn-icon" onclick="MaterialsModule.confirmDelete('${m.id}', '${m.name}')" title="Hapus">
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
        const material = id ? materials.find(m => m.id === id) : null;
        const isEdit = !!material;
        const title = isEdit ? 'Edit Bahan Mentah' : 'Tambah Bahan Mentah';

        const bodyHtml = `
            <form id="material-form">
                <div class="form-group">
                    <label class="form-label">Nama Bahan *</label>
                    <input type="text" class="form-input" id="mat-name" value="${material?.name || ''}" placeholder="Contoh: Tepung Terigu" required>
                    <div class="form-error" id="mat-name-error">Nama bahan wajib diisi</div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Satuan *</label>
                        <input type="text" class="form-input" id="mat-unit" value="${material?.unit || ''}" placeholder="kg, ltr, pcs">
                        <div class="form-error" id="mat-unit-error">Satuan wajib diisi</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Harga per Unit (Rp) *</label>
                        <input type="number" class="form-input" id="mat-price" value="${material?.price_per_unit || ''}" placeholder="0" min="0" step="100">
                        <div class="form-error" id="mat-price-error">Harga harus angka positif</div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Stok Awal</label>
                        <input type="number" class="form-input" id="mat-stock" value="${material?.stock || '0'}" placeholder="0" min="0" step="0.01">
                        <div class="form-error" id="mat-stock-error">Stok harus angka positif</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Minimum Stok</label>
                        <input type="number" class="form-input" id="mat-minstock" value="${material?.min_stock || '0'}" placeholder="0" min="0" step="0.01">
                    </div>
                </div>
            </form>
        `;

        const footerHtml = `
            <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" id="mat-save-btn">
                <i data-lucide="check"></i>
                <span>${isEdit ? 'Simpan Perubahan' : 'Tambah Bahan'}</span>
            </button>
        `;

        Modal.show(title, bodyHtml, footerHtml);

        document.getElementById('mat-save-btn').addEventListener('click', () => saveMaterial(id));
    }

    async function saveMaterial(id) {
        const name = document.getElementById('mat-name').value.trim();
        const unit = document.getElementById('mat-unit').value.trim();
        const price = parseFloat(document.getElementById('mat-price').value);
        const stock = parseFloat(document.getElementById('mat-stock').value) || 0;
        const minStock = parseFloat(document.getElementById('mat-minstock').value) || 0;

        // Validate
        let valid = true;
        if (!name) {
            document.getElementById('mat-name').classList.add('error');
            document.getElementById('mat-name-error').classList.add('visible');
            valid = false;
        }
        if (!unit) {
            document.getElementById('mat-unit').classList.add('error');
            document.getElementById('mat-unit-error').classList.add('visible');
            valid = false;
        }
        if (isNaN(price) || price < 0) {
            document.getElementById('mat-price').classList.add('error');
            document.getElementById('mat-price-error').classList.add('visible');
            valid = false;
        }
        if (stock < 0) {
            document.getElementById('mat-stock').classList.add('error');
            document.getElementById('mat-stock-error').classList.add('visible');
            valid = false;
        }

        if (!valid) return;

        const data = {
            name,
            unit,
            price_per_unit: price,
            stock,
            min_stock: minStock
        };

        try {
            if (id) {
                await DB.Materials.update(id, data);
                Toast.show('Bahan berhasil diperbarui', 'success');
            } else {
                await DB.Materials.create(data);
                Toast.show('Bahan berhasil ditambahkan', 'success');
            }
            Modal.close();
            load();
        } catch (e) {
            Toast.show('Gagal menyimpan: ' + e.message, 'error');
        }
    }

    function addStock(id) {
        const material = materials.find(m => m.id === id);
        if (!material) return;

        const bodyHtml = `
            <p class="mb-md">Tambah stok untuk <strong>${material.name}</strong></p>
            <p class="text-sm text-muted mb-lg">Stok saat ini: ${DB.formatNumber(material.stock)} ${material.unit}</p>
            <div class="form-group">
                <label class="form-label">Jumlah Tambahan</label>
                <input type="number" class="form-input" id="add-stock-qty" placeholder="0" min="0.01" step="0.01" autofocus>
            </div>
            <div class="form-group">
                <label class="form-label">Harga Beli per Unit Baru (opsional)</label>
                <input type="number" class="form-input" id="add-stock-price" placeholder="${material.price_per_unit}" min="0" step="100">
                <div class="form-hint">Kosongkan jika harga tidak berubah</div>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
            <button class="btn btn-success" id="add-stock-save">
                <i data-lucide="package-plus"></i>
                <span>Tambah Stok</span>
            </button>
        `;

        Modal.show('Tambah Stok', bodyHtml, footerHtml);

        document.getElementById('add-stock-save').addEventListener('click', async () => {
            const qty = parseFloat(document.getElementById('add-stock-qty').value);
            const newPrice = document.getElementById('add-stock-price').value;

            if (isNaN(qty) || qty <= 0) {
                Toast.show('Jumlah harus lebih dari 0', 'error');
                return;
            }

            const updates = { stock: material.stock + qty };
            if (newPrice && !isNaN(parseFloat(newPrice))) {
                updates.price_per_unit = parseFloat(newPrice);
            }

            try {
                await DB.Materials.update(id, updates);
                Toast.show(`+${DB.formatNumber(qty)} ${material.unit} ditambahkan ke ${material.name}`, 'success');
                Modal.close();
                load();
            } catch (e) {
                Toast.show('Gagal menambah stok: ' + e.message, 'error');
            }
        });
    }

    function confirmDelete(id, name) {
        Confirm.show(
            'Hapus Bahan',
            `Yakin ingin menghapus "${name}"? Bahan yang digunakan dalam resep tidak bisa dihapus.`,
            async () => {
                try {
                    await DB.Materials.delete(id);
                    Toast.show(`"${name}" berhasil dihapus`, 'success');
                    load();
                } catch (e) {
                    Toast.show('Gagal menghapus: ' + e.message, 'error');
                }
            }
        );
    }

    return { load, showForm, addStock, confirmDelete };
})();
