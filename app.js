document.addEventListener('DOMContentLoaded', () => {
    // STATE MANAGEMENT
    const state = {
        users: [],
        tasks: [],
        withdrawals: [],
        currentUser: null,
        currentView: 'login',
        branding: {
            appName: 'Ad Platform',
            primaryColor: '#0a2540',
            secondaryColor: '#00d4ff'
        }
    };

    // DOM ELEMENTS
    const views = document.querySelectorAll('.view');
    const appContainer = document.getElementById('app-container');

    // INITIALIZATION
    function initializeApp() {
        const storedUsers = localStorage.getItem('app_users');
        const storedTasks = localStorage.getItem('app_tasks');
        const storedWithdrawals = localStorage.getItem('app_withdrawals');
        const storedBranding = localStorage.getItem('app_branding');

        state.users = storedUsers ? JSON.parse(storedUsers) : [];
        state.tasks = storedTasks ? JSON.parse(storedTasks) : [];
        state.withdrawals = storedWithdrawals ? JSON.parse(storedWithdrawals) : [];
        state.branding = storedBranding ? { ...state.branding, ...JSON.parse(storedBranding) } : state.branding;

        if (state.users.length === 0) {
            state.users.push({ id: 1, name: 'Admin', username: 'admin', password: 'admin', role: 'admin', balance: 0, status: 'approved' });
            state.users.push({ id: 2, name: 'Sample User', username: 'user', password: 'password', role: 'user', balance: 0, status: 'pending', completedTasks: [] });
            saveState();
        }

        // Ensure data shape for existing users (idempotent migration)
        state.users = state.users.map(u => {
            if (u.role === 'user') {
                return { ...u, completedTasks: Array.isArray(u.completedTasks) ? u.completedTasks : [] };
            }
            return u;
        });
        saveState();
        applyBranding();
        
        // Restore session from sessionStorage; if absent, try last known user from localStorage
        const sessionUser = sessionStorage.getItem('app_currentUser');
        if (sessionUser) {
            state.currentUser = JSON.parse(sessionUser);
            const userExists = state.users.find(u => u.id === state.currentUser.id);
            
            if (!userExists) { // Handle case where user was deleted by admin
                logout();
                return;
            }

            if (state.currentUser.role === 'admin') {
                navigateTo('admin-dashboard');
                renderAdminDashboard();
            } else {
                navigateTo('user-dashboard');
                renderUserDashboard();
            }
        } else {
            const lastUser = localStorage.getItem('app_lastUser');
            if(lastUser){
                const parsed = JSON.parse(lastUser);
                const user = state.users.find(u => u.id === parsed.id);
                if(user && user.status !== 'pending'){
                    state.currentUser = { ...user };
                    saveState();
                    if (user.role === 'admin') { navigateTo('admin-dashboard'); renderAdminDashboard(); }
                    else { navigateTo('user-dashboard'); renderUserDashboard(); }
                    return;
                }
            }
            navigateTo('login');
        }
    }
    
    function saveState() {
        localStorage.setItem('app_users', JSON.stringify(state.users));
        localStorage.setItem('app_tasks', JSON.stringify(state.tasks));
        localStorage.setItem('app_withdrawals', JSON.stringify(state.withdrawals));
        localStorage.setItem('app_branding', JSON.stringify(state.branding));
        if (state.currentUser) {
            sessionStorage.setItem('app_currentUser', JSON.stringify(state.currentUser));
            localStorage.setItem('app_lastUser', JSON.stringify({ id: state.currentUser.id }));
        } else {
            sessionStorage.removeItem('app_currentUser');
            localStorage.removeItem('app_lastUser');
        }
    }

    function applyBranding(){
        // Update document title
        document.title = state.branding.appName || 'App';
        // Update CSS variables for theme
        const root = document.documentElement;
        if (state.branding.primaryColor) root.style.setProperty('--primary-color', state.branding.primaryColor);
        if (state.branding.secondaryColor) root.style.setProperty('--secondary-color', state.branding.secondaryColor);
        // Update admin header name
        const adminHeader = document.querySelector('#admin-dashboard-view .dashboard-header h1');
        if (adminHeader) adminHeader.textContent = `${state.branding.appName} • Admin`;
    }

    // --- REVISED NAVIGATION AND RENDERING ---
    function navigateTo(viewName) {
        views.forEach(view => {
            view.classList.toggle('active-view', view.id === `${viewName}-view`);
        });
        state.currentView = viewName;
    }

    // --- USER PROFILE HELPERS ---
    function fillProfileForm(){
        const user = state.users.find(u => u.id === state.currentUser.id);
        if(!user) return;
        const nameEl = document.getElementById('profile-name');
        const userEl = document.getElementById('profile-username');
        const pwdEl = document.getElementById('profile-new-password');
        const avatarPrev = document.getElementById('profile-avatar-preview');
        if (nameEl) nameEl.value = user.name || '';
        if (userEl) userEl.value = user.username || '';
        if (pwdEl) pwdEl.value = '';
        if (avatarPrev) {
            if (user.avatarDataUrl) {
                avatarPrev.src = user.avatarDataUrl;
                avatarPrev.style.display = 'inline-block';
            } else {
                avatarPrev.src = '';
                avatarPrev.style.display = 'none';
            }
        }
    }

    function handleProfileUpdate(){
        const user = state.users.find(u => u.id === state.currentUser.id);
        if(!user) return;
        const newName = (document.getElementById('profile-name')?.value || '').trim();
        const newPassword = document.getElementById('profile-new-password')?.value || '';
        const avatarInput = document.getElementById('profile-avatar');
        if(newName.length === 0){ showAlert('Name is required.', 'error'); return; }
        user.name = newName;
        if(newPassword && newPassword.length >= 4){ user.password = newPassword; }
        // If a new avatar is selected, convert to data URL and save
        if (avatarInput && avatarInput.files && avatarInput.files[0]) {
            const file = avatarInput.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                user.avatarDataUrl = reader.result;
                finalizeProfileSave(user);
            };
            reader.readAsDataURL(file);
            return;
        }
        finalizeProfileSave(user);
    }

    function finalizeProfileSave(user){
        saveState();
        const welcome = document.getElementById('user-welcome-message');
        if (welcome) welcome.textContent = `Welcome, ${user.name}!`;
        showAlert('Profile updated successfully.', 'success');
        navigateTo('user-dashboard');
        renderUserDashboard();
    }

    function renderAdminDashboard() {
        // Stats
        document.getElementById('admin-total-users').textContent = state.users.filter(u => u.role === 'user').length;
        document.getElementById('admin-pending-users').textContent = state.users.filter(u => u.status === 'pending').length;
        document.getElementById('admin-pending-withdrawals').textContent = state.withdrawals.filter(w => w.status === 'pending').length;
        // Prefill branding form
        const brandNameEl = document.getElementById('brand-app-name');
        const brandPrimaryEl = document.getElementById('brand-primary-color');
        const brandSecondaryEl = document.getElementById('brand-secondary-color');
        if (brandNameEl) brandNameEl.value = state.branding.appName || '';
        if (brandPrimaryEl) brandPrimaryEl.value = state.branding.primaryColor || '#0a2540';
        if (brandSecondaryEl) brandSecondaryEl.value = state.branding.secondaryColor || '#00d4ff';

        // Tasks
        const taskList = document.getElementById('task-list');
        taskList.innerHTML = state.tasks.length > 0 ? state.tasks.map(task => `
            <div class="task-item">
                <span>${task.url} (Reward: ৳${Number(task.reward).toFixed(2)} | ${task.duration}s)</span>
                <div>
                    <button class="edit-btn" data-task-id="${task.id}">Edit</button>
                    <button class="delete-btn" data-task-id="${task.id}">Delete</button>
                </div>
            </div>
        `).join('') : '<p>No tasks created yet.</p>';

        // Users
        const userTableBody = document.querySelector('#user-management-table tbody');
        const searchValue = (document.getElementById('admin-user-search')?.value || '').toLowerCase();
        const filteredUsers = state.users.filter(u => u.role === 'user' && (
            u.username.toLowerCase().includes(searchValue) || (u.name||'').toLowerCase().includes(searchValue)
        ));
        userTableBody.innerHTML = filteredUsers.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>৳${user.balance.toFixed(2)}</td>
                <td><span class="status-${user.status}">${user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span></td>
                <td>
                    ${user.status === 'pending' ? `<button class="approve-btn" data-user-id="${user.id}">Approve</button>` : ''}
                    <button class="delete-btn" data-user-id="${user.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        // Withdrawals
        const withdrawalList = document.getElementById('withdrawal-request-list');
        const pendingWithdrawals = state.withdrawals.filter(w => w.status === 'pending');
        withdrawalList.innerHTML = pendingWithdrawals.length > 0 ? pendingWithdrawals.map(w => `
            <div class="withdrawal-item card">
                <div>
                    <p><strong>User:</strong> ${w.username}</p>
                    <p><strong>Amount:</strong> ৳${w.amount.toFixed(2)}</p>
                    ${w.bkash ? `<p><strong>bKash:</strong> ${w.bkash}</p>` : ''}
                    ${w.nagad ? `<p><strong>Nagad:</strong> ${w.nagad}</p>` : ''}
                    ${w.rocket ? `<p><strong>Rocket:</strong> ${w.rocket}</p>` : ''}
                </div>
                <button class="complete-btn" data-withdrawal-id="${w.id}">Mark as Completed</button>
            </div>
        `).join('') : '<p>No pending withdrawal requests.</p>';
    }

    function renderUserDashboard() {
        const user = state.users.find(u => u.id === state.currentUser.id);
        if(!user) {
            logout();
            return;
        }
        state.currentUser.balance = user.balance;
        saveState();

        const welcomeHeading = document.getElementById('user-welcome-message');
        const header = welcomeHeading?.parentElement;
        if (welcomeHeading) welcomeHeading.textContent = `Welcome, ${user.name}!`;
        // Inject/update avatar in header
        if (header) {
            let existingImg = header.querySelector('img.header-avatar');
            if (!existingImg) {
                existingImg = document.createElement('img');
                existingImg.className = 'header-avatar';
                header.insertBefore(existingImg, header.firstChild);
            }
            if (user.avatarDataUrl) {
                existingImg.src = user.avatarDataUrl;
                existingImg.style.display = 'inline-block';
            } else {
                existingImg.src = '';
                existingImg.style.display = 'none';
            }
        }
        document.getElementById('user-balance').textContent = user.balance.toFixed(2);
        
        const userTaskList = document.getElementById('user-task-list');
        const completedTaskIds = new Set((user.completedTasks || []).map(ct => ct.taskId));
        const taskCards = state.tasks.map(task => {
            const isCompleted = completedTaskIds.has(task.id);
            return `
            <div class="task-card">
                <div class="task-info">
                    <p>Watch an ad for ${task.duration} seconds</p>
                    <p class="reward">Reward: ৳${Number(task.reward).toFixed(2)}</p>
                </div>
                ${isCompleted
                    ? '<button class="view-ad-btn" disabled>Completed</button>'
                    : `<button class="view-ad-btn" data-task-id="${task.id}">View Ad</button>`}
            </div>`;
        });
        // Show message if all tasks are completed or there are no tasks
        const hasAvailable = state.tasks.some(t => !completedTaskIds.has(t.id));
        userTaskList.innerHTML = state.tasks.length > 0 && hasAvailable ? taskCards.join('') : '<p>No tasks available right now. Check back later!</p>';
    }
    
    // --- EVENT LISTENERS ---
    appContainer.addEventListener('click', (e) => {
        if (e.target.id === 'show-register') { e.preventDefault(); navigateTo('register'); }
        if (e.target.id === 'show-login') { e.preventDefault(); navigateTo('login'); }
        if (e.target.id === 'admin-logout-btn' || e.target.id === 'user-logout-btn') { logout(); }
        
        if (e.target.matches('.nav-btn')) {
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
            document.getElementById(e.target.dataset.target).classList.add('active');
        }

        // Admin actions
        if (e.target.matches('.delete-btn[data-task-id]')) {
            const taskId = parseInt(e.target.dataset.taskId);
            state.tasks = state.tasks.filter(t => t.id !== taskId);
            saveState(); renderAdminDashboard(); showAlert('Task deleted.', 'success');
        }
        if (e.target.matches('.edit-btn[data-task-id]')) {
            const taskId = parseInt(e.target.dataset.taskId);
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;
            const newUrl = prompt('Update task URL:', task.url) || task.url;
            const newRewardStr = prompt('Update reward amount:', String(task.reward));
            const newDurationStr = prompt('Update duration (seconds):', String(task.duration));
            const newReward = Number(newRewardStr);
            const newDuration = parseInt(newDurationStr);
            if (Number.isFinite(newReward) && Number.isFinite(newDuration) && newDuration > 0) {
                task.url = newUrl;
                task.reward = newReward;
                task.duration = newDuration;
                saveState(); renderAdminDashboard(); showAlert('Task updated.', 'success');
            } else {
                showAlert('Invalid values provided. Task not updated.', 'error');
            }
        }
        if (e.target.matches('.approve-btn[data-user-id]')) {
            const userId = parseInt(e.target.dataset.userId);
            const user = state.users.find(u => u.id === userId);
            if (user) { user.status = 'approved'; saveState(); renderAdminDashboard(); showAlert('User approved.', 'success'); }
        }
        if (e.target.matches('.delete-btn[data-user-id]')) {
            if(confirm('Are you sure you want to delete this user?')){
                const userId = parseInt(e.target.dataset.userId);
                state.users = state.users.filter(u => u.id !== userId);
                saveState(); renderAdminDashboard(); showAlert('User deleted.', 'success');
            }
        }
        if (e.target.matches('.complete-btn[data-withdrawal-id]')) {
            const withdrawalId = parseInt(e.target.dataset.withdrawalId);
            const withdrawal = state.withdrawals.find(w => w.id === withdrawalId);
            if (withdrawal) { withdrawal.status = 'completed'; saveState(); renderAdminDashboard(); showAlert('Withdrawal completed.', 'success');}
        }

        // User actions
        if (e.target.matches('.view-ad-btn') && !e.target.disabled) {
            const taskId = parseInt(e.target.dataset.taskId);
            startTask(state.tasks.find(t => t.id === taskId));
        }
        if(e.target.id === 'return-to-dashboard-btn'){
            navigateTo('user-dashboard');
            renderUserDashboard(); // Explicitly re-render
        }
        if(e.target.id === 'show-withdraw-page'){ navigateTo('user-withdraw'); }
        if(e.target.id === 'show-profile-page'){ navigateTo('user-profile'); fillProfileForm(); }
        if(e.target.matches('.back-to-dash')){ navigateTo('user-dashboard'); }
        if(e.target.id === 'branding-reset-btn'){
            state.branding.primaryColor = '#0a2540';
            state.branding.secondaryColor = '#00d4ff';
            saveState();
            applyBranding();
            renderAdminDashboard();
            showAlert('Colors reset to default.', 'success');
        }
    });

    // Live admin user search
    appContainer.addEventListener('input', (e) => {
        if(e.target.id === 'admin-user-search'){
            renderAdminDashboard();
        }
    });

    appContainer.addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.target.id === 'login-form') {
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            login(username, password);
        }
        if (e.target.id === 'register-form') {
            const name = document.getElementById('register-name').value;
            const username = document.getElementById('register-username').value;
            const password = document.getElementById('register-password').value;
            register(name, username, password);
            e.target.reset();
        }
        if (e.target.id === 'add-task-form') {
            const url = document.getElementById('task-url').value;
            const reward = parseFloat(document.getElementById('task-reward').value);
            const duration = parseInt(document.getElementById('task-duration').value);
            addTask(url, reward, duration);
            e.target.reset();
        }
        if(e.target.id === 'admin-password-form'){
            const newPassword = document.getElementById('admin-new-password').value;
            if(newPassword.length < 4){ showAlert('Password must be at least 4 characters.', 'error'); return; }
            const adminUser = state.users.find(u => u.id === state.currentUser.id);
            adminUser.password = newPassword;
            saveState(); showAlert('Password updated.', 'success'); e.target.reset();
        }
        if(e.target.id === 'withdraw-form'){
            const amount = parseFloat(document.getElementById('withdraw-amount').value);
            const bkash = document.getElementById('withdraw-bkash').value;
            const nagad = document.getElementById('withdraw-nagad').value;
            const rocket = document.getElementById('withdraw-rocket').value;
            requestWithdrawal(amount, { bkash, nagad, rocket });
            e.target.reset();
        }
        if(e.target.id === 'branding-form'){
            const appName = document.getElementById('brand-app-name').value.trim();
            const primary = document.getElementById('brand-primary-color').value;
            const secondary = document.getElementById('brand-secondary-color').value;
            if(appName.length === 0){ showAlert('App name is required.', 'error'); return; }
            state.branding.appName = appName;
            state.branding.primaryColor = primary;
            state.branding.secondaryColor = secondary;
            saveState();
            applyBranding();
            showAlert('Branding updated.', 'success');
        }
        if(e.target.id === 'profile-form'){
            handleProfileUpdate();
        }
    });
    
    // --- AUTH & CORE LOGIC ---
    function login(username, password) {
        const user = state.users.find(u => u.username === username && u.password === password);
        if (user) {
            if (user.status === 'pending') {
                showAlert('Your account is pending admin approval.', 'error');
                return;
            }
            state.currentUser = { ...user };
            saveState();
            showAlert(`Welcome back, ${user.name}!`, 'success');
            
            if (user.role === 'admin') {
                navigateTo('admin-dashboard');
                renderAdminDashboard();
            } else {
                navigateTo('user-dashboard');
                renderUserDashboard();
            }
        } else {
            showAlert('Invalid username or password.', 'error');
        }
    }

    function register(name, username, password) {
        if (state.users.some(u => u.username === username)) {
            showAlert('Username already exists.', 'error');
            return;
        }
        const newUser = { id: Date.now(), name, username, password, role: 'user', balance: 0, status: 'pending' };
        state.users.push(newUser);
        saveState();
        showAlert('Registration successful! Please wait for admin approval.', 'success');
        navigateTo('login');
    }

    function logout() {
        state.currentUser = null;
        sessionStorage.removeItem('app_currentUser');
        navigateTo('login');
    }
    
    let activeTaskInterval = null;
    function addTask(url, reward, duration) {
        if (!url || !reward || !duration) { showAlert('Please fill all fields.', 'error'); return; }
        state.tasks.push({ id: Date.now(), url, reward, duration });
        saveState(); renderAdminDashboard(); showAlert('Task added successfully!', 'success');
    }

    function startTask(task) {
        if (!task) return;
        // Prevent starting a task that has been completed already by this user
        const user = state.users.find(u => u.id === state.currentUser.id);
        if (user && Array.isArray(user.completedTasks)) {
            const alreadyCompleted = user.completedTasks.some(ct => ct.taskId === task.id);
            if (alreadyCompleted) {
                showAlert('You have already completed this task.', 'error');
                return;
            }
        }
        navigateTo('task');
        
        let timeLeft = task.duration;
        const timerEl = document.getElementById('countdown-timer');
        const completionMsg = document.getElementById('task-completion-message');
        const timerCircle = document.querySelector('.timer-circle');

        timerCircle.style.display = 'flex';
        completionMsg.style.display = 'none';
        timerEl.textContent = timeLeft;

        window.open(task.url, '_blank');
        
        if (activeTaskInterval) clearInterval(activeTaskInterval);

        activeTaskInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(activeTaskInterval);
                activeTaskInterval = null;
                completeTask(task);
            }
        }, 1000);
    }

    function completeTask(task) {
        const user = state.users.find(u => u.id === state.currentUser.id);
        if (!user) { return; }

        // Initialize completedTasks if missing (safety for migrated data)
        if (!Array.isArray(user.completedTasks)) { user.completedTasks = []; }

        // If task already recorded as completed, do nothing (idempotent)
        const alreadyCompleted = user.completedTasks.some(ct => ct.taskId === task.id);
        if (alreadyCompleted) {
            document.getElementById('task-completion-message').style.display = 'block';
            document.querySelector('.timer-circle').style.display = 'none';
            return;
        }

        // Record completion and add reward once
        user.completedTasks.push({ taskId: task.id, completedAt: new Date().toISOString() });
        user.balance += Number(task.reward) || 0;
        state.currentUser.balance = user.balance;
        saveState();
        document.getElementById('task-completion-message').style.display = 'block';
        document.querySelector('.timer-circle').style.display = 'none';
    }

    function requestWithdrawal(amount, paymentDetails) {
        const user = state.users.find(u => u.id === state.currentUser.id);
        if(amount <= 0 || !amount){ showAlert('Please enter a valid amount.', 'error'); return; }
        if(amount > user.balance){ showAlert("You don't have enough balance.", 'error'); return; }
        if(!paymentDetails.bkash && !paymentDetails.nagad && !paymentDetails.rocket){ showAlert('Please provide at least one payment number.', 'error'); return; }

        user.balance -= amount;
        state.withdrawals.push({ id: Date.now(), userId: user.id, username: user.username, amount, status: 'pending', ...paymentDetails, date: new Date().toISOString() });
        saveState();
        showAlert('Withdrawal request submitted successfully.', 'success');
        navigateTo('user-dashboard');
        renderUserDashboard(); // Refresh dashboard to show new balance
    }

    function showAlert(message, type = 'success') {
        const alertBox = document.getElementById('alert-notification');
        alertBox.textContent = message;
        alertBox.className = 'hidden';
        void alertBox.offsetWidth; // Force reflow
        alertBox.className = `${type} show`;
        setTimeout(() => { alertBox.classList.remove('show'); }, 3000);
    }

    initializeApp();
});