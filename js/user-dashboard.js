document.addEventListener('DOMContentLoaded', () => {
    // Check user authentication
    if (localStorage.getItem('userRole') !== 'user') {
        window.location.href = '../index.html';
        return;
    }

    const currentUser = localStorage.getItem('currentUser');
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    let user = users.find(u => u.username === currentUser);

    // Initialize user's data structures if they don't exist
    if (!user.completedTasks) {
        user.completedTasks = [];
    }
    if (!user.activeTask) {
        user.activeTask = null;
    }
    updateUserData();

    function updateUserData() {
        const userIndex = users.findIndex(u => u.username === currentUser);
        if (userIndex !== -1) {
            users[userIndex] = user;
            localStorage.setItem('users', JSON.stringify(users));
        }
    }

    function updateBalance() {
        document.getElementById('userBalance').textContent = user.balance.toFixed(2);
    }

    function renderAvailableTasks() {
        const availableTasksDiv = document.getElementById('availableTasks');
        
        // If user has an active task, show only that task
        if (user.activeTask) {
            const activeTask = tasks.find(t => t.id === user.activeTask.taskId);
            if (activeTask) {
                availableTasksDiv.innerHTML = `
                    <div class="task-card active-task">
                        <h3>Current Active Task</h3>
                        <p>Reward: $${activeTask.reward.toFixed(2)}</p>
                        <p>Duration: ${activeTask.duration} seconds</p>
                        <p class="task-status">Task in progress - Please complete this task first</p>
                        <div class="timer-display" id="timer-${activeTask.id}">
                            Time remaining: ${user.activeTask.timeLeft}s
                        </div>
                        <button class="btn btn-primary" disabled>Task In Progress</button>
                    </div>
                `;
                return;
            }
        }

        // Filter out completed tasks
        const availableTasks = tasks.filter(task => 
            !user.completedTasks.some(completedTask => completedTask.taskId === task.id)
        );

        if (availableTasks.length === 0) {
            availableTasksDiv.innerHTML = '<div class="task-card"><p>No tasks available at the moment.</p></div>';
            return;
        }

        availableTasksDiv.innerHTML = availableTasks.map(task => `
            <div class="task-card">
                <h3>New Task Available</h3>
                <p>Reward: $${task.reward.toFixed(2)}</p>
                <p>Duration: ${task.duration} seconds</p>
                <button class="btn btn-primary" onclick="startTask('${task.id}')" 
                    ${user.activeTask ? 'disabled' : ''}>
                    ${user.activeTask ? 'Complete Current Task First' : 'Start Task'}
                </button>
            </div>
        `).join('');
    }

    function renderCompletedTasks() {
        const completedTasksList = document.getElementById('completedTasksList');
        completedTasksList.innerHTML = user.completedTasks.map(task => `
            <tr>
                <td>${task.url}</td>
                <td>$${task.reward.toFixed(2)}</td>
                <td>${new Date(task.completedAt).toLocaleString()}</td>
            </tr>
        `).join('');
    }

    function renderWithdrawalHistory() {
        const withdrawalHistory = document.getElementById('withdrawalHistory');
        withdrawalHistory.innerHTML = user.withdrawals.map(withdrawal => `
            <tr>
                <td>$${withdrawal.amount.toFixed(2)}</td>
                <td>${withdrawal.method}</td>
                <td>
                    <span class="status-badge status-${withdrawal.status}">
                        ${withdrawal.status}
                    </span>
                </td>
                <td>${new Date(withdrawal.date).toLocaleString()}</td>
            </tr>
        `).join('');
    }

    // Navigation
    window.showSection = (sectionId) => {
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById(sectionId).style.display = 'block';

        switch(sectionId) {
            case 'tasks':
                renderAvailableTasks();
                break;
            case 'completed':
                renderCompletedTasks();
                break;
            case 'withdraw':
                renderWithdrawalHistory();
                break;
        }
    };

    // Task handling
    window.startTask = (taskId) => {
        // Check if user already has an active task
        if (user.activeTask) {
            alert('Please complete your current task first!');
            return;
        }

        // Check if task has already been completed
        if (user.completedTasks.some(t => t.taskId === taskId)) {
            alert('You have already completed this task!');
            return;
        }

        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Set active task
        user.activeTask = {
            taskId: task.id,
            timeLeft: task.duration,
            startTime: new Date().toISOString()
        };
        updateUserData();

        // Open ad in new window
        const adWindow = window.open(task.url, '_blank', 'width=800,height=600');
        
        // Start timer
        let secondsLeft = task.duration;
        const timerDisplay = document.getElementById(`timer-${task.id}`);
        
        const timerInterval = setInterval(() => {
            secondsLeft--;
            user.activeTask.timeLeft = secondsLeft;
            updateUserData();
            
            if (timerDisplay) {
                timerDisplay.textContent = `Time remaining: ${secondsLeft}s`;
            }

            if (secondsLeft <= 0) {
                clearInterval(timerInterval);
                clearInterval(windowCheckInterval);
                adWindow.close();
                completeTask(task);
            }
        }, 1000);

        // Check if ad window is closed prematurely
        const windowCheckInterval = setInterval(() => {
            if (adWindow.closed && secondsLeft > 0) {
                clearInterval(timerInterval);
                clearInterval(windowCheckInterval);
                failTask(task);
            }
        }, 1000);
    };

    function completeTask(task) {
        // Add task to completed tasks
        user.completedTasks.push({
            taskId: task.id,
            url: task.url,
            reward: task.reward,
            status: 'completed',
            completedAt: new Date().toISOString()
        });

        // Add reward to balance
        user.balance += task.reward;

        // Clear active task
        user.activeTask = null;

        // Update user data
        updateUserData();
        updateBalance();
        renderAvailableTasks();
        alert(`Task completed! You earned $${task.reward.toFixed(2)}`);
    }

    function failTask(task) {
        // Record failed attempt but don't mark as completed
        // Clear active task
        user.activeTask = null;
        
        // Update user data
        updateUserData();
        renderAvailableTasks();
        alert('Task failed! You must keep the ad window open for the entire duration to earn the reward.');
    }

    // Withdrawal handling
    const withdrawalForm = document.getElementById('withdrawalForm');
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('withdrawAmount').value);
            const method = document.getElementById('withdrawMethod').value;
            const account = document.getElementById('accountNumber').value;

            if (amount > user.balance) {
                alert('Insufficient balance!');
                return;
            }

            // Create withdrawal request
            const withdrawal = {
                id: Date.now().toString(),
                amount: amount,
                method: method,
                account: account,
                status: 'pending',
                date: new Date().toISOString()
            };

            // Initialize withdrawals array if it doesn't exist
            if (!user.withdrawals) {
                user.withdrawals = [];
            }

            user.withdrawals.push(withdrawal);
            user.balance -= amount;

            updateUserData();
            updateBalance();
            renderWithdrawalHistory();
            withdrawalForm.reset();
            alert('Withdrawal request submitted successfully!');
        });
    }

    // Logout
    window.logout = () => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('currentUser');
        window.location.href = '../index.html';
    };

    // Initialize dashboard
    updateBalance();
    showSection('tasks');
});