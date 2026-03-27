// ============================================
// BizOps — Main Application Controller
// ============================================

const App = (() => {
    let currentPage = 'dashboard';
    const state = {
        materials: [],
        products: [],
        sales: [],
        loading: false
    };

    // ---- Init ----
    function init() {
        // Check Supabase connection
        if (!DB.init()) {
            showConfigScreen();
            return;
        }

        setupNavigation();
        setupMobileMenu();
        setupBackupButtons();

        // Initialize Lucide icons
        lucide.createIcons();

        // Load initial page
        const hash = window.location.hash.slice(1) || 'dashboard';
        navigateTo(hash);
    }

    // ---- Config Screen ----
    function showConfigScreen() {
        document.querySelector('.app-shell').style.display = 'none';
        const container = document.getElementById('modal-container');
        container.innerHTML = `
            <div class="config-screen">
                <div class="glass-card config-card">
                    <div class="brand-icon">
                        <i data-lucide="bar-chart-3"></i>
                    </div>
                    <h2>Selamat Datang di BizOps</h2>
                    <p>Masukkan URL dan Anon Key dari proyek Supabase Anda untuk memulai.</p>
                    <div class="form-group">
                        <label class="form-label">Supabase URL</label>
                        <input type="url" id="config-url" class="form-input" placeholder="https://xxxxx.supabase.co">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Anon Key</label>
                        <input type="text" id="config-key" class="form-input" placeholder="eyJhbGci...">
                    </div>
                    <button class="btn btn-primary btn-block" id="config-submit">
                        <i data-lucide="log-in"></i>
                        <span>Hubungkan</span>
                    </button>
                    <p class="form-hint mt-md text-center">Informasi ini disimpan di localStorage browser Anda.</p>
                </div>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('config-submit').addEventListener('click', async () => {
            const url = document.getElementById('config-url').value.trim();
            const key = document.getElementById('config-key').value.trim();

            if (!url || !key) {
                Toast.show('Harap isi URL dan Anon Key', 'error');
                return;
            }

            try {
                // Test connection
                DB.saveConfig(url, key);
                const client = DB.getClient();
                const { error } = await client.from('materials').select('id').limit(1);
                if (error) throw error;

                Toast.show('Terhubung ke Supabase!', 'success');
                container.innerHTML = '';
                document.querySelector('.app-shell').style.display = 'flex';
                init();
            } catch (e) {
                Toast.show('Gagal terhubung: ' + e.message, 'error');
                localStorage.removeItem('bizops_supabase_config');
            }
        });
    }

    // ---- Navigation ----
    function setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                navigateTo(page);
                closeMobileMenu();
            });
        });

        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1);
            if (hash && hash !== currentPage) {
                navigateTo(hash);
            }
        });
    }

    function navigateTo(page) {
        currentPage = page;
        window.location.hash = page;

        // Update nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Show page
        document.querySelectorAll('.page').forEach(p => {
            p.style.display = 'none';
        });
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) {
            pageEl.style.display = 'block';
            pageEl.style.animation = 'none';
            pageEl.offsetHeight; // trigger reflow
            pageEl.style.animation = '';
        }

        // Load page data
        loadPage(page);
    }

    async function loadPage(page) {
        try {
            switch (page) {
                case 'dashboard': await DashboardModule.load(); break;
                case 'materials': await MaterialsModule.load(); break;
                case 'products': await ProductsModule.load(); break;
                case 'sales': await SalesModule.load(); break;
                case 'reports': await ReportsModule.load(); break;
            }
            lucide.createIcons();
        } catch (e) {
            console.error('Error loading page:', e);
            Toast.show('Gagal memuat data: ' + e.message, 'error');
        }
    }

    // ---- Mobile Menu ----
    function setupMobileMenu() {
        const hamburger = document.getElementById('hamburger-btn');
        const closeBtn = document.getElementById('sidebar-close-btn');
        const overlay = document.getElementById('sidebar-overlay');

        hamburger?.addEventListener('click', openMobileMenu);
        closeBtn?.addEventListener('click', closeMobileMenu);
        overlay?.addEventListener('click', closeMobileMenu);
    }

    function openMobileMenu() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    // ---- Backup ----
    function setupBackupButtons() {
        document.getElementById('btn-export-backup')?.addEventListener('click', exportBackup);
        document.getElementById('btn-import-backup')?.addEventListener('click', () => {
            document.getElementById('import-file-input')?.click();
        });
        document.getElementById('import-file-input')?.addEventListener('change', importBackup);
    }

    async function exportBackup() {
        try {
            const materials = await DB.Materials.getAll();
            const products = await DB.Products.getAll();
            const sales = await DB.Sales.getAll();

            const backup = {
                version: '1.0.0',
                exportedAt: new Date().toISOString(),
                data: { materials, products, sales }
            };

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bizops-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            Toast.show('Backup berhasil di-export', 'success');
        } catch (e) {
            Toast.show('Gagal export backup: ' + e.message, 'error');
        }
    }

    async function importBackup(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.data) {
                throw new Error('Format file backup tidak valid');
            }

            Toast.show('Import backup sedang diproses...', 'info');
            // This is a simplified import. In production, you'd want conflict resolution.
            Toast.show('Fitur import sedang dalam pengembangan', 'warning');
        } catch (e) {
            Toast.show('Gagal import: ' + e.message, 'error');
        }

        e.target.value = '';
    }

    // ---- Refresh current page ----
    function refresh() {
        loadPage(currentPage);
    }

    return { init, navigateTo, refresh, state };
})();


// ============================================
// Toast Notification System
// ============================================
const Toast = (() => {
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    function show(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i data-lucide="${icons[type]}" class="toast-icon"></i>
            <span class="toast-message">${message}</span>
        `;
        container.appendChild(toast);
        lucide.createIcons({ nodes: [toast] });

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    return { show };
})();


// ============================================
// Confirm Dialog
// ============================================
const Confirm = (() => {
    function show(title, message, onConfirm, confirmText = 'Hapus') {
        const dialog = document.getElementById('confirm-dialog');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;

        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        okBtn.textContent = confirmText;
        dialog.style.display = 'flex';

        // Refresh icons in confirm dialog
        lucide.createIcons({ nodes: [dialog] });

        function cleanup() {
            dialog.style.display = 'none';
            okBtn.replaceWith(okBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        }

        document.getElementById('confirm-ok').addEventListener('click', () => {
            cleanup();
            onConfirm();
        });
        document.getElementById('confirm-cancel').addEventListener('click', cleanup);
    }

    return { show };
})();


// ============================================
// Modal Helper
// ============================================
const Modal = (() => {
    function show(title, bodyHtml, footerHtml = '', options = {}) {
        const container = document.getElementById('modal-container');
        const sizeClass = options.large ? 'modal-lg' : '';

        container.innerHTML = `
            <div class="modal-overlay" id="active-modal">
                <div class="modal-card ${sizeClass}">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close-btn" id="modal-close">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${bodyHtml}
                    </div>
                    ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
                </div>
            </div>
        `;

        lucide.createIcons();

        document.getElementById('modal-close').addEventListener('click', close);
        document.getElementById('active-modal').addEventListener('click', (e) => {
            if (e.target.id === 'active-modal') close();
        });
    }

    function close() {
        document.getElementById('modal-container').innerHTML = '';
    }

    return { show, close };
})();


// ============================================
// Boot
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
