class TodoApp {
    constructor() {
        try {
            this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            this.idCounter = Date.now();
            this.cachedToday = null;
            this.editModal = null;
            // Ensure all tasks have required properties
            this.tasks = this.tasks.map(task => ({
                ...task,
                subtasks: (task.subtasks || []).map(subtask => ({
                    ...subtask,
                    notes: subtask.notes || '',
                    subsubtasks: (subtask.subsubtasks || []).map(subsubtask => ({
                        ...subsubtask,
                        notes: subsubtask.notes || ''
                    }))
                })),
                status: task.status || 'pending',
                completed: task.completed || false,
                pinned: task.pinned || false,
                notes: task.notes || '',
                createdAt: task.createdAt || task.id || Date.now()
            }));
        } catch (error) {
            console.error('Error loading tasks from storage:', error);
            this.tasks = [];
        }
        
        this.currentFilter = 'all';
        this.currentSort = 'alphabet-az';
        this.editingTaskId = null;
        this.init();
    }

    init() {
        try {
            this.bindEvents();
            this.render();
            this.updateStats();
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }

    bindEvents() {
        this.editModal = document.getElementById('editModal');
        this.addEventListenerSafe('todoForm', 'submit', (e) => {
            e.preventDefault();
            this.addTask();
        });
        this.addEventListenerSafe('editForm', 'submit', (e) => {
            e.preventDefault();
            this.updateTask();
        });
        this.addEventListenerSafe('filterSelect', 'change', (e) => {
            this.setFilter(e.target.value);
        });
        this.addEventListenerSafe('sortSelect', 'change', (e) => {
            this.setSort(e.target.value);
        });
        
        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        window.addEventListener('click', (e) => {
            if (e.target === this.editModal) {
                this.closeModal();
            }
        });
        
        // Event delegation for task interactions
        const todoList = document.getElementById('todoList');
        if (todoList) {
            todoList.addEventListener('click', this.handleTaskClick.bind(this));
            todoList.addEventListener('change', this.handleTaskChange.bind(this));
        }
    }
    
    addEventListenerSafe(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    addTask() {
        try {
            const taskInput = document.getElementById('taskInput');
            const startDateInput = document.getElementById('startDateInput');
            const dueDateInput = document.getElementById('dueDateInput');
            const noteInput = document.getElementById('noteInput');
            
            if (!taskInput || !startDateInput || !dueDateInput) {
                console.error('Required form elements not found');
                return;
            }

            const taskText = taskInput.value.trim();
            const startDate = startDateInput.value;
            const dueDate = dueDateInput.value;

            if (!taskText || !startDate || !dueDate) {
                this.showNotification('Please fill in all required fields', 'error');
                return;
            }

            // Validate dates
            if (!this.isValidDate(startDate) || !this.isValidDate(dueDate) || new Date(startDate) > new Date(dueDate)) {
                this.showNotification('Invalid dates or start date is after due date', 'error');
                return;
            }

            // Check for duplicate task names
            if (this.tasks.some(t => t.text.toLowerCase() === taskText.toLowerCase())) {
                this.showNotification('A task with this name already exists!', 'error');
                return;
            }

            const task = {
                id: this.generateId(),
                text: taskText,
                startDate: startDate,
                dueDate: dueDate,
                notes: noteInput ? noteInput.value.trim() : '',
                status: 'pending',
                completed: false,
                pinned: false,
                subtasks: [],
                showSubtaskForm: false,
                createdAt: new Date().toISOString()
            };

            this.tasks.unshift(task);
            this.saveToStorage();
            this.render();
            this.updateStats();
            
            taskInput.value = '';
            startDateInput.value = '';
            dueDateInput.value = '';
            if (noteInput) noteInput.value = '';
        } catch (error) {
            console.error('Error adding task:', error);
            this.showNotification('Error adding task. Please try again.', 'error');
        }
    }

    editTask(id) {
        try {
            const task = this.tasks.find(t => t.id === id);
            if (!task) return;
            
            this.editingTaskId = id;
            const editTaskInput = document.getElementById('editTaskInput');
            const editStartDateInput = document.getElementById('editStartDateInput');
            const editDueDateInput = document.getElementById('editDueDateInput');
            const editNoteInput = document.getElementById('editNoteInput');
            const editStatusInput = document.getElementById('editStatusInput');

            if (editTaskInput) editTaskInput.value = task.text;
            if (editStartDateInput) editStartDateInput.value = task.startDate;
            if (editDueDateInput) editDueDateInput.value = task.dueDate;
            if (editNoteInput) editNoteInput.value = task.notes || '';
            if (editStatusInput) editStatusInput.value = task.status || 'pending';
            if (this.editModal) this.editModal.style.display = 'block';
        } catch (error) {
            console.error('Error editing task:', error);
        }
    }

    updateTask() {
        try {
            const task = this.tasks.find(t => t.id === this.editingTaskId);
            if (!task) return;

            const editTaskInput = document.getElementById('editTaskInput');
            const editStartDateInput = document.getElementById('editStartDateInput');
            const editDueDateInput = document.getElementById('editDueDateInput');
            const editNoteInput = document.getElementById('editNoteInput');
            const editStatusInput = document.getElementById('editStatusInput');

            if (editTaskInput) {
                const newText = editTaskInput.value.trim();
                if (!newText) {
                    this.showNotification('Task name cannot be empty', 'error');
                    return;
                }
                
                if (this.tasks.some(t => t.id !== this.editingTaskId && t.text.toLowerCase() === newText.toLowerCase())) {
                    this.showNotification('A task with this name already exists!', 'error');
                    return;
                }
                task.text = newText;
            }

            if (editStartDateInput && editDueDateInput) {
                const startDate = editStartDateInput.value;
                const dueDate = editDueDateInput.value;
                
                if (!this.isValidDate(startDate) || !this.isValidDate(dueDate) || new Date(startDate) > new Date(dueDate)) {
                    this.showNotification('Invalid dates or start date is after due date', 'error');
                    return;
                }
                
                task.startDate = startDate;
                task.dueDate = dueDate;
            }

            if (editNoteInput) {
                task.notes = editNoteInput.value.trim();
            }

            if (editStatusInput) {
                const wasCompleted = task.completed;
                task.status = editStatusInput.value;
                task.completed = task.status === 'completed';
                
                if (task.completed && !wasCompleted) {
                    task.completedAt = new Date().toISOString();
                } else if (!task.completed && wasCompleted) {
                    delete task.completedAt;
                }
            }
            
            this.saveToStorage();
            this.render();
            this.updateStats();
            this.closeModal();
        } catch (error) {
            console.error('Error updating task:', error);
            this.showNotification('Error updating task. Please try again.', 'error');
        }
    }

    closeModal() {
        if (this.editModal) {
            this.editModal.style.display = 'none';
        }
        this.editingTaskId = null;
    }

    toggleTask(id) {
        try {
            const task = this.tasks.find(t => t.id === id);
            if (task) {
                task.completed = !task.completed;
                task.status = task.completed ? 'completed' : 'pending';
                
                if (task.completed) {
                    task.completedAt = new Date().toISOString();
                } else {
                    delete task.completedAt;
                }
                
                this.saveToStorage();
                this.render();
                this.updateStats();
            }
        } catch (error) {
            console.error('Error toggling task:', error);
        }
    }

    togglePin(id) {
        try {
            const task = this.tasks.find(t => t.id === id);
            if (task) {
                task.pinned = !task.pinned;
                this.saveToStorage();
                this.render();
                this.updateStats();
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    }

    deleteTask(id) {
        try {
            if (this.showConfirm('Are you sure you want to delete this task?')) {
                this.tasks = this.tasks.filter(t => t.id !== id);
                this.saveToStorage();
                this.render();
                this.updateStats();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }

    addSubtask(taskId, subtaskText, subtaskNotes = '') {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task || !subtaskText.trim()) return;

            const trimmedText = subtaskText.trim();
            
            if (task.subtasks && task.subtasks.some(s => s.text.toLowerCase() === trimmedText.toLowerCase())) {
                this.showNotification('A subtask with this name already exists in this task!', 'error');
                return;
            }

            const subtask = {
                id: this.generateId(),
                text: trimmedText,
                completed: false,
                pinned: false,
                notes: subtaskNotes || '',
                subsubtasks: [],
                showSubSubtaskForm: false
            };
            
            task.subtasks = task.subtasks || [];
            task.subtasks.push(subtask);
            this.saveToStorage();
            this.render();
        } catch (error) {
            console.error('Error adding subtask:', error);
        }
    }

    toggleSubtask(taskId, subtaskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.subtasks) {
                const subtask = task.subtasks.find(s => s.id === subtaskId);
                if (subtask) {
                    subtask.completed = !subtask.completed;
                    this.saveToStorage();
                    this.render();
                }
            }
        } catch (error) {
            console.error('Error toggling subtask:', error);
        }
    }

    editSubtask(taskId, subtaskId, newText) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task || !task.subtasks || !newText.trim()) return;

            const subtask = task.subtasks.find(s => s.id === subtaskId);
            if (!subtask) return;

            const trimmedText = newText.trim();
            
            if (task.subtasks.some(s => s.id !== subtaskId && s.text.toLowerCase() === trimmedText.toLowerCase())) {
                this.showNotification('A subtask with this name already exists in this task!', 'error');
                return;
            }
            
            subtask.text = trimmedText;
            this.saveToStorage();
            this.render();
        } catch (error) {
            console.error('Error editing subtask:', error);
        }
    }

    toggleSubtaskPin(taskId, subtaskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.subtasks) {
                const subtask = task.subtasks.find(s => s.id === subtaskId);
                if (subtask) {
                    subtask.pinned = !subtask.pinned;
                    if (subtask.pinned) {
                        task.pinned = true;
                    }
                    this.saveToStorage();
                    this.render();
                }
            }
        } catch (error) {
            console.error('Error toggling subtask pin:', error);
        }
    }

    deleteSubtask(taskId, subtaskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.subtasks) {
                task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
                this.saveToStorage();
                this.render();
            }
        } catch (error) {
            console.error('Error deleting subtask:', error);
        }
    }

    addSubSubtask(taskId, subtaskId, subsubtaskText, subsubtaskNotes = '') {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task || !task.subtasks || !subsubtaskText.trim()) return;

            const subtask = task.subtasks.find(s => s.id === subtaskId);
            if (!subtask) return;

            const trimmedText = subsubtaskText.trim();
            
            if (subtask.subsubtasks && subtask.subsubtasks.some(ss => ss.text.toLowerCase() === trimmedText.toLowerCase())) {
                this.showNotification('A sub-subtask with this name already exists in this subtask!', 'error');
                return;
            }

            const subsubtask = {
                id: this.generateId(),
                text: trimmedText,
                completed: false,
                pinned: false,
                notes: subsubtaskNotes || ''
            };
            
            subtask.subsubtasks = subtask.subsubtasks || [];
            subtask.subsubtasks.push(subsubtask);
            this.saveToStorage();
            this.render();
        } catch (error) {
            console.error('Error adding sub-subtask:', error);
        }
    }

    toggleSubSubtask(taskId, subtaskId, subsubtaskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.subtasks) {
                const subtask = task.subtasks.find(s => s.id === subtaskId);
                if (subtask && subtask.subsubtasks) {
                    const subsubtask = subtask.subsubtasks.find(ss => ss.id === subsubtaskId);
                    if (subsubtask) {
                        subsubtask.completed = !subsubtask.completed;
                        this.saveToStorage();
                        this.render();
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling sub-subtask:', error);
        }
    }

    toggleSubSubtaskPin(taskId, subtaskId, subsubtaskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.subtasks) {
                const subtask = task.subtasks.find(s => s.id === subtaskId);
                if (subtask && subtask.subsubtasks) {
                    const subsubtask = subtask.subsubtasks.find(ss => ss.id === subsubtaskId);
                    if (subsubtask) {
                        subsubtask.pinned = !subsubtask.pinned;
                        if (subsubtask.pinned) {
                            subtask.pinned = true;
                            task.pinned = true;
                        }
                        this.saveToStorage();
                        this.render();
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling sub-subtask pin:', error);
        }
    }

    deleteSubSubtask(taskId, subtaskId, subsubtaskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.subtasks) {
                const subtask = task.subtasks.find(s => s.id === subtaskId);
                if (subtask && subtask.subsubtasks) {
                    subtask.subsubtasks = subtask.subsubtasks.filter(ss => ss.id !== subsubtaskId);
                    this.saveToStorage();
                    this.render();
                }
            }
        } catch (error) {
            console.error('Error deleting sub-subtask:', error);
        }
    }

    setFilter(filter) {
        try {
            this.currentFilter = filter;
            const filterSelect = document.getElementById('filterSelect');
            if (filterSelect) {
                filterSelect.value = filter;
            }
            this.render();
        } catch (error) {
            console.error('Error setting filter:', error);
        }
    }

    setSort(sort) {
        try {
            this.currentSort = sort;
            const sortSelect = document.getElementById('sortSelect');
            if (sortSelect) {
                sortSelect.value = sort;
            }
            this.render();
        } catch (error) {
            console.error('Error setting sort:', error);
        }
    }

    isOverdue(task) {
        try {
            if (!task.dueDate) return false;
            
            if (!this.cachedToday) {
                this.cachedToday = new Date();
                this.cachedToday.setHours(0, 0, 0, 0);
            }
            
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate < this.cachedToday && !task.completed;
        } catch (error) {
            console.error('Error checking overdue status:', error);
            return false;
        }
    }

    getFilteredTasks() {
        try {
            let filtered = [...this.tasks];

            switch (this.currentFilter) {
                case 'pending':
                    filtered = filtered.filter(t => t.status === 'pending');
                    break;
                case 'in-progress':
                    filtered = filtered.filter(t => t.status === 'in-progress');
                    break;
                case 'completed':
                    filtered = filtered.filter(t => t.completed);
                    break;
                case 'overdue':
                    filtered = filtered.filter(t => this.isOverdue(t));
                    break;
                case 'pinned':
                    filtered = filtered.filter(t => t.pinned);
                    break;
                default:
                    break;
            }

            return this.applySorting(filtered);
        } catch (error) {
            console.error('Error filtering tasks:', error);
            return [];
        }
    }

    applySorting(tasks) {
        try {
            return tasks.sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                
                switch (this.currentSort) {
                    case 'alphabet-az':
                        return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
                        
                    case 'alphabet-za':
                        return b.text.toLowerCase().localeCompare(a.text.toLowerCase());
                        
                    case 'date-created':
                        return (a.createdAt || 0) - (b.createdAt || 0);
                        
                    case 'date-closed':
                        if (a.completed && !b.completed) return -1;
                        if (!a.completed && b.completed) return 1;
                        if (a.completed && b.completed) {
                            const aTime = a.completedAt || a.createdAt || 0;
                            const bTime = b.completedAt || b.createdAt || 0;
                            return bTime - aTime;
                        }
                        return 0;
                        
                    default:
                        return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
                }
            });
        } catch (error) {
            console.error('Error sorting tasks:', error);
            return tasks;
        }
    }

    render() {
        try {
            const todoList = document.getElementById('todoList');
            if (!todoList) return;

            const filteredTasks = this.getFilteredTasks();

            if (filteredTasks.length === 0) {
                todoList.innerHTML = '<div class="empty-state">No tasks found</div>';
                return;
            }

            const htmlParts = [];
            filteredTasks.forEach(task => {
                const isOverdue = this.isOverdue(task);
                const statusClass = isOverdue ? 'overdue' : (task.status || 'pending');
                
                htmlParts.push(`
                    <div class="todo-item ${task.completed ? 'completed' : ''} ${task.pinned ? 'pinned' : ''} ${statusClass}">
                        <div class="todo-header">
                            <input type="checkbox" ${task.completed ? 'checked' : ''} 
                                   data-task-id="${task.id}">
                            <div class="todo-content">
                                <div class="todo-text ${task.completed ? 'completed' : ''}">${this.escapeHtml(task.text)}</div>
                                <div class="todo-date">
                                    Start: ${this.formatDate(task.startDate)} | Due: ${this.formatDate(task.dueDate)}
                                    <span class="todo-status status-${isOverdue ? 'overdue' : (task.status || 'pending')}">
                                        ${isOverdue ? 'Overdue' : (task.status || 'pending').replace('-', ' ')}
                                    </span>
                                </div>
                                ${task.notes && task.notes.trim() ? `<div class="todo-notes"><span class="note-icon">📝</span>${this.escapeHtml(task.notes)}</div>` : ''}
                            </div>
                            <div class="todo-actions">
                                <button class="btn btn-edit" data-action="edit" data-task-id="${task.id}">Edit</button>
                                <button class="btn btn-pin ${task.pinned ? 'pinned' : ''}" 
                                        data-action="pin" data-task-id="${task.id}">
                                    ${task.pinned ? 'Unpin' : 'Pin'}
                                </button>
                                <button class="btn btn-subtask" data-action="subtask" data-task-id="${task.id}">
                                    Subtask
                                </button>
                                <button class="btn btn-delete" data-action="delete" data-task-id="${task.id}">Delete</button>
                            </div>
                        </div>
                        ${this.renderSubtasks(task)}
                    </div>
                `);
            });
            
            todoList.innerHTML = htmlParts.join('');
        } catch (error) {
            console.error('Error rendering tasks:', error);
        }
    }

    renderSubtasks(task) {
        try {
            if (!task.subtasks || (task.subtasks.length === 0 && !task.showSubtaskForm)) return '';
            
            const htmlParts = ['<div class="subtasks">'];
            
            const sortedSubtasks = [...task.subtasks].sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return b.id - a.id;
            });
            
            sortedSubtasks.forEach(subtask => {
                htmlParts.push(`
                    <div class="subtask-item ${subtask.pinned ? 'pinned' : ''}">
                        <input type="checkbox" ${subtask.completed ? 'checked' : ''} 
                               data-task-id="${task.id}" data-subtask-id="${subtask.id}">
                        <div class="subtask-content">
                            <span class="subtask-text ${subtask.completed ? 'completed' : ''}" 
                                  ondblclick="todoApp.editSubtaskInline(${task.id}, ${subtask.id})">${this.escapeHtml(subtask.text)}</span>
                            ${subtask.notes && subtask.notes.trim() ? `<div class="subtask-notes"><span class="note-icon">📝</span>${this.escapeHtml(subtask.notes)}</div>` : ''}
                        </div>
                        <div class="subtask-actions">
                            <button class="btn btn-pin ${subtask.pinned ? 'pinned' : ''}" 
                                    data-action="pin" data-task-id="${task.id}" data-subtask-id="${subtask.id}"
                                    title="${subtask.pinned ? 'Unpin subtask' : 'Pin subtask'}">
                                ${subtask.pinned ? '📌' : '📍'}
                            </button>
                            <button class="btn btn-subtask" 
                                    data-action="subsubtask" data-task-id="${task.id}" data-subtask-id="${subtask.id}"
                                    title="Add sub-subtask">
                                +
                            </button>
                            <button class="btn btn-delete" 
                                    data-action="delete" data-task-id="${task.id}" data-subtask-id="${subtask.id}"
                                    title="Delete subtask">×</button>
                        </div>
                    </div>
                    ${this.renderSubSubtasks(task.id, subtask)}
                `);
            });
            
            if (task.showSubtaskForm) {
                htmlParts.push(`
                    <div class="subtask-form">
                        <input type="text" id="subtaskInput-${task.id}" placeholder="Add subtask...">
                        <textarea id="subtaskNoteInput-${task.id}" placeholder="Add notes (optional)..." rows="2"></textarea>
                        <button data-action="add-subtask" data-task-id="${task.id}">Add</button>
                    </div>
                `);
            }
            
            htmlParts.push('</div>');
            return htmlParts.join('');
        } catch (error) {
            console.error('Error rendering subtasks:', error);
            return '';
        }
    }

    renderSubSubtasks(taskId, subtask) {
        try {
            if (!subtask.subsubtasks || (subtask.subsubtasks.length === 0 && !subtask.showSubSubtaskForm)) return '';
            
            const htmlParts = ['<div class="subsubtasks">'];
            
            const sortedSubSubtasks = [...subtask.subsubtasks].sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return b.id - a.id;
            });
            
            sortedSubSubtasks.forEach(subsubtask => {
                htmlParts.push(`
                    <div class="subsubtask-item ${subsubtask.pinned ? 'pinned' : ''}">
                        <input type="checkbox" ${subsubtask.completed ? 'checked' : ''} 
                               data-task-id="${taskId}" data-subtask-id="${subtask.id}" data-subsubtask-id="${subsubtask.id}">
                        <div class="subsubtask-content">
                            <span class="subsubtask-text ${subsubtask.completed ? 'completed' : ''}">${this.escapeHtml(subsubtask.text)}</span>
                            ${subsubtask.notes && subsubtask.notes.trim() ? `<div class="subsubtask-notes"><span class="note-icon">📝</span>${this.escapeHtml(subsubtask.notes)}</div>` : ''}
                        </div>
                        <div class="subsubtask-actions">
                            <button class="btn btn-pin ${subsubtask.pinned ? 'pinned' : ''}" 
                                    data-action="pin" data-task-id="${taskId}" data-subtask-id="${subtask.id}" data-subsubtask-id="${subsubtask.id}"
                                    title="${subsubtask.pinned ? 'Unpin sub-subtask' : 'Pin sub-subtask'}">
                                ${subsubtask.pinned ? '📌' : '📍'}
                            </button>
                            <button class="btn btn-delete" 
                                    data-action="delete" data-task-id="${taskId}" data-subtask-id="${subtask.id}" data-subsubtask-id="${subsubtask.id}"
                                    title="Delete sub-subtask">×</button>
                        </div>
                    </div>
                `);
            });
            
            if (subtask.showSubSubtaskForm) {
                htmlParts.push(`
                    <div class="subsubtask-form">
                        <input type="text" id="subsubtaskInput-${subtask.id}" placeholder="Add sub-subtask...">
                        <textarea id="subsubtaskNoteInput-${subtask.id}" placeholder="Add notes (optional)..." rows="2"></textarea>
                        <button data-action="add-subsubtask" data-task-id="${taskId}" data-subtask-id="${subtask.id}">Add</button>
                    </div>
                `);
            }
            
            htmlParts.push('</div>');
            return htmlParts.join('');
        } catch (error) {
            console.error('Error rendering sub-subtasks:', error);
            return '';
        }
    }

    editSubtaskInline(taskId, subtaskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.subtasks) {
                const subtask = task.subtasks.find(s => s.id === subtaskId);
                if (subtask) {
                    const newText = this.showPrompt('Edit subtask:', subtask.text);
                    if (newText !== null && newText.trim()) {
                        this.editSubtask(taskId, subtaskId, newText);
                    }
                }
            }
        } catch (error) {
            console.error('Error editing subtask inline:', error);
        }
    }

    toggleSubtaskForm(taskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.showSubtaskForm = !task.showSubtaskForm;
                this.render();
            }
        } catch (error) {
            console.error('Error toggling subtask form:', error);
        }
    }

    toggleSubSubtaskForm(taskId, subtaskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.subtasks) {
                const subtask = task.subtasks.find(s => s.id === subtaskId);
                if (subtask) {
                    subtask.showSubSubtaskForm = !subtask.showSubSubtaskForm;
                    this.render();
                }
            }
        } catch (error) {
            console.error('Error toggling sub-subtask form:', error);
        }
    }

    addSubtaskFromForm(taskId) {
        try {
            const input = document.getElementById(`subtaskInput-${taskId}`);
            const noteInput = document.getElementById(`subtaskNoteInput-${taskId}`);
            if (input && input.value.trim()) {
                this.addSubtask(taskId, input.value, noteInput ? noteInput.value.trim() : '');
                const task = this.tasks.find(t => t.id === taskId);
                if (task) {
                    task.showSubtaskForm = false;
                    input.value = '';
                    if (noteInput) noteInput.value = '';
                }
            }
        } catch (error) {
            console.error('Error adding subtask from form:', error);
        }
    }

    addSubSubtaskFromForm(taskId, subtaskId) {
        try {
            const input = document.getElementById(`subsubtaskInput-${subtaskId}`);
            const noteInput = document.getElementById(`subsubtaskNoteInput-${subtaskId}`);
            if (input && input.value.trim()) {
                this.addSubSubtask(taskId, subtaskId, input.value, noteInput ? noteInput.value.trim() : '');
                const task = this.tasks.find(t => t.id === taskId);
                if (task && task.subtasks) {
                    const subtask = task.subtasks.find(s => s.id === subtaskId);
                    if (subtask) {
                        subtask.showSubSubtaskForm = false;
                        input.value = '';
                        if (noteInput) noteInput.value = '';
                    }
                }
            }
        } catch (error) {
            console.error('Error adding sub-subtask from form:', error);
        }
    }

    updateStats() {
        try {
            const stats = this.tasks.reduce((acc, task) => {
                acc.total++;
                if (task.completed) acc.completed++;
                if (task.status === 'pending') acc.pending++;
                if (this.isOverdue(task)) acc.overdue++;
                return acc;
            }, { total: 0, completed: 0, pending: 0, overdue: 0 });
            
            const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

            const elements = {
                totalTasks: document.getElementById('totalTasks'),
                pendingTasks: document.getElementById('pendingTasks'),
                completedTasks: document.getElementById('completedTasks'),
                overdueTasks: document.getElementById('overdueTasks'),
                progressBar: document.getElementById('progressBar'),
                progressText: document.getElementById('progressText')
            };

            if (elements.totalTasks) elements.totalTasks.textContent = stats.total;
            if (elements.pendingTasks) elements.pendingTasks.textContent = stats.pending;
            if (elements.completedTasks) elements.completedTasks.textContent = stats.completed;
            if (elements.overdueTasks) elements.overdueTasks.textContent = stats.overdue;
            if (elements.progressBar) elements.progressBar.style.width = `${progress}%`;
            if (elements.progressText) elements.progressText.textContent = `${progress}%`;
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    formatDate(dateString) {
        try {
            if (!dateString) return 'No date';
            
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid date';
            
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid date';
        }
    }

    escapeHtml(text) {
        try {
            if (!text) return '';
            
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        } catch (error) {
            console.error('Error escaping HTML:', error);
            return text || '';
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('tasks', JSON.stringify(this.tasks));
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this.showNotification('Storage quota exceeded. Please delete some tasks.', 'error');
            } else {
                console.error('Error saving to storage:', error);
                this.showNotification('Failed to save data.', 'error');
            }
        }
    }
    
    generateId() {
        return `${Date.now()}-${++this.idCounter}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    isValidDate(dateString) {
        return dateString && !isNaN(new Date(dateString).getTime());
    }
    
    showNotification(message, type = 'info') {
        // Simple notification system - can be enhanced with UI
        console.log(`${type.toUpperCase()}: ${message}`);
        // For now, still show alert for critical errors in production
        if (type === 'error') {
            alert(message);
        }
    }
    
    showConfirm(message) {
        return confirm(message);
    }
    
    showPrompt(message, defaultValue = '') {
        return prompt(message, defaultValue);
    }
    
    handleTaskClick(e) {
        const taskId = e.target.dataset.taskId;
        const subtaskId = e.target.dataset.subtaskId;
        const subsubtaskId = e.target.dataset.subsubtaskId;
        const action = e.target.dataset.action;
        
        if (!action || !taskId) return;
        
        switch (action) {
            case 'edit':
                this.editTask(taskId);
                break;
            case 'pin':
                if (subsubtaskId) {
                    this.toggleSubSubtaskPin(taskId, subtaskId, subsubtaskId);
                } else if (subtaskId) {
                    this.toggleSubtaskPin(taskId, subtaskId);
                } else {
                    this.togglePin(taskId);
                }
                break;
            case 'delete':
                if (subsubtaskId) {
                    this.deleteSubSubtask(taskId, subtaskId, subsubtaskId);
                } else if (subtaskId) {
                    this.deleteSubtask(taskId, subtaskId);
                } else {
                    this.deleteTask(taskId);
                }
                break;
            case 'subtask':
                this.toggleSubtaskForm(taskId);
                break;
            case 'subsubtask':
                this.toggleSubSubtaskForm(taskId, subtaskId);
                break;
            case 'add-subtask':
                this.addSubtaskFromForm(taskId);
                break;
            case 'add-subsubtask':
                this.addSubSubtaskFromForm(taskId, subtaskId);
                break;
        }
    }
    
    handleTaskChange(e) {
        const taskId = e.target.dataset.taskId;
        const subtaskId = e.target.dataset.subtaskId;
        const subsubtaskId = e.target.dataset.subsubtaskId;
        
        if (!taskId) return;
        
        if (subsubtaskId) {
            this.toggleSubSubtask(taskId, subtaskId, subsubtaskId);
        } else if (subtaskId) {
            this.toggleSubtask(taskId, subtaskId);
        } else {
            this.toggleTask(taskId);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.todoApp = new TodoApp();
    } catch (error) {
        console.error('Error initializing TodoApp:', error);
    }
});