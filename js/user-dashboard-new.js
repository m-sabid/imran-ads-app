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

    // Initialize user's task tracking arrays if not exists
    if (!user.completedTasks) {
        user.completedTasks = [];
    }
    if (!user.activeTask) {
        user.activeTask = null;
    }

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
        
        // First check if user has an active task
        if (user.activeTask) {
            const activeTask = tasks.find(t => t.id === user.activeTask.taskId);
            if (activeTask) {
                availableTasksDiv.innerHTML = `
                    <div class="task-card active-task">
                        <h3>Current Active Task</h3>
                        <p>Reward: $${activeTask.reward.toFixed(2)}</p>
                        <p>Duration: ${activeTask.duration} seconds</p>
                        <div class="task-status">Task in progress</div>
                        <div id="timer-display">Time remaining: ${user.activeTask.timeLeft || activeTask.duration}s</div>
                        <button class="btn btn-primary" disabled>Complete Current Task First</button>
                    </div>
                `;
                return;
            }
        }

        // Filter out tasks that have been completed by this user
        const availableTasks = tasks.filter(task => {
            const isCompleted = user.completedTasks.some(completed => completed.taskId === task.id);
            return !isCompleted;
        });

        if (availableTasks.length === 0) {
            availableTasksDiv.innerHTML = `
                <div class="task-card">
                    <p>No new tasks available at the moment.</p>
                    <p>You have completed all available tasks!</p>
                </div>`;
            return;
        }

        availableTasksDiv.innerHTML = availableTasks.map(task => `
            <div class="task-card">
                <h3>New Task Available</h3>
                <p>Reward: $${task.reward.toFixed(2)}</p>
                <p>Duration: ${task.duration} seconds</p>
                <button class="btn btn-primary" onclick="startTask('${task.id}')" ${user.activeTask ? 'disabled' : ''}>
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

    // Task handling
    window.startTask = (taskId) => {
        // Check if user already has an active task
        if (user.activeTask) {
            alert('Please complete your current task first before starting a new one!');
            return;
        }

        // Check if task has already been completed
        const isTaskCompleted = user.completedTasks.some(completedTask => completedTask.taskId === taskId);
        if (isTaskCompleted) {
            alert('You have already completed this task. Each task can only be completed once!');
            return;
        }

        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Set this as the active task
        user.activeTask = {
            taskId: task.id,
            startTime: new Date().toISOString(),
            timeLeft: task.duration
        };
        updateUserData();
        renderAvailableTasks(); // Re-render to show active task

        // Open ad in new window
        const adWindow = window.open(task.url, '_blank', 'width=800,height=600');
        
        // Start timer
        let secondsLeft = task.duration;
        const timerInterval = setInterval(() => {
            secondsLeft--;
            const timerDisplay = document.getElementById('timer-display');
            if (timerDisplay) {
                timerDisplay.textContent = `Time remaining: ${secondsLeft}s`;
            }
            
            // Update active task time left
            if (user.activeTask) {
                user.activeTask.timeLeft = secondsLeft;
                updateUserData();
            }

            if (secondsLeft <= 0) {
                clearInterval(timerInterval);
                clearInterval(windowCheckInterval);
                adWindow.close();
                completeTask(task);
            }
        }, 1000);

        // Check if window is closed prematurely
        const windowCheckInterval = setInterval(() => {
            if (adWindow.closed && secondsLeft > 0) {
                clearInterval(timerInterval);
                clearInterval(windowCheckInterval);
                cancelTask(task);
            }
        }, 1000);
    };

    function completeTask(task) {
        // Add to completed tasks
        user.completedTasks.push({
            taskId: task.id,
            url: task.url,
            reward: task.reward,
            completedAt: new Date().toISOString()
        });

        // Add reward
        user.balance += task.reward;

        // Clear active task
        user.activeTask = null;

        // Update everything
        updateUserData();
        updateBalance();
        renderAvailableTasks();
        alert(`Congratulations! Task completed successfully. You earned $${task.reward.toFixed(2)}`);
    }

    function cancelTask(task) {
        // Clear active task
        user.activeTask = null;
        updateUserData();
        renderAvailableTasks();
        alert('Task cancelled! You must keep the ad window open for the entire duration to earn the reward.');
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

    function renderWithdrawalHistory() {
        const withdrawalHistory = document.getElementById('withdrawalHistory');
        if (!user.withdrawals) return;
        
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