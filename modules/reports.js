// ============================================
// BizOps — Reports Module (P&L + Excel Export)
// ============================================

const ReportsModule = (() => {
    let currentPeriod = 'daily';
    let currentData = null;
    let plChart = null;

    async function load() {
        const container = document.getElementById('reports-content');

        container.innerHTML = `
            <!-- Period Tabs -->
            <div class="tab-bar" id="report-tabs">
                <button class="tab-btn active" data-period="daily">Harian</button>
                <button class="tab-btn" data-period="weekly">Mingguan</button>
                <button class="tab-btn" data-period="monthly">Bulanan</button>
            </div>

            <!-- Date Filter -->
            <div class="filter-bar" id="report-filter">
                <label class="text-sm text-muted">Tanggal:</label>
                <input type="date" class="date-input" id="report-date" value="${DB.DateHelper.formatDateInput()}">
                <button class="btn btn-ghost btn-sm" id="report-refresh">
                    <i data-lucide="refresh-cw"></i>
                    <span>Refresh</span>
                </button>
            </div>

            <!-- Report Content -->
            <div id="report-body">
                <div class="skeleton-grid">
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card skeleton-wide"></div>
                </div>
            </div>
        `;

        lucide.createIcons();

        // Setup tab buttons
        document.querySelectorAll('#report-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#report-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentPeriod = btn.dataset.period;
                loadReport();
            });
        });

        document.getElementById('report-refresh').addEventListener('click', loadReport);
        document.getElementById('report-date').addEventListener('change', loadReport);

        // Setup Excel export button
        document.getElementById('btn-export-excel').onclick = exportToExcel;

        loadReport();
    }

    async function loadReport() {
        const body = document.getElementById('report-body');
        body.innerHTML = `<div class="skeleton-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card skeleton-wide"></div></div>`;

        try {
            const { startDate, endDate, periodLabel } = getDateRange();
            const summary = await DB.Sales.getSummary(startDate, endDate);
            const materials = await DB.Materials.getAll();
            currentData = { summary, materials, periodLabel, startDate, endDate };

            renderReport(body, currentData);
        } catch (e) {
            body.innerHTML = `<div class="alert alert-danger"><i data-lucide="alert-circle"></i><span>Gagal memuat laporan: ${e.message}</span></div>`;
            lucide.createIcons();
        }
    }

    function getDateRange() {
        const selectedDate = document.getElementById('report-date')?.value;
        const baseDate = selectedDate ? new Date(selectedDate) : new Date();

        let startDate, endDate, periodLabel;

        switch (currentPeriod) {
            case 'daily': {
                const d = new Date(baseDate);
                d.setHours(0, 0, 0, 0);
                startDate = d.toISOString();
                const e = new Date(baseDate);
                e.setHours(23, 59, 59, 999);
                endDate = e.toISOString();
                periodLabel = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                break;
            }
            case 'weekly': {
                const d = new Date(baseDate);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                d.setDate(diff);
                d.setHours(0, 0, 0, 0);
                startDate = d.toISOString();
                const e = new Date(d);
                e.setDate(e.getDate() + 6);
                e.setHours(23, 59, 59, 999);
                endDate = e.toISOString();
                periodLabel = `${DB.DateHelper.formatDate(startDate)} — ${DB.DateHelper.formatDate(endDate)}`;
                break;
            }
            case 'monthly': {
                const d = new Date(baseDate);
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
                startDate = d.toISOString();
                const e = new Date(d);
                e.setMonth(e.getMonth() + 1);
                e.setDate(0);
                e.setHours(23, 59, 59, 999);
                endDate = e.toISOString();
                periodLabel = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                break;
            }
        }

        return { startDate, endDate, periodLabel };
    }

    function renderReport(body, data) {
        const { summary, materials, periodLabel } = data;
        const margin = summary.totalRevenue > 0 ? ((summary.totalProfit / summary.totalRevenue) * 100).toFixed(1) : 0;

        // Aggregate products
        const productMap = {};
        summary.sales.forEach(sale => {
            (sale.sales_items || []).forEach(item => {
                const key = item.product_id;
                if (!productMap[key]) {
                    productMap[key] = {
                        name: item.products?.name || 'Unknown',
                        qty: 0,
                        revenue: 0,
                        cost: 0,
                        profit: 0
                    };
                }
                productMap[key].qty += item.qty;
                productMap[key].revenue += item.selling_price_at_time * item.qty;
                productMap[key].cost += item.cost_per_pcs * item.qty;
                productMap[key].profit += (item.selling_price_at_time - item.cost_per_pcs) * item.qty;
            });
        });
        const productList = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

        body.innerHTML = `
            <!-- Period Label -->
            <div class="d-flex align-center gap-md mb-lg">
                <i data-lucide="calendar" style="width:18px; height:18px; color:var(--text-muted);"></i>
                <span class="text-sm text-muted">${periodLabel}</span>
            </div>

            <!-- Summary Stats -->
            <div class="stats-grid">
                <div class="glass-card stat-card revenue">
                    <div class="stat-icon"><i data-lucide="trending-up"></i></div>
                    <div class="stat-value">${DB.formatCurrency(summary.totalRevenue)}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
                <div class="glass-card stat-card cost">
                    <div class="stat-icon"><i data-lucide="wallet"></i></div>
                    <div class="stat-value">${DB.formatCurrency(summary.totalCost)}</div>
                    <div class="stat-label">Total Modal (HPP)</div>
                </div>
                <div class="glass-card stat-card ${summary.totalProfit >= 0 ? 'profit' : 'loss'}">
                    <div class="stat-icon"><i data-lucide="${summary.totalProfit >= 0 ? 'piggy-bank' : 'trending-down'}"></i></div>
                    <div class="stat-value ${summary.totalProfit >= 0 ? 'text-success' : 'text-danger'}">${DB.formatCurrency(summary.totalProfit)}</div>
                    <div class="stat-label">Total Profit</div>
                </div>
                <div class="glass-card stat-card">
                    <div class="stat-icon" style="background:var(--warning-subtle);"><i data-lucide="percent" style="color:var(--warning);"></i></div>
                    <div class="stat-value">${margin}%</div>
                    <div class="stat-label">Profit Margin</div>
                </div>
            </div>

            <!-- P&L Chart -->
            <div class="glass-card mb-lg">
                <h3 style="margin-bottom:var(--space-md); font-size:1rem;">Revenue vs Modal vs Profit</h3>
                <div class="chart-container" style="height:280px;">
                    <canvas id="pl-chart"></canvas>
                </div>
            </div>

            <!-- P&L Detail Table -->
            <div class="glass-card mb-lg">
                <h3 style="margin-bottom:var(--space-md); font-size:1rem;">Detail Penjualan per Produk</h3>
                ${productList.length === 0 ? `
                    <div class="empty-state" style="padding:var(--space-lg);">
                        <p class="text-sm text-muted">Tidak ada data penjualan pada periode ini.</p>
                    </div>
                ` : `
                    <div class="table-container" style="border:none;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Produk</th>
                                    <th class="text-right">Qty Terjual</th>
                                    <th class="text-right">Revenue</th>
                                    <th class="text-right">Modal (HPP)</th>
                                    <th class="text-right">Profit</th>
                                    <th class="text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${productList.map(p => {
                                    const m = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : 0;
                                    return `
                                        <tr>
                                            <td class="fw-bold">${p.name}</td>
                                            <td class="text-right">${DB.formatNumber(p.qty)}</td>
                                            <td class="text-right currency">${DB.formatCurrency(p.revenue)}</td>
                                            <td class="text-right currency text-muted">${DB.formatCurrency(p.cost)}</td>
                                            <td class="text-right currency fw-bold ${p.profit >= 0 ? 'text-success' : 'text-danger'}">${DB.formatCurrency(p.profit)}</td>
                                            <td class="text-right">
                                                <span class="badge ${p.profit < 0 ? 'badge-danger' : m >= 30 ? 'badge-success' : 'badge-warning'}">${m}%</span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                                <tr style="background:var(--bg-hover); font-weight:700;">
                                    <td>TOTAL</td>
                                    <td class="text-right">${DB.formatNumber(productList.reduce((s, p) => s + p.qty, 0))}</td>
                                    <td class="text-right currency text-accent">${DB.formatCurrency(summary.totalRevenue)}</td>
                                    <td class="text-right currency text-purple">${DB.formatCurrency(summary.totalCost)}</td>
                                    <td class="text-right currency ${summary.totalProfit >= 0 ? 'text-success' : 'text-danger'}">${DB.formatCurrency(summary.totalProfit)}</td>
                                    <td class="text-right"><span class="badge badge-accent">${margin}%</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- All Transactions -->
            <div class="glass-card mb-lg">
                <h3 style="margin-bottom:var(--space-md); font-size:1rem;">Semua Transaksi (${summary.count})</h3>
                ${summary.count === 0 ? `
                    <p class="text-sm text-muted">Tidak ada transaksi.</p>
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
                                </tr>
                            </thead>
                            <tbody>
                                ${summary.sales.map(s => {
                                    const items = (s.sales_items || []).map(i => `${i.products?.name || '?'} ×${i.qty}`).join(', ');
                                    return `
                                        <tr>
                                            <td class="text-sm">${DB.DateHelper.formatDateTime(s.created_at)}</td>
                                            <td class="text-sm" style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${items}">${items}</td>
                                            <td class="text-right currency">${DB.formatCurrency(s.total_revenue)}</td>
                                            <td class="text-right currency text-muted">${DB.formatCurrency(s.total_cost)}</td>
                                            <td class="text-right currency fw-bold ${s.total_profit >= 0 ? 'text-success' : 'text-danger'}">${DB.formatCurrency(s.total_profit)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- Current Stock -->
            <div class="glass-card">
                <h3 style="margin-bottom:var(--space-md); font-size:1rem;">Stok Bahan Mentah Saat Ini</h3>
                <div class="table-container" style="border:none;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Bahan</th>
                                <th class="text-right">Stok</th>
                                <th>Satuan</th>
                                <th class="text-right">Harga/Unit</th>
                                <th class="text-right">Nilai Stok</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${materials.map(m => {
                                const isLow = m.stock < m.min_stock;
                                const stockValue = m.stock * m.price_per_unit;
                                return `
                                    <tr>
                                        <td class="fw-bold">${m.name}</td>
                                        <td class="text-right ${isLow ? 'text-danger fw-bold' : ''}">${DB.formatNumber(m.stock)}</td>
                                        <td>${m.unit}</td>
                                        <td class="text-right currency">${DB.formatCurrency(m.price_per_unit)}</td>
                                        <td class="text-right currency">${DB.formatCurrency(stockValue)}</td>
                                        <td>${isLow ? '<span class="badge badge-danger">Low</span>' : '<span class="badge badge-success">OK</span>'}</td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr style="background:var(--bg-hover); font-weight:700;">
                                <td colspan="4">Total Nilai Stok</td>
                                <td class="text-right currency text-accent">${DB.formatCurrency(materials.reduce((s, m) => s + m.stock * m.price_per_unit, 0))}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        lucide.createIcons();
        renderPLChart(productList);
    }

    function renderPLChart(productList) {
        const ctx = document.getElementById('pl-chart');
        if (!ctx) return;
        if (plChart) plChart.destroy();

        if (productList.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-sm text-muted text-center" style="padding:var(--space-xl);">Tidak ada data untuk ditampilkan.</p>';
            return;
        }

        plChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: productList.map(p => p.name),
                datasets: [
                    {
                        label: 'Revenue',
                        data: productList.map(p => p.revenue),
                        backgroundColor: 'rgba(232, 97, 77, 0.65)',
                        borderColor: '#e8614d',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Modal (HPP)',
                        data: productList.map(p => p.cost),
                        backgroundColor: 'rgba(196, 101, 58, 0.45)',
                        borderColor: '#c4653a',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Profit',
                        data: productList.map(p => p.profit),
                        backgroundColor: productList.map(p => p.profit >= 0 ? 'rgba(107, 155, 125, 0.55)' : 'rgba(217, 79, 79, 0.55)'),
                        borderColor: productList.map(p => p.profit >= 0 ? '#6b9b7d' : '#d94f4f'),
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#6b6b6b',
                            font: { family: 'Inter', size: 12 },
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#1a1a1a',
                        bodyColor: '#6b6b6b',
                        titleFont: { family: 'Inter', weight: '600' },
                        bodyFont: { family: 'Inter' },
                        borderColor: '#e8e4de',
                        borderWidth: 1,
                        callbacks: {
                            label: ctx => ctx.dataset.label + ': ' + DB.formatCurrency(ctx.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9a9a9a', font: { family: 'Inter', size: 11 } },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: '#9a9a9a',
                            font: { family: 'Inter', size: 11 },
                            callback: v => DB.formatCurrency(v)
                        },
                        grid: { color: '#f0ece6' }
                    }
                }
            }
        });
    }

    // ---- Excel Export ----
    async function exportToExcel() {
        if (!currentData) {
            Toast.show('Muat laporan terlebih dahulu', 'warning');
            return;
        }

        try {
            Toast.show('Menyiapkan file Excel...', 'info');

            const wb = XLSX.utils.book_new();
            const { summary, materials, periodLabel } = currentData;

            // Sheet 1: P&L Summary
            const plRows = [
                ['LAPORAN PROFIT & LOSS'],
                ['Periode', periodLabel],
                [''],
                ['Metrik', 'Jumlah (Rp)'],
                ['Total Revenue', summary.totalRevenue],
                ['Total Modal (HPP)', summary.totalCost],
                ['Total Profit', summary.totalProfit],
                ['Jumlah Transaksi', summary.count],
                ['Profit Margin (%)', summary.totalRevenue > 0 ? ((summary.totalProfit / summary.totalRevenue) * 100).toFixed(1) : 0],
            ];
            const plSheet = XLSX.utils.aoa_to_sheet(plRows);
            XLSX.utils.book_append_sheet(wb, plSheet, 'P&L Summary');

            // Sheet 2: Detail Penjualan
            const saleRows = [['Waktu', 'Produk', 'Qty', 'Harga Jual', 'HPP/pcs', 'Revenue', 'Modal', 'Profit']];
            summary.sales.forEach(sale => {
                (sale.sales_items || []).forEach(item => {
                    saleRows.push([
                        DB.DateHelper.formatDateTime(sale.created_at),
                        item.products?.name || 'Unknown',
                        item.qty,
                        item.selling_price_at_time,
                        item.cost_per_pcs,
                        item.selling_price_at_time * item.qty,
                        item.cost_per_pcs * item.qty,
                        (item.selling_price_at_time - item.cost_per_pcs) * item.qty
                    ]);
                });
            });
            const salesSheet = XLSX.utils.aoa_to_sheet(saleRows);
            XLSX.utils.book_append_sheet(wb, salesSheet, 'Detail Penjualan');

            // Sheet 3: Produk & HPP
            const products = await DB.Products.getAll();
            const prodRows = [['Nama Produk', 'Harga Jual', 'HPP/pcs', 'Profit/pcs', 'Margin (%)']];
            products.forEach(p => {
                const hpp = DB.Products.calculateHPP(p.recipes);
                const profit = p.selling_price - hpp;
                const m = p.selling_price > 0 ? ((profit / p.selling_price) * 100).toFixed(1) : 0;
                prodRows.push([p.name, p.selling_price, hpp, profit, m]);
            });
            const prodSheet = XLSX.utils.aoa_to_sheet(prodRows);
            XLSX.utils.book_append_sheet(wb, prodSheet, 'Produk & HPP');

            // Sheet 4: Stok Bahan Mentah
            const matRows = [['Nama Bahan', 'Satuan', 'Harga/Unit', 'Stok', 'Min Stok', 'Nilai Stok', 'Status']];
            materials.forEach(m => {
                matRows.push([
                    m.name, m.unit, m.price_per_unit, m.stock, m.min_stock,
                    m.stock * m.price_per_unit,
                    m.stock < m.min_stock ? 'LOW STOCK' : 'OK'
                ]);
            });
            const matSheet = XLSX.utils.aoa_to_sheet(matRows);
            XLSX.utils.book_append_sheet(wb, matSheet, 'Stok Bahan Mentah');

            // Download
            const fileName = `BizOps-Report-${currentPeriod}-${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            Toast.show('File Excel berhasil diunduh! 📊', 'success');

        } catch (e) {
            Toast.show('Gagal export Excel: ' + e.message, 'error');
        }
    }

    return { load };
})();
