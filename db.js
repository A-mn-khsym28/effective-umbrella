// ============================================
// BizOps — Supabase Database Layer
// ============================================

const DB = (() => {
    let supabase = null;
    const STORAGE_KEY = 'bizops_supabase_config';

    // ---- Init ----
    function init() {
        const config = getConfig();
        if (config && config.url && config.key) {
            supabase = window.supabase.createClient(config.url, config.key);
            return true;
        }
        return false;
    }

    function getConfig() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch { return null; }
    }

    function saveConfig(url, key) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, key }));
        supabase = window.supabase.createClient(url, key);
    }

    function isConnected() {
        return supabase !== null;
    }

    function getClient() {
        return supabase;
    }

    // ---- Materials ----
    const Materials = {
        async getAll() {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .order('name');
            if (error) throw error;
            return data;
        },

        async getById(id) {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },

        async create(material) {
            const { data, error } = await supabase
                .from('materials')
                .insert(material)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async update(id, updates) {
            const { data, error } = await supabase
                .from('materials')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabase
                .from('materials')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },

        async getLowStock() {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .filter('stock', 'lt', 'min_stock')
                .order('name');
            // Supabase doesn't support column-to-column comparison in filter
            // So we fetch all and filter client-side
            const all = await this.getAll();
            return all.filter(m => m.stock < m.min_stock);
        }
    };

    // ---- Products ----
    const Products = {
        async getAll() {
            const { data, error } = await supabase
                .from('products')
                .select('*, recipes(*, materials(*))')
                .order('name');
            if (error) throw error;
            return data;
        },

        async getById(id) {
            const { data, error } = await supabase
                .from('products')
                .select('*, recipes(*, materials(*))')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },

        async create(product, recipes) {
            // Insert product
            const { data: prod, error: prodErr } = await supabase
                .from('products')
                .insert({ name: product.name, selling_price: product.selling_price })
                .select()
                .single();
            if (prodErr) throw prodErr;

            // Insert recipes
            if (recipes && recipes.length > 0) {
                const recipeRows = recipes.map(r => ({
                    product_id: prod.id,
                    material_id: r.material_id,
                    qty_per_pcs: r.qty_per_pcs
                }));
                const { error: recErr } = await supabase
                    .from('recipes')
                    .insert(recipeRows);
                if (recErr) throw recErr;
            }

            return prod;
        },

        async update(id, product, recipes) {
            // Update product
            const { error: prodErr } = await supabase
                .from('products')
                .update({ name: product.name, selling_price: product.selling_price })
                .eq('id', id);
            if (prodErr) throw prodErr;

            // Delete old recipes and insert new ones
            const { error: delErr } = await supabase
                .from('recipes')
                .delete()
                .eq('product_id', id);
            if (delErr) throw delErr;

            if (recipes && recipes.length > 0) {
                const recipeRows = recipes.map(r => ({
                    product_id: id,
                    material_id: r.material_id,
                    qty_per_pcs: r.qty_per_pcs
                }));
                const { error: recErr } = await supabase
                    .from('recipes')
                    .insert(recipeRows);
                if (recErr) throw recErr;
            }
        },

        async delete(id) {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },

        calculateHPP(recipes) {
            if (!recipes || recipes.length === 0) return 0;
            return recipes.reduce((sum, r) => {
                const price = r.materials ? r.materials.price_per_unit : r.price_per_unit || 0;
                return sum + (price * r.qty_per_pcs);
            }, 0);
        }
    };

    // ---- Sales ----
    const Sales = {
        async processSale(items) {
            // Use the process_sale RPC function for atomic transaction
            const { data, error } = await supabase
                .rpc('process_sale', {
                    p_items: items
                });
            if (error) throw error;
            return data; // Returns sale UUID
        },

        async getAll(startDate, endDate) {
            let query = supabase
                .from('sales')
                .select('*, sales_items(*, products(name))')
                .order('created_at', { ascending: false });

            if (startDate) {
                query = query.gte('created_at', startDate);
            }
            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },

        async getById(id) {
            const { data, error } = await supabase
                .from('sales')
                .select('*, sales_items(*, products(name))')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            // Note: This won't restore stock. Consider implementing a reverse stock function.
            const { error } = await supabase
                .from('sales')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },

        async getSummary(startDate, endDate) {
            const sales = await this.getAll(startDate, endDate);
            return {
                count: sales.length,
                totalRevenue: sales.reduce((s, sale) => s + Number(sale.total_revenue), 0),
                totalCost: sales.reduce((s, sale) => s + Number(sale.total_cost), 0),
                totalProfit: sales.reduce((s, sale) => s + Number(sale.total_profit), 0),
                sales
            };
        }
    };

    // ---- Date Helpers ----
    const DateHelper = {
        todayStart() {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d.toISOString();
        },
        todayEnd() {
            const d = new Date();
            d.setHours(23, 59, 59, 999);
            return d.toISOString();
        },
        weekStart() {
            const d = new Date();
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            d.setDate(diff);
            d.setHours(0, 0, 0, 0);
            return d.toISOString();
        },
        monthStart() {
            const d = new Date();
            d.setDate(1);
            d.setHours(0, 0, 0, 0);
            return d.toISOString();
        },
        daysAgo(n) {
            const d = new Date();
            d.setDate(d.getDate() - n);
            d.setHours(0, 0, 0, 0);
            return d.toISOString();
        },
        formatDate(dateStr) {
            return new Date(dateStr).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
        },
        formatDateTime(dateStr) {
            return new Date(dateStr).toLocaleString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        },
        formatDateInput(dateStr) {
            const d = new Date(dateStr || Date.now());
            return d.toISOString().split('T')[0];
        }
    };

    // ---- Currency Helper ----
    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    function formatNumber(num) {
        return new Intl.NumberFormat('id-ID').format(num);
    }

    return {
        init,
        getConfig,
        saveConfig,
        isConnected,
        getClient,
        Materials,
        Products,
        Sales,
        DateHelper,
        formatCurrency,
        formatNumber
    };
})();
