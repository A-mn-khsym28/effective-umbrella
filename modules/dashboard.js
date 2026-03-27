// ============================================
// BizOps — Dashboard Module
// ============================================

const DashboardModule = (() => {
    let trendChart = null;

    async function load() {
        const container = document.getElementById('dashboard-content');
        const dateEl = document.getElementById('dashboard-date');

        // Set date header
        dateEl.textContent = new Date().toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        try {
            // Fetch today's summary
            const todayStart = DB.DateHelper.todayStart();
            const todayEnd = DB.DateHelper.todayEnd();
            const todaySummary = await DB.Sales.getSummary(todayStart, todayEnd);

            // Fetch low stock materials
            const allMaterials = await DB.Materials.getAll();
            const lowStock = allMaterials.filter(m => m.stock < m.min_stock);

            // Fetch 7-day trend
            const trendData = await get7DayTrend();

            // Fetch top products
            const topProducts = await getTopProducts(todayStart, todayEnd);

            container.innerHTML = `
                <!-- Stats Cards -->
                <div class="stats-grid">
                    <div class="glass-card stat-card revenue">
                        <div class="stat-icon"><i data-lucide="trending-up"></i></div>
                        <div class="stat-value">${DB.formatCurrency(todaySummary.totalRevenue)}</div>
                        <div class="stat-label">Revenue Hari Ini</div>
                    </div>
                    <div class="glass-card stat-card cost">
                        <div class="stat-icon"><i data-lucide="wallet"></i></div>
                        <div class="stat-value">${DB.formatCurrency(todaySummary.totalCost)}</div>
                        <div class="stat-label">Modal / HPP</div>
                    </div>
                    <div class="glass-card stat-card ${todaySummary.totalProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="stat-icon"><i data-lucide="${todaySummary.totalProfit >= 0 ? 'piggy-bank' : 'trending-down'}"></i></div>
                        <div class="stat-value ${todaySummary.totalProfit >= 0 ? 'text-success' : 'text-danger'}">${DB.formatCurrency(todaySummary.totalProfit)}</div>
                        <div class="stat-label">Profit Hari Ini</div>
                    </div>
                    <div class="glass-card stat-card">
                        <div class="stat-icon" style="background:var(--warning-subtle);"><i data-lucide="shopping-bag" style="color:var(--warning);"></i></div>
                        <div class="stat-value">${todaySummary.count}</div>
                        <div class="stat-label">Transaksi Hari Ini</div>
                    </div>
                </div>

                <!-- Trend Chart + Low Stock -->
                <div style="display:grid; grid-template-columns: 2fr 1fr; gap: var(--space-lg); margin-bottom: var(--space-xl);">
                    <div class="glass-card">
                        <h3 style="margin-bottom: var(--space-md); font-size: 1rem;">Trend Revenue & Profit 7 Hari</h3>
                        <div class="chart-container" style="height: 260px;">
                            <canvas id="trend-chart"></canvas>
                        </div>
                    </div>
                    <div class="glass-card">
                        <h3 style="margin-bottom: var(--space-md); font-size: 1rem;">
                            <span class="d-flex align-center gap-sm">
                                <i data-lucide="alert-circle" style="width:18px;height:18px;color:var(--warning);"></i>
                                Stok Rendah (${lowStock.length})
                            </span>
                        </h3>
                        <div style="max-height: 240px; overflow-y: auto;">
                            ${lowStock.length === 0 ? `
                                <div class="empty-state" style="padding:var(--space-lg);">
                                    <p class="text-sm text-muted">Semua stok aman 👍</p>
                                </div>
                            ` : lowStock.map(m => `
                                <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-light);">
                                    <div>
                                        <div style="font-size:0.85rem; font-weight:600;">
                                            <span class="low-stock-dot"></span>
                                            ${m.name}
                                        </div>
                                        <div class="text-xs text-muted">Min: ${DB.formatNumber(m.min_stock)} ${m.unit}</div>
                                    </div>
                                    <span class="badge badge-danger">${DB.formatNumber(m.stock)} ${m.unit}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Top Products Today -->
                <div class="glass-card">
                    <h3 style="margin-bottom: var(--space-md); font-size: 1rem;">Produk Terlaris Hari Ini</h3>
                    ${topProducts.length === 0 ? `
                        <div class="empty-state" style="padding:var(--space-lg);">
                            <p class="text-sm text-muted">Belum ada penjualan hari ini</p>
                        </div>
                    ` : `
                        <div class="table-container" style="border:none;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Produk</th>
                                        <th class="text-right">Qty Terjual</th>
                                        <th class="text-right">Revenue</th>
                                        <th class="text-right">Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topProducts.map(p => `
                                        <tr>
                                            <td class="fw-bold">${p.name}</td>
                                            <td class="text-right">${DB.formatNumber(p.totalQty)}</td>
                                            <td class="text-right currency">${DB.formatCurrency(p.totalRevenue)}</td>
                                            <td class="text-right currency ${p.totalProfit >= 0 ? 'text-success' : 'text-danger'}">${DB.formatCurrency(p.totalProfit)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            `;

            lucide.createIcons();
            renderTrendChart(trendData);

        } catch (e) {
            console.error('Dashboard error:', e);
            container.innerHTML = `<div class="alert alert-danger"><i data-lucide="alert-circle"></i><span>Gagal memuat dashboard: ${e.message}</span></div>`;
            lucide.createIcons();
        }
    }

    async function get7DayTrend() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const start = d.toISOString();
            const end = new Date(d);
            end.setHours(23, 59, 59, 999);

            const summary = await DB.Sales.getSummary(start, end.toISOString());

            days.push({
                label: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
                revenue: summary.totalRevenue,
                cost: summary.totalCost,
                profit: summary.totalProfit
            });
        }
        return days;
    }

    async function getTopProducts(startDate, endDate) {
        const sales = await DB.Sales.getAll(startDate, endDate);
        const productMap = {};

        sales.forEach(sale => {
            if (sale.sales_items) {
                sale.sales_items.forEach(item => {
                    const key = item.product_id;
                    if (!productMap[key]) {
                        productMap[key] = {
                            name: item.products?.name || 'Unknown',
                            totalQty: 0,
                            totalRevenue: 0,
                            totalProfit: 0
                        };
                    }
                    productMap[key].totalQty += item.qty;
                    productMap[key].totalRevenue += item.selling_price_at_time * item.qty;
                    productMap[key].totalProfit += (item.selling_price_at_time - item.cost_per_pcs) * item.qty;
                });
            }
        });

        return Object.values(productMap).sort((a, b) => b.totalQty - a.totalQty).slice(0, 10);
    }

    function renderTrendChart(data) {
        const ctx = document.getElementById('trend-chart');
        if (!ctx) return;

        if (trendChart) trendChart.destroy();

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.label),
                datasets: [
                    {
                        label: 'Revenue',
                        data: data.map(d => d.revenue),
                        borderColor: '#e8614d',
                        backgroundColor: 'rgba(232, 97, 77, 0.08)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#e8614d',
                        borderWidth: 2
                    },
                    {
                        label: 'Profit',
                        data: data.map(d => d.profit),
                        borderColor: '#6b9b7d',
                        backgroundColor: 'rgba(107, 155, 125, 0.08)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#6b9b7d',
                        borderWidth: 2
                    },
                    {
                        label: 'Modal',
                        data: data.map(d => d.cost),
                        borderColor: '#c4653a',
                        backgroundColor: 'rgba(196, 101, 58, 0.05)',
                        fill: false,
                        tension: 0.4,
                        pointRadius: 3,
                        borderWidth: 1.5,
                        borderDash: [5, 5]
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
                            pointStyle: 'circle'
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
                            label: function(context) {
                                return context.dataset.label + ': ' + DB.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9a9a9a', font: { family: 'Inter', size: 11 } },
                        grid: { color: '#f0ece6' }
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

    return { load };
})();
