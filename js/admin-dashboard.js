document.addEventListener('DOMContentLoaded', () => {
    // Check admin authentication
    if (localStorage.getItem('userRole') !== 'admin') {
        window.location.href = '../index.html';
        return;
    }

    // Initialize data structures
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const users = JSON.parse(localStorage.getItem('users') || '[]');

    // Update statistics
    function updateStats() {
        document.getElementById('totalUsers').textContent = users.length;
        document.getElementById('pendingApprovals').textContent = users.filter(u => !u.isApproved).length;
        document.getElementById('activeTasks').textContent = tasks.length;
        document.getElementById('pendingWithdrawals').textContent = 
            users.reduce((acc, user) => acc + user.withdrawals.filter(w => w.status === 'pending').length, 0);
    }

    // Handle user management
    function renderUsers() {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = users.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td>
                    <span class="status-badge ${user.isApproved ? 'status-completed' : 'status-pending'}">
                        ${user.isApproved ? 'Approved' : 'Pending'}
                    </span>
                </td>
                <td>$${user.balance.toFixed(2)}</td>
                <td>
                    ${!user.isApproved ? 
                        `<button class="btn btn-primary" onclick="approveUser('${user.username}')">Approve</button>` :
                        `<button class="btn btn-accent" onclick="blockUser('${user.username}')">Block</button>`
                    }
                </td>
            </tr>
        `).join('');
    }

    // Handle task management
    const addTaskForm = document.getElementById('addTaskForm');
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const taskData = {
                id: Date.now().toString(),
                url: document.getElementById('taskUrl').value,
                reward: parseFloat(document.getElementById('taskReward').value),
                duration: parseInt(document.getElementById('taskDuration').value),
                createdAt: new Date().toISOString()
            };

            tasks.push(taskData);
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderTasks();
            addTaskForm.reset();
        });
    }

    function renderTasks() {
        const tasksList = document.getElementById('tasksList');
        tasksList.innerHTML = tasks.map(task => `
            <tr>
                <td>${task.url}</td>
                <td>$${task.reward.toFixed(2)}</td>
                <td>${task.duration}s</td>
                <td>
                    <button class="btn btn-accent" onclick="deleteTask('${task.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    // Handle withdrawal requests
    function renderWithdrawals() {
        const withdrawalsList = document.getElementById('withdrawalsList');
        const allWithdrawals = users.reduce((acc, user) => {
            return acc.concat(user.withdrawals.map(w => ({...w, username: user.username})));
        }, []);

        withdrawalsList.innerHTML = allWithdrawals
            .filter(w => w.status === 'pending')
            .map(withdrawal => `
                <tr>
                    <td>${withdrawal.username}</td>
                    <td>$${withdrawal.amount.toFixed(2)}</td>
                    <td>${withdrawal.method}</td>
                    <td>${withdrawal.account}</td>
                    <td>
                        <span class="status-badge status-pending">Pending</span>
                    </td>
                    <td>
                        <button class="btn btn-primary" onclick="approveWithdrawal('${withdrawal.username}', '${withdrawal.id}')">
                            Approve
                        </button>
                        <button class="btn btn-accent" onclick="rejectWithdrawal('${withdrawal.username}', '${withdrawal.id}')">
                            Reject
                        </button>
                    </td>
                </tr>
            `).join('');
    }

    // Navigation functions
    window.showSection = (sectionId) => {
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById(sectionId).style.display = 'block';
        
        // Update content based on section
        switch(sectionId) {
            case 'dashboard':
                updateStats();
                break;
            case 'users':
                renderUsers();
                break;
            case 'tasks':
                renderTasks();
                break;
            case 'withdrawals':
                renderWithdrawals();
                break;
        }
    };

    // User management functions
    window.approveUser = (username) => {
        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            users[userIndex].isApproved = true;
            localStorage.setItem('users', JSON.stringify(users));
            renderUsers();
            updateStats();
        }
    };

    window.blockUser = (username) => {
        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            users[userIndex].isApproved = false;
            localStorage.setItem('users', JSON.stringify(users));
            renderUsers();
            updateStats();
        }
    };

    // Task management functions
    window.deleteTask = (taskId) => {
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            tasks.splice(taskIndex, 1);
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderTasks();
            updateStats();
        }
    };

    // Withdrawal management functions
    window.approveWithdrawal = (username, withdrawalId) => {
        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            const withdrawalIndex = users[userIndex].withdrawals.findIndex(w => w.id === withdrawalId);
            if (withdrawalIndex !== -1) {
                users[userIndex].withdrawals[withdrawalIndex].status = 'approved';
                localStorage.setItem('users', JSON.stringify(users));
                renderWithdrawals();
                updateStats();
            }
        }
    };

    window.rejectWithdrawal = (username, withdrawalId) => {
        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            const withdrawalIndex = users[userIndex].withdrawals.findIndex(w => w.id === withdrawalId);
            if (withdrawalIndex !== -1) {
                const withdrawal = users[userIndex].withdrawals[withdrawalIndex];
                users[userIndex].balance += withdrawal.amount; // Refund the amount
                users[userIndex].withdrawals[withdrawalIndex].status = 'rejected';
                localStorage.setItem('users', JSON.stringify(users));
                renderWithdrawals();
                updateStats();
            }
        }
    };

    // Handle password change
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;

            if (currentPassword === 'admin') {
                localStorage.setItem('adminPassword', newPassword);
                alert('Password changed successfully!');
                changePasswordForm.reset();
            } else {
                alert('Current password is incorrect!');
            }
        });
    }

    // Logout function
    window.logout = () => {
        localStorage.removeItem('userRole');
        window.location.href = '../index.html';
    };

    // Initialize dashboard
    updateStats();
    showSection('dashboard');
});