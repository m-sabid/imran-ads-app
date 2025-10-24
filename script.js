// ===================================================================================
// SCRIPT.JS - MONITACK APPLICATION LOGIC
// ===================================================================================
// This file controls the entire application. It handles:
// 1. Data Management (using Local Storage as a simple database).
// 2. User Authentication (Login, Register, Logout).
// 3. UI Rendering (Dynamically creating HTML content).
// 4. Event Handling (Listening for user clicks and form submissions).
// 5. State Management (Keeping track of the logged-in user and current page).
// ===================================================================================

// --- 1. INITIALIZATION & GLOBAL STATE ---

// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// The main application object to encapsulate all functionality
const app = {
    // currentUser will store the logged-in user object
    currentUser: null,
    // currentPage will track which dashboard view is active
    currentPage: 'dashboard',

    // The 'init' function is the entry point of the application
    init() {
        // Load data from Local Storage
        this.loadData();
        // Check if a user is already logged in (from a previous session)
        const loggedInUser = db.getLoggedInUser();
        if (loggedInUser) {
            this.currentUser = loggedInUser;
            // If user is logged in, show the appropriate dashboard
            this.render();
        } else {
            // If no one is logged in, show the login page
            this.renderLoginPage();
        }
    },

    // Main render function to decide which page to show
    render() {
        // Clear the main app container before rendering new content
        const appContainer = document.getElementById('app-container');
        appContainer.innerHTML = '';

        if (!this.currentUser) {
            this.renderLoginPage();
            return;
        }

        // Check user role and render the corresponding dashboard
        if (this.currentUser.role === 'admin') {
            this.renderAdminDashboard();
        } else {
            this.renderUserDashboard();
        }
    },

    // Loads data from Local Storage. If no data exists, it creates default data.
    loadData() {
        let data = db.get();
        // If the database is empty, initialize it with default values
        if (!data) {
            console.log('No data found. Initializing default database.');
            db.init();
            return;
        }

        // Normalize settings for older saved data: ensure logoUrl and withdrawal limits exist
        let changed = false;
        if (!data.settings) {
            data.settings = { appName: 'Monitack', logoUrl: DEFAULT_LOGO_PATH, minWithdrawal: 50, maxWithdrawal: 10000 };
            changed = true;
        } else {
            if (!data.settings.logoUrl || data.settings.logoUrl.trim() === '') {
                data.settings.logoUrl = DEFAULT_LOGO_PATH;
                changed = true;
            }
            if (data.settings.minWithdrawal == null) {
                data.settings.minWithdrawal = 50;
                changed = true;
            }
            if (data.settings.maxWithdrawal == null) {
                data.settings.maxWithdrawal = 10000;
                changed = true;
            }
        }
        if (changed) db.save(data);
    }
};

// Default logo behavior:
// - `DEFAULT_LOGO_PATH` is the project's default logo file (logo.png) which
//   lives in the project root. This is the logo the app should show by default
//   and the one stored when the admin clears the logo field.
// - `FALLBACK_LOGO` is an inline SVG data-URI used only if an image fails to
//   load (onerror). It prevents a broken image icon from appearing.
const DEFAULT_LOGO_PATH = './logo.png';
const _svgLogo = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
    <rect width='120' height='120' fill='#4a90e2'/>
    <text x='60' y='75' font-size='56' fill='#ffffff' text-anchor='middle' font-family='Segoe UI, Tahoma, Geneva, Verdana, sans-serif'>M</text>
</svg>`;
const FALLBACK_LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(_svgLogo);

// Return the effective logo URL to display: prefer saved settings.logoUrl when
// it's present and non-empty, otherwise fall back to the project's default
// `DEFAULT_LOGO_PATH` (logo.png).
function getLogoForDisplay(settings) {
    if (!settings) return DEFAULT_LOGO_PATH;
    const logo = settings.logoUrl;
    if (logo && String(logo).trim() !== '') return String(logo).trim();
    return DEFAULT_LOGO_PATH;
}

// --- 2. LOCAL STORAGE DATABASE HELPER (db) ---
// This object handles all interactions with Local Storage.
// It acts as a mini-database for our application.

const db = {
    // The key used to store all our data in Local Storage
    key: 'monitackData',

    // Retrieves all data from Local Storage
    get() {
        return JSON.parse(localStorage.getItem(this.key));
    },

    // Saves the provided data object to Local Storage
    save(data) {
        localStorage.setItem(this.key, JSON.stringify(data));
    },

    // Initializes the database with a default admin user and empty arrays
    init() {
        const defaultData = {
            settings: {
                appName: 'Monitack',
                logoUrl: DEFAULT_LOGO_PATH // Default logo file in project root (logo.png)
                ,
                // Withdrawal limits (BDT)
                minWithdrawal: 50,
                maxWithdrawal: 10000
            },
            users: [{
                id: Date.now(),
                username: 'admin',
                password: 'admin123', // In a real app, this should be HASHED!
                role: 'admin',
                balance: 0
            }],
            ads: [],
            completedTasks: [],
            withdrawals: []
        };
        this.save(defaultData);
    },

    // Helper functions to get specific parts of the data
    getUsers: () => db.get().users,
    getAds: () => db.get().ads,
    getWithdrawals: () => db.get().withdrawals,
    getSettings: () => db.get().settings,
    getCompletedTasks: () => db.get().completedTasks,

    // Functions to save the currently logged-in user's session
    setLoggedInUser(user) {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    },
    getLoggedInUser() {
        return JSON.parse(sessionStorage.getItem('currentUser'));
    },
    clearLoggedInUser() {
        sessionStorage.removeItem('currentUser');
    }
};

// --- 3. AUTHENTICATION (LOGIN, REGISTER, LOGOUT) ---

// Renders the login form
app.renderLoginPage = function() {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = `
        <div class="auth-container">
            <div class="auth-form">
                <h2>Login to ${db.getSettings().appName}</h2>
                <form id="login-form">
                    <div class="input-group">
                        <label for="login-username">Username</label>
                        <input type="text" id="login-username" required autocomplete="username">
                    </div>
                    <div class="input-group">
                        <label for="login-password">Password</label>
                        <input type="password" id="login-password" required autocomplete="current-password"> <!-- FIXED: Added autocomplete attribute -->
                    </div>
                    <button type="submit" class="btn btn-primary">Login</button>
                </form>
                <p class="auth-switch">Don't have an account? <a href="#" onclick="app.renderRegisterPage()">Register</a></p>
            </div>
        </div>
    `;
    document.getElementById('login-form').addEventListener('submit', this.handleLogin);
};

// Renders the registration form
app.renderRegisterPage = function() {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = `
        <div class="auth-container">
            <div class="auth-form">
                <h2>Register for ${db.getSettings().appName}</h2>
                <form id="register-form">
                    <div class="input-group">
                        <label for="register-username">Username</label>
                        <input type="text" id="register-username" required autocomplete="username">
                    </div>
                    <div class="input-group">
                        <label for="register-password">Password</label>
                        <input type="password" id="register-password" required autocomplete="new-password"> <!-- FIXED: Added autocomplete attribute -->
                    </div>
                    <button type="submit" class="btn btn-primary">Register</button>
                </form>
                <p class="auth-switch">Already have an account? <a href="#" onclick="app.renderLoginPage()">Login</a></p>
            </div>
        </div>
    `;
    document.getElementById('register-form').addEventListener('submit', this.handleRegister);
};

// Handles the login form submission
app.handleLogin = function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const data = db.get();
    const user = data.users.find(u => u.username === username && u.password === password);

    if (user) {
        app.currentUser = user;
        db.setLoggedInUser(user);
        showToast('Login successful!', 'success');
        app.render();
    } else {
        showToast('Invalid username or password.', 'error');
    }
};

// Handles the registration form submission
app.handleRegister = function(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    if (!username || !password) {
        showToast('Username and password are required.', 'error');
        return;
    }

    const data = db.get();
    if (data.users.some(u => u.username === username)) {
        showToast('Username already exists.', 'error');
        return;
    }

    const newUser = {
        id: Date.now(),
        username,
        password, // Again, HASH THIS in a real application
        role: 'user', // All new registrations are 'user' role
        balance: 0
    };

    data.users.push(newUser);
    db.save(data);

    showToast('Registration successful! Please log in.', 'success');
    app.renderLoginPage();
};

// Handles user logout
app.handleLogout = function() {
    this.currentUser = null;
    db.clearLoggedInUser();
    this.currentPage = 'dashboard';
    showToast('You have been logged out.', 'info');
    this.render();
};


// --- 4. ADMIN DASHBOARD ---

// Renders the main layout for the admin dashboard
app.renderAdminDashboard = function() {
    const data = db.get();
    const settings = data.settings;
    const pendingWithdrawals = data.withdrawals.filter(w => w.status === 'pending').length;
    const logoSrc = getLogoForDisplay(settings);

    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = `
        <div class="dashboard-layout">
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <img src="" alt="Logo" class="logo" id="app-logo-img">
                    <h3>${settings.appName} (Admin)</h3>
                </div>
                <nav class="sidebar-nav">
                    <a href="#" class="${this.currentPage === 'dashboard' ? 'active' : ''}" onclick="app.setAdminPage('dashboard')"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
                    <a href="#" class="${this.currentPage === 'users' ? 'active' : ''}" onclick="app.setAdminPage('users')"><i class="fas fa-users"></i> Manage Users</a>
                    <a href="#" class="${this.currentPage === 'ads' ? 'active' : ''}" onclick="app.setAdminPage('ads')"><i class="fas fa-ad"></i> Manage Ads</a>
                    <a href="#" class="${this.currentPage === 'withdrawals' ? 'active' : ''}" onclick="app.setAdminPage('withdrawals')"><i class="fas fa-money-bill-wave"></i> Withdrawals ${pendingWithdrawals > 0 ? `<span class="status pending">${pendingWithdrawals}</span>` : ''}</a>
                    <a href="#" class="${this.currentPage === 'history' ? 'active' : ''}" onclick="app.setAdminPage('history')"><i class="fas fa-history"></i> History</a>
                    <a href="#" class="${this.currentPage === 'settings' ? 'active' : ''}" onclick="app.setAdminPage('settings')"><i class="fas fa-cog"></i> Settings</a>
                </nav>
            </aside>
            <main class="main-content">
                <header class="header">
                     <button class="mobile-menu-toggle" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
                    <h1 id="page-title"></h1>
                    <div class="user-info">
                        <span>Welcome, ${this.currentUser.username}</span>
                        <button class="btn btn-logout" onclick="app.handleLogout()">Logout</button>
                    </div>
                </header>
                <div id="dashboard-content">
                    <!-- Dynamic content will be loaded here -->
                </div>
            </main>
        </div>
    `;

    // Render the content for the current page
    this.renderAdminPageContent();

    // Set the logo src and attach a robust error handler (two-stage fallback)
    try {
        const logoImg = document.getElementById('app-logo-img');
        if (logoImg) {
            const src = getLogoForDisplay(settings);
            logoImg.src = src;
            logoImg.addEventListener('error', function onErr() {
                // first fallback: try the project default file
                if (!this.dataset.triedDefault) {
                    this.dataset.triedDefault = '1';
                    this.removeEventListener('error', onErr);
                    this.addEventListener('error', onErr);
                    this.src = DEFAULT_LOGO_PATH;
                    return;
                }
                // final fallback: inline SVG data URI
                this.removeEventListener('error', onErr);
                this.src = FALLBACK_LOGO;
            });
        }
    } catch (e) {
        console.warn('Logo setup failed', e);
    }
};

// Sets the current admin page and re-renders the dashboard
app.setAdminPage = function(page) {
    this.currentPage = page;
    this.renderAdminDashboard();
};

// Renders the specific content based on the current admin page
app.renderAdminPageContent = function() {
    const contentDiv = document.getElementById('dashboard-content');
    const titleEl = document.getElementById('page-title');
    switch (this.currentPage) {
        case 'dashboard':
            titleEl.innerText = 'Admin Dashboard';
            contentDiv.innerHTML = this.getAdminDashboardHTML();
            break;
        case 'users':
            titleEl.innerText = 'Manage Users';
            contentDiv.innerHTML = this.getAdminUsersHTML();
            break;
        case 'ads':
            titleEl.innerText = 'Manage Ads';
            contentDiv.innerHTML = this.getAdminAdsHTML();
            break;
        case 'withdrawals':
            titleEl.innerText = 'Manage Withdrawals';
            contentDiv.innerHTML = this.getAdminWithdrawalsHTML();
            break;
         case 'history':
            titleEl.innerText = 'Task & Payment History';
            contentDiv.innerHTML = this.getAdminHistoryHTML();
            break;
        case 'settings':
            titleEl.innerText = 'Application Settings';
            contentDiv.innerHTML = this.getAdminSettingsHTML();
            break;
        default:
            titleEl.innerText = 'Admin Dashboard';
            contentDiv.innerHTML = this.getAdminDashboardHTML();
    }
    // Attach page-specific listeners after content is injected
    if (this.currentPage === 'settings') {
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) settingsForm.addEventListener('submit', app.handleSaveSettings);
    }
};

// HTML generators for each admin page section
app.getAdminDashboardHTML = function() {
    const data = db.get();
    const totalUsers = data.users.length;
    const totalAds = data.ads.length;
    const pendingWithdrawals = data.withdrawals.filter(w => w.status === 'pending').length;

    return `
        <div class="stats-cards">
            <div class="card blue">
                <div class="icon"><i class="fas fa-users"></i></div>
                <div class="card-info">
                    <h4>Total Users</h4>
                    <p>${totalUsers}</p>
                </div>
            </div>
            <div class="card green">
                <div class="icon"><i class="fas fa-ad"></i></div>
                <div class="card-info">
                    <h4>Total Ads Posted</h4>
                    <p>${totalAds}</p>
                </div>
            </div>
            <div class="card orange">
                <div class="icon"><i class="fas fa-hourglass-half"></i></div>
                <div class="card-info">
                    <h4>Pending Withdrawals</h4>
                    <p>${pendingWithdrawals}</p>
                </div>
            </div>
        </div>
        <div class="content-box">
            <h2>Quick Actions</h2>
            <div class="quick-actions">
                <button class="btn btn-primary" onclick="showAddUserModal()"><i class="fas fa-user-plus"></i> Add New User</button>
                <button class="btn btn-primary" onclick="showAddAdModal()"><i class="fas fa-ad"></i> Post New Ad</button>
            </div>
        </div>
    `;
};

app.getAdminUsersHTML = function() {
    const users = db.getUsers();
    const userRows = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>${user.balance.toFixed(2)} BDT</td>
            <td class="action-btns">
                ${user.role !== 'admin' ? `<button class="btn btn-danger" onclick="app.deleteUser(${user.id})">Delete</button>` : 'N/A'}
            </td>
        </tr>
    `).join('');

    return `
        <div class="content-box">
            <div class="content-box-header">
                <h2>All Users</h2>
                <button class="btn btn-primary" onclick="showAddUserModal()">+ Add User</button>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Balance</th><th>Actions</th></tr></thead>
                    <tbody>${userRows}</tbody>
                </table>
            </div>
        </div>
    `;
};

app.getAdminAdsHTML = function() {
    const ads = db.getAds();
    const adRows = ads.map(ad => `
        <tr>
            <td>${ad.id}</td>
            <td>${ad.title}</td>
            <td><a href="${ad.url}" target="_blank">${ad.url.substring(0, 30)}...</a></td>
            <td>${ad.reward.toFixed(2)} BDT</td>
            <td class="action-btns">
                <button class="btn btn-danger" onclick="app.deleteAd(${ad.id})">Delete</button>
            </td>
        </tr>
    `).join('');

    return `
        <div class="content-box">
            <div class="content-box-header">
                <h2>All Ads</h2>
                <button class="btn btn-primary" onclick="showAddAdModal()">+ Post Ad</button>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th>ID</th><th>Title</th><th>URL</th><th>Reward</th><th>Actions</th></tr></thead>
                    <tbody>${adRows}</tbody>
                </table>
            </div>
        </div>
    `;
};

app.getAdminWithdrawalsHTML = function() {
    const data = db.get();
    const withdrawalRows = data.withdrawals.map(w => {
        const user = data.users.find(u => u.id === w.userId);
        return `
            <tr>
                <td>${w.id}</td>
                <td>${user ? user.username : 'Unknown'}</td>
                <td>${w.amount.toFixed(2)} BDT</td>
                <td>${w.method}</td>
                <td>${w.accountNumber}</td>
                <td><span class="status ${w.status}">${w.status}</span></td>
                <td>${new Date(w.date).toLocaleString()}</td>
                <td class="action-btns">
                    ${w.status === 'pending' ? `
                        <button class="btn btn-success" onclick="app.handleWithdrawal(${w.id}, 'approved')">Approve</button>
                        <button class="btn btn-danger" onclick="app.handleWithdrawal(${w.id}, 'rejected')">Reject</button>
                    ` : 'N/A'}
                </td>
            </tr>
        `}).join('');

    return `
        <div class="content-box">
            <h2>Withdrawal Requests</h2>
            <div class="table-container">
                <table>
                    <thead><tr><th>ID</th><th>User</th><th>Amount</th><th>Method</th><th>Account</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                    <tbody>${withdrawalRows}</tbody>
                </table>
            </div>
        </div>
    `;
};

app.getAdminHistoryHTML = function() {
    const data = db.get();
    const taskHistoryRows = data.completedTasks.map(task => {
        const user = data.users.find(u => u.id === task.userId);
        const ad = data.ads.find(a => a.id === task.adId);
        return `
            <tr>
                <td>${user ? user.username : 'N/A'}</td>
                <td>${ad ? ad.title : 'Deleted Ad'}</td>
                <td>+${ad ? ad.reward.toFixed(2) : 'N/A'} BDT</td>
                <td>${new Date(task.date).toLocaleString()}</td>
            </tr>
        `;
    }).join('');

    const paymentHistoryRows = data.withdrawals.filter(w => w.status === 'approved').map(payment => {
         const user = data.users.find(u => u.id === payment.userId);
         return `
            <tr>
                <td>${user ? user.username : 'N/A'}</td>
                <td>${payment.amount.toFixed(2)} BDT</td>
                <td>${payment.method}</td>
                <td>${new Date(payment.date).toLocaleString()}</td>
            </tr>
         `
    }).join('');

    return `
        <div class="content-box" style="margin-bottom: 20px;">
            <h2>Task Completion History</h2>
            <div class="table-container">
                <table>
                    <thead><tr><th>User</th><th>Task Title</th><th>Reward</th><th>Date</th></tr></thead>
                    <tbody>${taskHistoryRows}</tbody>
                </table>
            </div>
        </div>
        <div class="content-box">
            <h2>Payment History (Approved Withdrawals)</h2>
             <div class="table-container">
                <table>
                    <thead><tr><th>User</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead>
                    <tbody>${paymentHistoryRows}</tbody>
                </table>
            </div>
        </div>
    `;
};

app.getAdminSettingsHTML = function() {
    const settings = db.getSettings();
    return `
        <div class="content-box">
            <h2>Application Settings</h2>
            <form id="settings-form">
                <div class="input-group">
                    <label for="app-name">Application Name</label>
                    <input type="text" id="app-name" value="${settings.appName}" required>
                </div>
                <div class="input-group">
                    <label for="app-logo">Logo URL</label>
                    <!-- Leave empty to keep the default logo (logo.png) -->
                    <input type="text" id="app-logo" value="${settings.logoUrl === DEFAULT_LOGO_PATH ? '' : settings.logoUrl}" placeholder="Leave empty to use default logo.png">
                </div>
                <div class="input-group">
                    <label for="min-withdrawal">Minimum Withdrawal (BDT)</label>
                    <input type="number" id="min-withdrawal" value="${settings.minWithdrawal ?? 50}" min="0" step="0.01" required>
                </div>
                <div class="input-group">
                    <label for="max-withdrawal">Maximum Withdrawal (BDT)</label>
                    <input type="number" id="max-withdrawal" value="${settings.maxWithdrawal ?? 10000}" min="0" step="0.01" required>
                </div>
                <button type="submit" class="btn btn-primary">Save Settings</button>
            </form>
        </div>
    `;
};

// Admin action handlers
app.deleteUser = function(userId) {
    if (confirm('Are you sure you want to delete this user? This cannot be undone.')) {
        const data = db.get();
        data.users = data.users.filter(user => user.id !== userId);
        db.save(data);
        showToast('User deleted successfully.', 'success');
        this.renderAdminDashboard();
    }
};

app.deleteAd = function(adId) {
    if (confirm('Are you sure you want to delete this ad?')) {
        const data = db.get();
        data.ads = data.ads.filter(ad => ad.id !== adId);
        db.save(data);
        showToast('Ad deleted successfully.', 'success');
        this.renderAdminDashboard();
    }
};

app.handleWithdrawal = function(withdrawalId, status) {
    const data = db.get();
    const withdrawal = data.withdrawals.find(w => w.id === withdrawalId);
    if (!withdrawal) return;

    if (status === 'rejected' && withdrawal.status === 'pending') {
        // If rejected, refund the amount to the user's balance
        const user = data.users.find(u => u.id === withdrawal.userId);
        if (user) {
            user.balance += withdrawal.amount;
        }
    }
    
    withdrawal.status = status;
    db.save(data);
    showToast(`Withdrawal marked as ${status}.`, 'success');
    this.renderAdminDashboard();
};

app.handleSaveSettings = function(e) {
    e.preventDefault();
    const appName = document.getElementById('app-name').value;
    let logoUrl = document.getElementById('app-logo').value;
    // If the admin clears the logo field or it is empty, fall back to the
    // project's default logo file (logo.png)
    if (!logoUrl || logoUrl.trim() === '') {
        logoUrl = DEFAULT_LOGO_PATH;
    }
    const minWithdrawal = parseFloat(document.getElementById('min-withdrawal').value);
    const maxWithdrawal = parseFloat(document.getElementById('max-withdrawal').value);

    const data = db.get();
    data.settings.appName = appName;
    data.settings.logoUrl = logoUrl;
    // Validate and save min/max withdrawal values
    if (!isNaN(minWithdrawal) && minWithdrawal >= 0) data.settings.minWithdrawal = minWithdrawal;
    if (!isNaN(maxWithdrawal) && maxWithdrawal >= 0) data.settings.maxWithdrawal = maxWithdrawal;
    // Ensure min is not greater than max
    if (data.settings.minWithdrawal > data.settings.maxWithdrawal) {
        // Swap to keep them sensible
        const tmp = data.settings.minWithdrawal;
        data.settings.minWithdrawal = data.settings.maxWithdrawal;
        data.settings.maxWithdrawal = tmp;
    }
    db.save(data);

    showToast('Settings saved successfully!', 'success');
    app.renderAdminDashboard();
};

// --- 5. USER DASHBOARD ---

app.renderUserDashboard = function() {
    const data = db.get();
    const settings = data.settings;
    const logoSrc = getLogoForDisplay(settings);

    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = `
        <div class="dashboard-layout">
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <img src="" alt="Logo" class="logo" id="app-logo-img">
                    <h3>${settings.appName}</h3>
                </div>
                <nav class="sidebar-nav">
                    <a href="#" class="${this.currentPage === 'dashboard' ? 'active' : ''}" onclick="app.setUserPage('dashboard')"><i class="fas fa-home"></i> Dashboard</a>
                    <a href="#" class="${this.currentPage === 'tasks' ? 'active' : ''}" onclick="app.setUserPage('tasks')"><i class="fas fa-tasks"></i> View Tasks</a>
                    <a href="#" class="${this.currentPage === 'withdraw' ? 'active' : ''}" onclick="app.setUserPage('withdraw')"><i class="fas fa-wallet"></i> Withdraw</a>
                    <a href="#" class="${this.currentPage === 'history' ? 'active' : ''}" onclick="app.setUserPage('history')"><i class="fas fa-history"></i> History</a>
                </nav>
            </aside>
            <main class="main-content">
                <header class="header">
                     <button class="mobile-menu-toggle" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
                    <h1 id="page-title"></h1>
                    <div class="user-info">
                        <span>Welcome, ${this.currentUser.username}</span>
                        <button class="btn btn-logout" onclick="app.handleLogout()">Logout</button>
                    </div>
                </header>
                <div id="dashboard-content">
                    <!-- Dynamic content will be loaded here -->
                </div>
            </main>
        </div>
    `;

    this.renderUserPageContent();

    // Set the logo src for user dashboard and attach same robust fallback
    try {
        const logoImg = document.getElementById('app-logo-img');
        if (logoImg) {
            const src = getLogoForDisplay(settings);
            logoImg.src = src;
            logoImg.addEventListener('error', function onErr() {
                if (!this.dataset.triedDefault) {
                    this.dataset.triedDefault = '1';
                    this.removeEventListener('error', onErr);
                    this.addEventListener('error', onErr);
                    this.src = DEFAULT_LOGO_PATH;
                    return;
                }
                this.removeEventListener('error', onErr);
                this.src = FALLBACK_LOGO;
            });
        }
    } catch (e) {
        console.warn('Logo setup failed', e);
    }
};

app.setUserPage = function(page) {
    this.currentPage = page;
    this.renderUserDashboard();
};

app.renderUserPageContent = function() {
    const contentDiv = document.getElementById('dashboard-content');
    const titleEl = document.getElementById('page-title');
    switch (this.currentPage) {
        case 'dashboard':
            titleEl.innerText = 'My Dashboard';
            contentDiv.innerHTML = this.getUserDashboardHTML();
            break;
        case 'tasks':
            titleEl.innerText = 'Available Tasks';
            contentDiv.innerHTML = this.getUserTasksHTML();
            break;
        case 'withdraw':
            titleEl.innerText = 'Withdraw Funds';
            contentDiv.innerHTML = this.getUserWithdrawHTML();
            break;
        case 'history':
            titleEl.innerText = 'My History';
            contentDiv.innerHTML = this.getUserHistoryHTML();
            break;
        default:
            titleEl.innerText = 'My Dashboard';
            contentDiv.innerHTML = this.getUserDashboardHTML();
    }
    // Attach page-specific listeners after content injection
    if (this.currentPage === 'withdraw') {
        const withdrawForm = document.getElementById('withdraw-form');
        if (withdrawForm) withdrawForm.addEventListener('submit', app.handleWithdrawRequest);

        // Make sure the amount input respects both user's balance and admin max/min
        const amountInput = document.getElementById('withdraw-amount');
        const settings = db.getSettings() || {};
        const currentUserData = db.getUsers().find(u => u.id === this.currentUser.id) || { balance: 0 };
        if (amountInput) {
            const minVal = (settings.minWithdrawal != null) ? settings.minWithdrawal : 0;
            const maxVal = (settings.maxWithdrawal != null) ? Math.min(settings.maxWithdrawal, currentUserData.balance) : currentUserData.balance;
            amountInput.min = minVal;
            amountInput.max = maxVal;
        }
    }
};

app.getUserDashboardHTML = function() {
    // We need to get the most up-to-date user data
    const currentUserData = db.getUsers().find(u => u.id === this.currentUser.id);
    const completedTasksCount = db.getCompletedTasks().filter(t => t.userId === this.currentUser.id).length;

    return `
        <div class="stats-cards">
            <div class="card green">
                <div class="icon"><i class="fas fa-wallet"></i></div>
                <div class="card-info">
                    <h4>Current Balance</h4>
                    <p>${currentUserData.balance.toFixed(2)} BDT</p>
                </div>
            </div>
            <div class="card blue">
                <div class="icon"><i class="fas fa-check-circle"></i></div>
                <div class="card-info">
                    <h4>Tasks Completed</h4>
                    <p>${completedTasksCount}</p>
                </div>
            </div>
        </div>
    `;
};

app.getUserTasksHTML = function() {
    const data = db.get();
    const completedAdIds = data.completedTasks
        .filter(task => task.userId === this.currentUser.id)
        .map(task => task.adId);

    const availableTasks = data.ads.filter(ad => !completedAdIds.includes(ad.id));

    if (availableTasks.length === 0) {
        return `<div class="content-box"><p>No new tasks available. Check back later!</p></div>`;
    }

    const taskCards = availableTasks.map(ad => `
        <div class="task-card">
            <h3>${ad.title}</h3>
            <p>${ad.description || 'Click the button below to visit the ad and earn.'}</p>
            <p class="reward">Reward: ${ad.reward.toFixed(2)} BDT</p>
            <button class="btn btn-visit" onclick="app.visitTask(${ad.id})">Visit & Earn</button>
        </div>
    `).join('');

    return `<div class="task-grid">${taskCards}</div>`;
};

app.getUserWithdrawHTML = function() {
    const currentUserData = db.getUsers().find(u => u.id === this.currentUser.id);
     return `
        <div class="content-box">
            <h2>Request a Withdrawal</h2>
            <p>Your current balance is: <strong>${currentUserData.balance.toFixed(2)} BDT</strong></p>
            <form id="withdraw-form" style="margin-top: 20px;">
                <div class="input-group">
                    <label for="withdraw-amount">Amount (BDT)</label>
                    <input type="number" id="withdraw-amount" step="0.01" max="${currentUserData.balance}" required>
                </div>
                <div class="input-group">
                    <label for="withdraw-method">Payment Method</label>
                    <select id="withdraw-method" required>
                        <option value="bKash">bKash</option>
                        <option value="Nagad">Nagad</option>
                        <option value="Rocket">Rocket</option>
                    </select>
                </div>
                <div class="input-group">
                    <label for="account-number">Account Number</label>
                    <input type="text" id="account-number" required>
                </div>
                <button type="submit" class="btn btn-primary">Send Request</button>
            </form>
        </div>
    `;
};


app.getUserHistoryHTML = function() {
    const data = db.get();
    const myTasks = data.completedTasks.filter(t => t.userId === this.currentUser.id);
    const myWithdrawals = data.withdrawals.filter(w => w.userId === this.currentUser.id);

    const taskRows = myTasks.map(task => {
        const ad = data.ads.find(a => a.id === task.adId);
        return `
        <tr>
            <td>${ad ? ad.title : 'Deleted Task'}</td>
            <td>+${ad ? ad.reward.toFixed(2) : 'N/A'} BDT</td>
            <td><span class="status completed">Completed</span></td>
            <td>${new Date(task.date).toLocaleString()}</td>
        </tr>
    `}).join('');

    const withdrawalRows = myWithdrawals.map(w => `
        <tr>
            <td>${w.amount.toFixed(2)} BDT</td>
            <td>${w.method} (${w.accountNumber})</td>
            <td><span class="status ${w.status}">${w.status}</span></td>
            <td>${new Date(w.date).toLocaleString()}</td>
        </tr>
    `).join('');

    return `
        <div class="content-box" style="margin-bottom: 20px;">
            <h2>My Task History</h2>
            <div class="table-container">
                <table>
                    <thead><tr><th>Task</th><th>Earned</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>${taskRows}</tbody>
                </table>
            </div>
        </div>
        <div class="content-box">
            <h2>My Withdrawal History</h2>
            <div class="table-container">
                <table>
                    <thead><tr><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>${withdrawalRows}</tbody>
                </table>
            </div>
        </div>
    `;
};


// User action handlers
app.visitTask = function(adId) {
    const data = db.get();
    const ad = data.ads.find(a => a.id === adId);
    const user = data.users.find(u => u.id === this.currentUser.id);

    if (!ad || !user) return;

    // Open the ad link in a new tab
    window.open(ad.url, '_blank');

    // Update user balance and mark task as complete
    user.balance += ad.reward;
    data.completedTasks.push({
        userId: this.currentUser.id,
        adId: ad.id,
        date: new Date().toISOString()
    });

    db.save(data);
    showToast(`You earned ${ad.reward.toFixed(2)} BDT!`, 'success');

    // Re-render the user's current page to reflect the change
    this.renderUserPageContent();
};


app.handleWithdrawRequest = function(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const method = document.getElementById('withdraw-method').value;
    const accountNumber = document.getElementById('account-number').value;

    const data = db.get();
    const user = data.users.find(u => u.id === app.currentUser.id);

    const settings = db.getSettings() || {};
    const minWithdrawal = (settings.minWithdrawal != null) ? parseFloat(settings.minWithdrawal) : 0;
    const maxWithdrawal = (settings.maxWithdrawal != null) ? parseFloat(settings.maxWithdrawal) : Infinity;

    if (!amount || isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount.', 'error');
        return;
    }
    if (amount < minWithdrawal) {
        showToast(`Amount must be at least ${minWithdrawal.toFixed(2)} BDT.`, 'error');
        return;
    }
    if (amount > maxWithdrawal) {
        showToast(`Amount must not exceed ${maxWithdrawal.toFixed(2)} BDT.`, 'error');
        return;
    }
    if (amount > user.balance) {
        showToast('Insufficient balance.', 'error');
        return;
    }

    // Deduct amount from user balance and create withdrawal request
    user.balance -= amount;
    data.withdrawals.push({
        id: Date.now(),
        userId: app.currentUser.id,
        amount: amount,
        method: method,
        accountNumber: accountNumber,
        status: 'pending',
        date: new Date().toISOString()
    });

    db.save(data);
    showToast('Withdrawal request sent successfully!', 'success');
    app.setUserPage('dashboard'); // Go back to dashboard after request
};


// --- 6. UI HELPERS (MODALS, TOASTS, etc.) ---

// Function to show a toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Trigger the animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Remove the toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove from DOM after transition ends
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// Functions to open and close modals
function showModal(content) {
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal-container').classList.remove('modal-hidden');
}

function closeModal() {
    document.getElementById('modal-container').classList.add('modal-hidden');
    document.getElementById('modal-body').innerHTML = ''; // Clear content
}

// Modal for adding a user
function showAddUserModal() {
    const content = `
        <h3>Add New User</h3>
        <form id="add-user-form">
            <div class="input-group">
                <label for="new-username">Username</label>
                <input type="text" id="new-username" required autocomplete="username">
            </div>
            <div class="input-group">
                <label for="new-password">Password</label>
                <input type="password" id="new-password" required autocomplete="new-password"> <!-- FIXED: Added autocomplete attribute -->
            </div>
            <button type="submit" class="btn btn-primary">Add User</button>
        </form>
    `;
    showModal(content);
    document.getElementById('add-user-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const data = db.get();
        if (data.users.some(u => u.username === username)) {
            showToast('Username already exists.', 'error');
            return;
        }
        data.users.push({ id: Date.now(), username, password, role: 'user', balance: 0 });
        db.save(data);
        showToast('User added successfully!', 'success');
        closeModal();
        app.renderAdminDashboard();
    });
}

// Modal for adding an ad
function showAddAdModal() {
    const content = `
        <h3>Post a New Ad</h3>
        <form id="add-ad-form">
            <div class="input-group">
                <label for="ad-title">Ad Title</label>
                <input type="text" id="ad-title" required>
            </div>
            <div class="input-group">
                <label for="ad-url">Ad URL</label>
                <input type="url" id="ad-url" placeholder="https://example.com" required>
            </div>
             <div class="input-group">
                <label for="ad-description">Description (optional)</label>
                <input type="text" id="ad-description">
            </div>
            <div class="input-group">
                <label for="ad-reward">Reward Amount (BDT)</label>
                <input type="number" id="ad-reward" step="0.01" required>
            </div>
            <button type="submit" class="btn btn-primary">Post Ad</button>
        </form>
    `;
    showModal(content);
    document.getElementById('add-ad-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = db.get();
        data.ads.push({
            id: Date.now(),
            title: document.getElementById('ad-title').value,
            url: document.getElementById('ad-url').value,
            description: document.getElementById('ad-description').value,
            reward: parseFloat(document.getElementById('ad-reward').value)
        });
        db.save(data);
        showToast('Ad posted successfully!', 'success');
        closeModal();
        app.renderAdminDashboard();
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}