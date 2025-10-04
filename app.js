// Postdoc Application Tracker JavaScript

// Application state
let applications = [];

let config = {
    referenceWriters: ['henrich', 'sandor', 'farbod', 'hoffman', 'leiblich', 'branden'],
    materials: ['cover', 'cv', 'research', 'teaching', 'diversity', 'pubs'],
    statusOptions: ['pending', 'in-progress', 'submitted'],
    customFields: [],
    customChecklists: []
};

let editingId = null;
let searchTerm = '';
let filterType = 'all';
let sortBy = 'deadline';
let hasUnsavedChanges = false;

// Initialize the app
function init() {
    setupEventListeners();
    updateApplicationsData();
    renderApplications();
    updateStats();
    updateFilterOptions();
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTerm = e.target.value;
        renderApplications();
    });

    document.getElementById('filterType').addEventListener('change', (e) => {
        filterType = e.target.value;
        renderApplications();
    });

    document.getElementById('sortBy').addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderApplications();
    });

    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges || applications.length > 0) {
            e.preventDefault();
            e.returnValue = 'You have unsaved data! Please export your data before closing to avoid losing your work.';
            return e.returnValue;
        }
    });
}

function updateApplicationsData() {
    applications = applications.map(app => {
        const refs = {};
        config.referenceWriters.forEach(writer => {
            // Preserve existing triple-state values, default to false for new writers
            refs[writer] = app.refs && app.refs[writer] !== undefined ? app.refs[writer] : false;
        });
        const materials = {};
        config.materials.forEach(material => {
            // Preserve existing triple-state values, default to false for new materials
            materials[material] = app.materials && app.materials[material] !== undefined ? app.materials[material] : false;
        });
        const customChecklistValues = {};
        config.customChecklists.forEach(checklist => {
            customChecklistValues[checklist.id] = customChecklistValues[checklist.id] || {};
            checklist.items.forEach(item => {
                // Preserve existing triple-state values, default to false for new items
                customChecklistValues[checklist.id][item] = app.customChecklistValues && 
                    app.customChecklistValues[checklist.id] && 
                    app.customChecklistValues[checklist.id][item] !== undefined ? 
                    app.customChecklistValues[checklist.id][item] : false;
            });
        });
        return { ...app, refs, materials, customChecklistValues };
    });
}

function updateFilterOptions() {
    const filterSelect = document.getElementById('filterType');
    filterSelect.innerHTML = '<option value="all">All Status</option>';
    config.statusOptions.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status.replace(/-/g, ' ');
        filterSelect.appendChild(option);
    });
}

function getDaysUntilDeadline(deadline) {
    if (!deadline) return null;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function getFilteredApplications() {
    let filtered = applications.filter(app => {
        const matchesSearch = searchTerm === '' || 
            app.school.toLowerCase().includes(searchTerm.toLowerCase()) ||
            app.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (app.location && app.location.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesFilter = filterType === 'all' || app.status === filterType;
        
        return matchesSearch && matchesFilter;
    });

    filtered.sort((a, b) => {
        if (sortBy === 'deadline') {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        } else if (sortBy === 'school') {
            return a.school.localeCompare(b.school);
        }
        return 0;
    });

    return filtered;
}

function updateStats() {
    document.getElementById('stat-total').textContent = applications.length;
    document.getElementById('stat-submitted').textContent = applications.filter(a => a.status === 'submitted').length;
    document.getElementById('stat-in-progress').textContent = applications.filter(a => a.status === 'in-progress').length;
    document.getElementById('stat-pending').textContent = applications.filter(a => a.status === 'pending').length;
}

function renderApplications() {
    const container = document.getElementById('applicationsList');
    const filtered = getFilteredApplications();
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No applications found matching your criteria</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(app => {
        const daysLeft = getDaysUntilDeadline(app.deadline);
        const isUrgent = daysLeft !== null && daysLeft <= 14;
        const isEditing = editingId === app.id;

        if (isEditing) {
            return renderEditForm(app);
        }

        return `
            <div class="application-card ${isUrgent ? 'urgent' : ''}">
                <div class="application-header">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                            <h3 class="application-title">${app.school}</h3>
                            <span class="status-badge status-${app.status}">
                                ${getStatusIcon(app.status)} ${app.status.replace(/-/g, ' ')}
                            </span>
                        </div>
                        <p style="color: #374151; font-weight: 500; margin-bottom: 0.5rem;">${app.position}</p>
                        ${app.title ? `<p style="color: #6b7280; font-size: 0.875rem; font-style: italic; margin-bottom: 0.5rem;">${app.title}</p>` : ''}
                        
                        <div class="info-row">
                            ${app.location ? `<div class="info-item"><span class="icon">📍</span> ${app.location}</div>` : ''}
                            ${app.deadline ? `
                                <div class="info-item ${isUrgent ? 'urgent' : ''}">
                                    <span class="icon">📅</span>
                                    Deadline: ${new Date(app.deadline).toLocaleDateString()}
                                    ${daysLeft !== null ? `<span style="margin-left: 0.25rem;">(${daysLeft} days)</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="editApplication(${app.id})">
                            <span class="icon">✏️</span> Edit
                        </button>
                        <button class="btn btn-danger" onclick="deleteApplication(${app.id})" title="Delete this application">
                            <span class="icon">🗑️</span> Delete
                        </button>
                        ${app.link ? `
                            <a href="${app.link}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                                View Posting
                            </a>
                        ` : ''}
                    </div>
                </div>

                ${renderProgressSections(app)}
                ${renderDetails(app)}
            </div>
        `;
    }).join('');
}

function renderProgressSections(app) {
    let html = '';

    if (config.referenceWriters.length > 0) {
        const completed = Object.values(app.refs || {}).filter(val => val === true || val === 1).length;
        const numRefsRequired = app.numRefs || 3; // Default to 3 if not specified
        html += `
            <div class="progress-section" style="background: #eff6ff;">
                <div class="progress-header">
                    <span class="progress-title">Reference Letters</span>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span class="progress-count">${completed} / ${config.referenceWriters.length} submitted</span>
                        <span style="font-size: 0.75rem; color: #6366f1; background: #e0e7ff; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-weight: 500;">
                            ${numRefsRequired} needed
                        </span>
                    </div>
                </div>
                <div class="progress-items">
                    ${config.referenceWriters.map(name => {
                        const refValue = app.refs && app.refs[name];
                        let itemClass = 'incomplete';
                        let icon = '○';
                        
                        if (refValue === true || refValue === 1) {
                            itemClass = 'complete';
                            icon = '✓';
                        } else if (refValue === 2 || refValue === 'optional') {
                            itemClass = 'optional';
                            icon = '~';
                        }
                        
                        return `<span class="progress-item ${itemClass}">
                            ${icon} ${name}
                        </span>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    if (config.materials.length > 0) {
        const completed = Object.values(app.materials || {}).filter(val => val === true || val === 1).length;
        html += `
            <div class="progress-section" style="background: #f3e8ff;">
                <div class="progress-header">
                    <span class="progress-title">Application Materials</span>
                    <span class="progress-count">${completed} / ${config.materials.length} ready</span>
                </div>
                <div class="progress-items">
                    ${config.materials.map(name => {
                        const materialValue = app.materials && app.materials[name];
                        let itemClass = 'incomplete';
                        let icon = '○';
                        
                        if (materialValue === true || materialValue === 1) {
                            itemClass = 'complete';
                            icon = '✓';
                        } else if (materialValue === 2 || materialValue === 'optional') {
                            itemClass = 'optional';
                            icon = '~';
                        }
                        
                        return `<span class="progress-item ${itemClass}">
                            ${icon} ${name === 'cv' ? 'CV' : name}
                        </span>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    config.customChecklists.forEach(checklist => {
        const values = app.customChecklistValues && app.customChecklistValues[checklist.id] || {};
        const completed = Object.values(values).filter(val => val === true || val === 1).length;
        html += `
            <div class="progress-section" style="background: #fef3c7;">
                <div class="progress-header">
                    <span class="progress-title">${checklist.name}</span>
                    <span class="progress-count">${completed} / ${checklist.items.length} complete</span>
                </div>
                <div class="progress-items">
                    ${checklist.items.map(item => {
                        const itemValue = values[item];
                        let itemClass = 'incomplete';
                        let icon = '○';
                        
                        if (itemValue === true || itemValue === 1) {
                            itemClass = 'complete';
                            icon = '✓';
                        } else if (itemValue === 2 || itemValue === 'optional') {
                            itemClass = 'optional';
                            icon = '~';
                        }
                        
                        return `<span class="progress-item ${itemClass}">
                            ${icon} ${item}
                        </span>`;
                    }).join('')}
                </div>
            </div>
        `;
    });

    return html;
}

function renderDetails(app) {
    let details = [];

    config.customFields.forEach(field => {
        const value = app.customFieldValues && app.customFieldValues[field.id];
        if (value) {
            if (field.type === 'url') {
                details.push(`<div class="detail-item"><span class="icon">📄</span><span class="detail-label">${field.name}:</span> <a href="${value}" target="_blank" rel="noopener noreferrer" style="color: #2563eb;">${value}</a></div>`);
            } else {
                details.push(`<div class="detail-item"><span class="icon">📄</span><span class="detail-label">${field.name}:</span> <span class="detail-value">${value}</span></div>`);
            }
        }
    });

    if (app.connections) {
        details.push(`<div class="detail-item"><span class="icon">👤</span><span class="detail-label">Connections:</span> <span class="detail-value">${app.connections}</span></div>`);
    }

    if (app.contact) {
        details.push(`<div class="detail-item"><span class="icon">✉️</span><span class="detail-label">Contact:</span> <a href="mailto:${app.contact}" style="color: #2563eb;">${app.contact}</a></div>`);
    }

    if (app.comments) {
        details.push(`<div class="detail-item"><span class="icon">⚠️</span><span class="detail-label">Notes:</span> <span class="detail-value">${app.comments}</span></div>`);
    }

    return details.length > 0 ? `<div class="detail-section">${details.join('')}</div>` : '';
}

function getStatusIcon(status) {
    switch(status) {
        case 'submitted': return '✅';
        case 'in-progress': return '🕐';
        default: return '⚠️';
    }
}

function renderEditForm(app) {
    const formHtml = `
        <div class="application-card">
            <div class="edit-form">
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">Edit Application</h2>
                ${renderFormFields(app, false)}
            </div>
        </div>
    `;
    return formHtml;
}

function renderFormFields(app, isNew) {
    const customFieldsInGrid = config.customFields.filter(field => field.type !== 'textarea');
    const customFieldsFullWidth = config.customFields.filter(field => field.type === 'textarea');
    
    return `
        <div class="form-grid">
            <div class="form-group">
                <label class="form-label">School/Institution *</label>
                <input type="text" class="form-input" id="${isNew ? 'new' : 'edit'}-school" value="${app.school || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Position *</label>
                <input type="text" class="form-input" id="${isNew ? 'new' : 'edit'}-position" value="${app.position || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Position Title</label>
                <input type="text" class="form-input" id="${isNew ? 'new' : 'edit'}-title" value="${app.title || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Location</label>
                <input type="text" class="form-input" id="${isNew ? 'new' : 'edit'}-location" value="${app.location || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Deadline</label>
                <input type="date" class="form-input" id="${isNew ? 'new' : 'edit'}-deadline" value="${app.deadline || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-input" id="${isNew ? 'new' : 'edit'}-status">
                    ${config.statusOptions.map(status => 
                        `<option value="${status}" ${app.status === status ? 'selected' : ''}>${status.replace(/-/g, ' ')}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Contact Email</label>
                <input type="email" class="form-input" id="${isNew ? 'new' : 'edit'}-contact" value="${app.contact || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Connections</label>
                <input type="text" class="form-input" id="${isNew ? 'new' : 'edit'}-connections" value="${app.connections || ''}">
            </div>
            ${customFieldsInGrid.map(field => `
                <div class="form-group">
                    <label class="form-label">${field.name}</label>
                    <input type="${field.type}" class="form-input" id="${isNew ? 'new' : 'edit'}-custom-${field.id}" value="${app.customFieldValues && app.customFieldValues[field.id] || ''}">
                </div>
            `).join('')}
        </div>
        <div class="form-group">
            <label class="form-label">Application Link/URL</label>
            <input type="url" class="form-input" id="${isNew ? 'new' : 'edit'}-link" value="${app.link || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Comments/Notes</label>
            <textarea class="form-textarea" id="${isNew ? 'new' : 'edit'}-comments" rows="3">${app.comments || ''}</textarea>
        </div>
        
        ${customFieldsFullWidth.map(field => `
            <div class="form-group">
                <label class="form-label">${field.name}</label>
                <textarea class="form-textarea" id="${isNew ? 'new' : 'edit'}-custom-${field.id}" rows="3">${app.customFieldValues && app.customFieldValues[field.id] || ''}</textarea>
            </div>
        `).join('')}
        
        ${renderCheckboxSections(app, isNew)}
        
        <div style="display: flex; gap: 0.5rem; padding-top: 0.5rem;">
            <button class="btn btn-primary" onclick="${isNew ? 'addApplication()' : `saveApplication(${app.id})`}">
                <span class="icon">💾</span> ${isNew ? 'Add Application' : 'Save Changes'}
            </button>
            <button class="btn btn-secondary" onclick="${isNew ? 'hideAddForm()' : 'cancelEdit()'}">
                <span class="icon">✕</span> Cancel
            </button>
        </div>
    `;
}

function renderCheckboxSections(app, isNew) {
    let html = '';
    
    if (config.referenceWriters.length > 0) {
        html += `
            <div class="form-group">
                <label class="form-label">Reference Letters</label>
                <div class="checkbox-group">
                    ${config.referenceWriters.map(ref => {
                        const refValue = app.refs && app.refs[ref];
                        let checkedState = '';
                        let displayText = ref;
                        
                        if (refValue === true || refValue === 1) {
                            checkedState = 'checked';
                        } else if (refValue === 2 || refValue === 'optional') {
                            displayText = `${ref} (optional)`;
                        }
                        
                        return `<label class="checkbox-label" onclick="toggleTripleState('${isNew ? 'new' : 'edit'}-ref-${ref}', this, event)">
                            <input type="hidden" id="${isNew ? 'new' : 'edit'}-ref-${ref}" value="${refValue || 0}">
                            <span class="custom-checkbox ${refValue === 2 || refValue === 'optional' ? 'optional' : (refValue === true || refValue === 1 ? 'checked' : '')}"></span>
                            <span style="text-transform: capitalize;">${displayText}</span>
                        </label>`;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    if (config.materials.length > 0) {
        html += `
            <div class="form-group">
                <label class="form-label">Application Materials</label>
                <div class="checkbox-group">
                    ${config.materials.map(material => {
                        const materialValue = app.materials && app.materials[material];
                        let displayText = material === 'cv' ? 'CV' : material;
                        
                        if (materialValue === 2 || materialValue === 'optional') {
                            displayText += ' (optional)';
                        }
                        
                        return `<label class="checkbox-label" onclick="toggleTripleState('${isNew ? 'new' : 'edit'}-material-${material}', this, event)">
                            <input type="hidden" id="${isNew ? 'new' : 'edit'}-material-${material}" value="${materialValue || 0}">
                            <span class="custom-checkbox ${materialValue === 2 || materialValue === 'optional' ? 'optional' : (materialValue === true || materialValue === 1 ? 'checked' : '')}"></span>
                            <span style="text-transform: capitalize;">${displayText}</span>
                        </label>`;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    config.customChecklists.forEach(checklist => {
        const values = app.customChecklistValues && app.customChecklistValues[checklist.id] || {};
        html += `
            <div class="form-group">
                <label class="form-label">${checklist.name}</label>
                <div class="checkbox-group">
                    ${checklist.items.map(item => {
                        const itemValue = values[item];
                        let displayText = item;
                        
                        if (itemValue === 2 || itemValue === 'optional') {
                            displayText += ' (optional)';
                        }
                        
                        return `<label class="checkbox-label" onclick="toggleTripleState('${isNew ? 'new' : 'edit'}-checklist-${checklist.id}-${item}', this, event)">
                            <input type="hidden" id="${isNew ? 'new' : 'edit'}-checklist-${checklist.id}-${item}" value="${itemValue || 0}">
                            <span class="custom-checkbox ${itemValue === 2 || itemValue === 'optional' ? 'optional' : (itemValue === true || itemValue === 1 ? 'checked' : '')}"></span>
                            <span>${displayText}</span>
                        </label>`;
                    }).join('')}
                </div>
            </div>
        `;
    });
    
    return html;
}

function editApplication(id) {
    editingId = id;
    renderApplications();
}

function cancelEdit() {
    editingId = null;
    renderApplications();
}

function toggleTripleState(inputId, labelElement, event) {
    if (event) event.preventDefault();
    
    const input = document.getElementById(inputId);
    const checkbox = labelElement.querySelector('.custom-checkbox');
    const textSpan = labelElement.querySelector('span:last-child');
    
    let currentValue = parseInt(input.value) || 0;
    let newValue = (currentValue + 1) % 3;
    
    input.value = newValue;
    
    // Update visual state
    checkbox.className = 'custom-checkbox';
    let baseText = textSpan.textContent.replace(' (optional)', '');
    
    if (newValue === 1) {
        checkbox.classList.add('checked');
        textSpan.textContent = baseText;
    } else if (newValue === 2) {
        checkbox.classList.add('optional');
        textSpan.textContent = baseText + ' (optional)';
    } else {
        textSpan.textContent = baseText;
    }
}

function deleteApplication(id) {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    
    const confirmMessage = `Are you sure you want to delete this application?\n\n` +
                         `School: ${app.school}\n` +
                         `Position: ${app.position}\n\n` +
                         `This action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
        applications = applications.filter(a => a.id !== id);
        hasUnsavedChanges = true;
        renderApplications();
        updateStats();
    }
}

function getFormData(prefix) {
    const data = {
        school: document.getElementById(`${prefix}-school`).value,
        position: document.getElementById(`${prefix}-position`).value,
        title: document.getElementById(`${prefix}-title`).value,
        location: document.getElementById(`${prefix}-location`).value,
        deadline: document.getElementById(`${prefix}-deadline`).value,
        status: document.getElementById(`${prefix}-status`).value,
        contact: document.getElementById(`${prefix}-contact`).value,
        connections: document.getElementById(`${prefix}-connections`).value,
        link: document.getElementById(`${prefix}-link`).value,
        comments: document.getElementById(`${prefix}-comments`).value,
        refs: {},
        materials: {},
        customFieldValues: {},
        customChecklistValues: {}
    };
    
    config.referenceWriters.forEach(ref => {
        const input = document.getElementById(`${prefix}-ref-${ref}`);
        if (input) {
            const value = parseInt(input.value) || 0;
            if (value === 1) data.refs[ref] = true;
            else if (value === 2) data.refs[ref] = 'optional';
            else data.refs[ref] = false;
        }
    });
    
    config.materials.forEach(material => {
        const input = document.getElementById(`${prefix}-material-${material}`);
        if (input) {
            const value = parseInt(input.value) || 0;
            if (value === 1) data.materials[material] = true;
            else if (value === 2) data.materials[material] = 'optional';
            else data.materials[material] = false;
        }
    });
    
    config.customFields.forEach(field => {
        const input = document.getElementById(`${prefix}-custom-${field.id}`);
        if (input) data.customFieldValues[field.id] = input.value;
    });
    
    config.customChecklists.forEach(checklist => {
        data.customChecklistValues[checklist.id] = {};
        checklist.items.forEach(item => {
            const input = document.getElementById(`${prefix}-checklist-${checklist.id}-${item}`);
            if (input) {
                const value = parseInt(input.value) || 0;
                if (value === 1) data.customChecklistValues[checklist.id][item] = true;
                else if (value === 2) data.customChecklistValues[checklist.id][item] = 'optional';
                else data.customChecklistValues[checklist.id][item] = false;
            }
        });
    });
    
    return data;
}

function saveApplication(id) {
    const formData = getFormData('edit');
    applications = applications.map(app => 
        app.id === id ? {...app, ...formData} : app
    );
    editingId = null;
    hasUnsavedChanges = true;
    renderApplications();
    updateStats();
}

function showAddForm() {
    const container = document.getElementById('addFormContainer');
    
    // Initialize empty app with proper structure
    const refs = {};
    config.referenceWriters.forEach(writer => {
        refs[writer] = false;
    });
    const materials = {};
    config.materials.forEach(material => {
        materials[material] = false;
    });
    const customFieldValues = {};
    config.customFields.forEach(field => {
        customFieldValues[field.id] = '';
    });
    const customChecklistValues = {};
    config.customChecklists.forEach(checklist => {
        customChecklistValues[checklist.id] = {};
        checklist.items.forEach(item => {
            customChecklistValues[checklist.id][item] = false;
        });
    });
    
    const emptyApp = {
        school: '',
        position: '',
        title: '',
        location: '',
        deadline: '',
        status: config.statusOptions[0] || 'pending',
        contact: '',
        connections: '',
        link: '',
        comments: '',
        refs,
        materials,
        customFieldValues,
        customChecklistValues
    };
    
    container.innerHTML = `
        <div class="application-card" style="border: 2px solid #2563eb;">
            <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">New Application</h2>
            ${renderFormFields(emptyApp, true)}
        </div>
    `;
}

function hideAddForm() {
    document.getElementById('addFormContainer').innerHTML = '';
}

function addApplication() {
    const formData = getFormData('new');
    const newId = applications.length > 0 ? Math.max(...applications.map(a => a.id)) + 1 : 1;
    
    // Ensure all required properties are present
    const newApp = {
        ...formData,
        id: newId,
        numRefs: 3  // Add the missing numRefs property
    };
    
    applications.push(newApp);
    hideAddForm();
    hasUnsavedChanges = true;
    renderApplications();
    updateStats();
}

function exportData() {
    try {
        // Create a standardized export format
        const dataToExport = {
            // Metadata for version compatibility
            fileFormat: {
                version: "1.0.0",
                type: "postdoc-tracker-export",
                description: "Postdoc Application Tracker Data Export"
            },
            
            // Export metadata
            exportInfo: {
                exportDate: new Date().toISOString(),
                exportedBy: "Postdoc Application Tracker",
                totalApplications: applications.length
            },
            
            // Configuration/Settings data
            settings: {
                referenceWriters: [...config.referenceWriters],
                materials: [...config.materials],
                statusOptions: [...config.statusOptions],
                customFields: config.customFields.map(field => ({
                    id: field.id,
                    name: field.name,
                    type: field.type
                })),
                customChecklists: config.customChecklists.map(checklist => ({
                    id: checklist.id,
                    name: checklist.name,
                    items: [...checklist.items]
                }))
            },
            
            // Application data - ensure all fields are preserved
            applications: applications.map(app => ({
                id: app.id,
                school: app.school || '',
                position: app.position || '',
                title: app.title || '',
                location: app.location || '',
                deadline: app.deadline || '',
                status: app.status || 'pending',
                contact: app.contact || '',
                connections: app.connections || '',
                link: app.link || '',
                comments: app.comments || '',
                numRefs: app.numRefs || 3,
                
                // Reference tracking
                refs: app.refs ? {...app.refs} : {},
                
                // Materials tracking
                materials: app.materials ? {...app.materials} : {},
                
                // Custom field values
                customFieldValues: app.customFieldValues ? {...app.customFieldValues} : {},
                
                // Custom checklist values
                customChecklistValues: app.customChecklistValues ? {...app.customChecklistValues} : {},
                
                // Add timestamp for when this application was last modified
                lastModified: new Date().toISOString()
            }))
        };
        
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `postdoc-tracker-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        hasUnsavedChanges = false;
        console.log('Export successful - Format version 1.0.0');
    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed. Please try again.');
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            console.log('Import data:', data);
            
            // Check if user has existing data and ask for import preference
            let importMode = 'replace'; // Default to replace for backward compatibility
            
            if (applications.length > 0) {
                const choice = confirm(
                    `You currently have ${applications.length} application(s) in your tracker.\n\n` +
                    `Click "OK" to ADD the imported data to your existing data (stack/merge)\n` +
                    `Click "Cancel" to REPLACE all your current data with the imported data\n\n` +
                    `Note: Adding data will preserve your existing applications and settings.`
                );
                importMode = choice ? 'add' : 'replace';
            }
            
            // Check if this is the new standardized format
            if (data.fileFormat && data.fileFormat.type === 'postdoc-tracker-export') {
                console.log('Importing standardized format version:', data.fileFormat.version);
                
                // Import settings from new format
                if (data.settings) {
                    if (importMode === 'replace') {
                        // Replace mode: completely replace settings
                        config = {
                            referenceWriters: data.settings.referenceWriters || [],
                            materials: data.settings.materials || [],
                            statusOptions: data.settings.statusOptions || ['pending', 'in-progress', 'submitted'],
                            customFields: data.settings.customFields || [],
                            customChecklists: data.settings.customChecklists || []
                        };
                    } else {
                        // Add mode: merge settings intelligently
                        mergeSettings(data.settings);
                    }
                }
                
                // Import applications from new format
                if (data.applications) {
                    const importedApps = data.applications.map(app => ({
                        id: app.id,
                        school: app.school || '',
                        position: app.position || '',
                        title: app.title || '',
                        location: app.location || '',
                        deadline: app.deadline || '',
                        status: app.status || 'pending',
                        contact: app.contact || '',
                        connections: app.connections || '',
                        link: app.link || '',
                        comments: app.comments || '',
                        numRefs: app.numRefs || 3,
                        refs: app.refs || {},
                        materials: app.materials || {},
                        customFieldValues: app.customFieldValues || {},
                        customChecklistValues: app.customChecklistValues || {}
                    }));
                    
                    if (importMode === 'replace') {
                        applications = importedApps;
                    } else {
                        // Add mode: filter out duplicates and merge applications with new IDs
                        const { uniqueApps, duplicateCount } = filterDuplicateApplications(importedApps, applications);
                        
                        const maxExistingId = applications.length > 0 ? Math.max(...applications.map(a => a.id)) : 0;
                        const appsToAdd = uniqueApps.map((app, index) => ({
                            ...app,
                            id: maxExistingId + index + 1
                        }));
                        applications = [...applications, ...appsToAdd];
                        
                        // Store duplicate info for the alert message
                        window.importDuplicateInfo = duplicateCount;
                    }
                }
                
                const modeText = importMode === 'add' ? 'added to existing data' : 'replaced existing data';
                const totalApps = importMode === 'add' ? 
                    `${data.exportInfo?.totalApplications || 0} imported (${applications.length} total)` :
                    `${data.exportInfo?.totalApplications || applications.length}`;
                
                // Include duplicate information in the message
                let duplicateMessage = '';
                if (importMode === 'add' && window.importDuplicateInfo) {
                    const dupInfo = window.importDuplicateInfo;
                    if (dupInfo.found > 0) {
                        duplicateMessage = `\n\nDuplicates skipped: ${dupInfo.found}`;
                        if (dupInfo.details.length > 0 && dupInfo.details.length <= 3) {
                            duplicateMessage += '\nSkipped applications:';
                            dupInfo.details.forEach(detail => {
                                duplicateMessage += `\n- ${detail.school}: ${detail.position}`;
                            });
                        } else if (dupInfo.details.length > 3) {
                            duplicateMessage += '\nFirst 3 skipped:';
                            dupInfo.details.slice(0, 3).forEach(detail => {
                                duplicateMessage += `\n- ${detail.school}: ${detail.position}`;
                            });
                            duplicateMessage += `\n... and ${dupInfo.details.length - 3} more`;
                        }
                    }
                    delete window.importDuplicateInfo;
                }
                
                alert(`Data imported successfully! (${modeText})\nFormat: ${data.fileFormat.version}\nApplications: ${totalApps}\nExported: ${data.exportInfo?.exportDate ? new Date(data.exportInfo.exportDate).toLocaleDateString() : 'Unknown'}${duplicateMessage}`);
            } 
            // Backward compatibility with old format
            else {
                console.log('Importing legacy format');
                
                if (importMode === 'replace') {
                    if (data.applications) applications = data.applications;
                    if (data.config) config = data.config;
                } else {
                    // Add mode for legacy format
                    if (data.config) {
                        mergeSettings(data.config);
                    }
                    if (data.applications) {
                        // Filter out duplicates for legacy format too
                        const { uniqueApps, duplicateCount } = filterDuplicateApplications(data.applications, applications);
                        
                        const maxExistingId = applications.length > 0 ? Math.max(...applications.map(a => a.id)) : 0;
                        const appsToAdd = uniqueApps.map((app, index) => ({
                            ...app,
                            id: maxExistingId + index + 1
                        }));
                        applications = [...applications, ...appsToAdd];
                        
                        // Store duplicate info for the alert message
                        window.importDuplicateInfo = duplicateCount;
                    }
                }
                
                const modeText = importMode === 'add' ? ' (added to existing data)' : '';
                
                // Include duplicate information for legacy format too
                let duplicateMessage = '';
                if (importMode === 'add' && window.importDuplicateInfo) {
                    const dupInfo = window.importDuplicateInfo;
                    if (dupInfo.found > 0) {
                        duplicateMessage = `\n\nDuplicates skipped: ${dupInfo.found}`;
                        if (dupInfo.details.length > 0 && dupInfo.details.length <= 3) {
                            duplicateMessage += '\nSkipped applications:';
                            dupInfo.details.forEach(detail => {
                                duplicateMessage += `\n- ${detail.school}: ${detail.position}`;
                            });
                        } else if (dupInfo.details.length > 3) {
                            duplicateMessage += '\nFirst 3 skipped:';
                            dupInfo.details.slice(0, 3).forEach(detail => {
                                duplicateMessage += `\n- ${detail.school}: ${detail.position}`;
                            });
                            duplicateMessage += `\n... and ${dupInfo.details.length - 3} more`;
                        }
                    }
                    delete window.importDuplicateInfo;
                }
                
                alert(`Data imported successfully! (Legacy format${modeText})${duplicateMessage}`);
            }
            
            updateApplicationsData();
            renderApplications();
            updateStats();
            updateFilterOptions();
            hasUnsavedChanges = false;
            
        } catch (error) {
            console.error('Import failed:', error);
            alert('Error importing data. Please make sure the file is valid JSON.\n\nError details: ' + error.message);
        }
    };
    
    reader.onerror = () => {
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

function isDuplicateApplication(existingApp, newApp) {
    // Compare key fields to determine if applications are duplicates
    // We'll check school, position, title, location, deadline, and status
    return existingApp.school === newApp.school &&
           existingApp.position === newApp.position &&
           existingApp.title === newApp.title &&
           existingApp.location === newApp.location &&
           existingApp.deadline === newApp.deadline &&
           existingApp.status === newApp.status &&
           existingApp.contact === newApp.contact &&
           existingApp.connections === newApp.connections &&
           existingApp.link === newApp.link &&
           existingApp.comments === newApp.comments;
}

function filterDuplicateApplications(importedApps, existingApps) {
    const uniqueApps = [];
    const duplicateCount = {
        found: 0,
        details: []
    };

    importedApps.forEach(importedApp => {
        const isDuplicate = existingApps.some(existingApp => 
            isDuplicateApplication(existingApp, importedApp)
        );
        
        if (isDuplicate) {
            duplicateCount.found++;
            duplicateCount.details.push({
                school: importedApp.school,
                position: importedApp.position
            });
        } else {
            uniqueApps.push(importedApp);
        }
    });

    return { uniqueApps, duplicateCount };
}

function mergeSettings(importedSettings) {
    // Merge reference writers (avoid duplicates)
    if (importedSettings.referenceWriters) {
        const newWriters = importedSettings.referenceWriters.filter(writer => 
            !config.referenceWriters.includes(writer)
        );
        config.referenceWriters = [...config.referenceWriters, ...newWriters];
    }
    
    // Merge materials (avoid duplicates)
    if (importedSettings.materials) {
        const newMaterials = importedSettings.materials.filter(material => 
            !config.materials.includes(material)
        );
        config.materials = [...config.materials, ...newMaterials];
    }
    
    // Merge status options (avoid duplicates)
    if (importedSettings.statusOptions) {
        const newStatuses = importedSettings.statusOptions.filter(status => 
            !config.statusOptions.includes(status)
        );
        config.statusOptions = [...config.statusOptions, ...newStatuses];
    }
    
    // Merge custom fields (avoid duplicates by ID)
    if (importedSettings.customFields) {
        const existingFieldIds = config.customFields.map(field => field.id);
        const newFields = importedSettings.customFields.filter(field => 
            !existingFieldIds.includes(field.id)
        );
        config.customFields = [...config.customFields, ...newFields];
    }
    
    // Merge custom checklists (avoid duplicates by ID)
    if (importedSettings.customChecklists) {
        const existingChecklistIds = config.customChecklists.map(checklist => checklist.id);
        const newChecklists = importedSettings.customChecklists.filter(checklist => 
            !existingChecklistIds.includes(checklist.id)
        );
        config.customChecklists = [...config.customChecklists, ...newChecklists];
    }
}

function showSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('active');
    renderSettings();
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

function renderSettings() {
    const content = document.getElementById('settingsContent');
    content.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Reference Letter Writers</h3>
            <div id="referenceWritersList"></div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                <input type="text" class="form-input" id="newRefWriter" placeholder="Add new reference writer">
                <button class="btn btn-primary" onclick="addConfigItem('referenceWriters')">Add</button>
            </div>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Application Materials</h3>
            <div id="materialsList"></div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                <input type="text" class="form-input" id="newMaterial" placeholder="Add new material">
                <button class="btn btn-primary" onclick="addConfigItem('materials')">Add</button>
            </div>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Status Options</h3>
            <div id="statusOptionsList"></div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                <input type="text" class="form-input" id="newStatus" placeholder="Add new status">
                <button class="btn btn-primary" onclick="addConfigItem('statusOptions')">Add</button>
            </div>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Custom Fields</h3>
            <div id="customFieldsList"></div>
            <div style="border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.75rem; margin-top: 0.75rem;">
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <input type="text" class="form-input" id="newCustomFieldName" placeholder="Field name" style="flex: 1;">
                    <select class="form-input" id="newCustomFieldType">
                        <option value="text">Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="date">Date</option>
                        <option value="url">URL</option>
                    </select>
                    <button class="btn btn-primary" onclick="addCustomField()">Add Field</button>
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Custom Checklists</h3>
            <div id="customChecklistsList"></div>
            <div style="border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.75rem; margin-top: 0.75rem;">
                <input type="text" class="form-input" id="newChecklistName" placeholder="Checklist name" style="margin-bottom: 0.5rem;">
                <div id="newChecklistItems">
                    <input type="text" class="form-input" placeholder="Item 1" style="margin-bottom: 0.5rem;">
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" onclick="addChecklistItem()">+ Add Item</button>
                    <button class="btn btn-primary" onclick="addCustomChecklist()">Add Checklist</button>
                </div>
            </div>
        </div>
        
        <div style="display: flex; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
            <button class="btn btn-primary" style="flex: 1;" onclick="saveSettings()">Save Settings</button>
            <button class="btn btn-secondary" onclick="closeSettings()">Cancel</button>
        </div>
    `;
    
    renderConfigList('referenceWriters', 'referenceWritersList');
    renderConfigList('materials', 'materialsList');
    renderConfigList('statusOptions', 'statusOptionsList');
    renderCustomFieldsList();
    renderCustomChecklistsList();
}

function renderConfigList(configKey, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = config[configKey].map((item, idx) => `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" class="form-input" value="${item}" onchange="updateConfigItem('${configKey}', ${idx}, this.value)">
            <button class="btn btn-secondary" style="background: #ef4444;" onclick="removeConfigItem('${configKey}', ${idx})">Remove</button>
        </div>
    `).join('');
}

function updateConfigItem(configKey, index, value) {
    config[configKey][index] = value;
}

function removeConfigItem(configKey, index) {
    config[configKey].splice(index, 1);
    renderSettings();
}

function addConfigItem(configKey) {
    const inputMap = {
        'referenceWriters': 'newRefWriter',
        'materials': 'newMaterial',
        'statusOptions': 'newStatus'
    };
    const input = document.getElementById(inputMap[configKey]);
    if (input.value.trim()) {
        const value = configKey === 'statusOptions' ? 
            input.value.toLowerCase().replace(/\s+/g, '-') : 
            input.value.toLowerCase().replace(/\s+/g, '_');
        config[configKey].push(value);
        input.value = '';
        renderSettings();
    }
}

function renderCustomFieldsList() {
    const container = document.getElementById('customFieldsList');
    container.innerHTML = config.customFields.map((field, idx) => `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.5rem; background: #f9fafb; border-radius: 0.25rem;">
            <span style="font-weight: 500;">${field.name}</span>
            <span style="font-size: 0.875rem; color: #6b7280;">(${field.type})</span>
            <button class="btn btn-secondary" style="margin-left: auto; background: #ef4444;" onclick="removeCustomField(${idx})">Remove</button>
        </div>
    `).join('');
}

function renderCustomChecklistsList() {
    const container = document.getElementById('customChecklistsList');
    container.innerHTML = config.customChecklists.map((checklist, idx) => `
        <div style="margin-bottom: 0.75rem; padding: 0.75rem; background: #f9fafb; border-radius: 0.25rem;">
            <div style="display: flex; justify-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-weight: 500;">${checklist.name}</span>
                <button class="btn btn-secondary" style="background: #ef4444;" onclick="removeCustomChecklist(${idx})">Remove</button>
            </div>
            <div style="font-size: 0.875rem; color: #6b7280;">Items: ${checklist.items.join(', ')}</div>
        </div>
    `).join('');
}

function addCustomField() {
    const nameInput = document.getElementById('newCustomFieldName');
    const typeSelect = document.getElementById('newCustomFieldType');
    
    if (nameInput.value.trim()) {
        config.customFields.push({
            id: nameInput.value.toLowerCase().replace(/\s+/g, '_'),
            name: nameInput.value,
            type: typeSelect.value
        });
        nameInput.value = '';
        typeSelect.value = 'text';
        renderSettings();
    }
}

function removeCustomField(index) {
    config.customFields.splice(index, 1);
    renderSettings();
}

function addChecklistItem() {
    const container = document.getElementById('newChecklistItems');
    const itemCount = container.children.length;
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.className = 'form-input';
    newInput.placeholder = `Item ${itemCount + 1}`;
    newInput.style.marginBottom = '0.5rem';
    container.appendChild(newInput);
}

function addCustomChecklist() {
    const nameInput = document.getElementById('newChecklistName');
    const itemsContainer = document.getElementById('newChecklistItems');
    const itemInputs = itemsContainer.querySelectorAll('input');
    
    if (nameInput.value.trim()) {
        const items = Array.from(itemInputs)
            .map(input => input.value.trim())
            .filter(value => value);
        
        if (items.length > 0) {
            config.customChecklists.push({
                id: nameInput.value.toLowerCase().replace(/\s+/g, '_'),
                name: nameInput.value,
                items: items
            });
            
            nameInput.value = '';
            itemsContainer.innerHTML = '<input type="text" class="form-input" placeholder="Item 1" style="margin-bottom: 0.5rem;">';
            renderSettings();
        }
    }
}

function removeCustomChecklist(index) {
    config.customChecklists.splice(index, 1);
    renderSettings();
}

function saveSettings() {
    updateApplicationsData();
    renderApplications();
    updateFilterOptions();
    hasUnsavedChanges = true;
    closeSettings();
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
