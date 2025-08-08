/**
 * Leads Management System
 * JavaScript functionality for handling leads data, import, and management
 */

class LeadsManager {
  constructor() {
    this.leads = [];
    this.filteredLeads = [];
    this.currentPage = 1;
    this.pageSize = 10;
    this.sortColumn = '';
    this.sortDirection = 'asc';
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadStoredLeads();
    this.renderTable();
    this.updateStats();
  }

  bindEvents() {
    // Search functionality
    const searchInput = document.getElementById('search-leads');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterLeads();
      });
    }

    // Filter dropdowns
    ['filter-stage', 'filter-source', 'filter-responsible', 'filter-date'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => {
          this.filterLeads();
        });
      }
    });

    // CSV file input
    const csvInput = document.getElementById('csv-file-input');
    if (csvInput) {
      csvInput.addEventListener('change', (e) => {
        this.handleFileUpload(e);
      });
    }

    // Import button
    const importBtn = document.getElementById('import-leads-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        this.importLeads();
      });
    }

    // Table sorting
    document.querySelectorAll('.table-sort').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const column = e.target.getAttribute('data-sort');
        this.sortTable(column);
      });
    });

    // Export functionality
    const exportBtn = document.querySelector('a[href="#"]:has(svg)');
    if (exportBtn && exportBtn.textContent.trim().includes('Export')) {
      exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.exportToCSV();
      });
    }
  }

  loadStoredLeads() {
    const stored = localStorage.getItem('leadsData');
    if (stored) {
      try {
        this.leads = JSON.parse(stored);
        this.filteredLeads = [...this.leads];
      } catch (e) {
        console.error('Error loading stored leads:', e);
        this.leads = [];
        this.filteredLeads = [];
      }
    }
  }

  saveLeads() {
    try {
      localStorage.setItem('leadsData', JSON.stringify(this.leads));
    } catch (e) {
      console.error('Error saving leads:', e);
    }
  }

  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target.result;
      const parsed = this.parseCSV(csv);
      this.showPreview(parsed.slice(0, 5)); // Show first 5 rows
      
      const importBtn = document.getElementById('import-leads-btn');
      if (importBtn) {
        importBtn.disabled = false;
        importBtn.setAttribute('data-full-data', JSON.stringify(parsed));
      }
    };
    
    reader.readAsText(file);
  }

  parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }

    return data;
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  showPreview(data) {
    if (data.length === 0) return;

    const previewDiv = document.getElementById('import-preview');
    const previewTable = document.getElementById('preview-table');
    
    if (!previewDiv || !previewTable) return;

    const headers = Object.keys(data[0]);
    
    previewTable.innerHTML = `
      <thead>
        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${data.map(row => 
          `<tr>${headers.map(h => `<td>${this.escapeHtml(row[h] || '')}</td>`).join('')}</tr>`
        ).join('')}
      </tbody>
    `;
    
    previewDiv.classList.remove('d-none');
  }

  importLeads() {
    const importBtn = document.getElementById('import-leads-btn');
    if (!importBtn) return;

    const fullData = importBtn.getAttribute('data-full-data');
    if (!fullData) return;

    try {
      const newLeads = JSON.parse(fullData);
      const skipDuplicates = document.querySelector('#modal-import-leads input[type="checkbox"]').checked;
      
      let importedCount = 0;
      let skippedCount = 0;

      newLeads.forEach(lead => {
        if (skipDuplicates && this.leads.some(existing => existing.ID === lead.ID)) {
          skippedCount++;
        } else {
          this.leads.push(lead);
          importedCount++;
        }
      });

      this.saveLeads();
      this.filterLeads();
      this.updateStats();
      this.renderTable();

      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('modal-import-leads'));
      if (modal) modal.hide();

      // Show success message
      this.showNotification(`Successfully imported ${importedCount} leads! ${skippedCount > 0 ? `Skipped ${skippedCount} duplicates.` : ''}`, 'success');

      // Reset form
      document.getElementById('csv-file-input').value = '';
      document.getElementById('import-preview').classList.add('d-none');
      importBtn.disabled = true;

    } catch (e) {
      console.error('Error importing leads:', e);
      this.showNotification('Error importing leads. Please check the file format.', 'error');
    }
  }

  filterLeads() {
    const searchTerm = document.getElementById('search-leads')?.value.toLowerCase() || '';
    const stageFilter = document.getElementById('filter-stage')?.value || '';
    const sourceFilter = document.getElementById('filter-source')?.value || '';
    const responsibleFilter = document.getElementById('filter-responsible')?.value || '';
    const dateFilter = document.getElementById('filter-date')?.value || '';

    this.filteredLeads = this.leads.filter(lead => {
      const matchesSearch = !searchTerm || 
        lead['Lead Name']?.toLowerCase().includes(searchTerm) ||
        lead['First Name']?.toLowerCase().includes(searchTerm) ||
        lead.ID?.toString().includes(searchTerm);

      const matchesStage = !stageFilter || lead.Stage === stageFilter;
      const matchesSource = !sourceFilter || lead.Source === sourceFilter;
      const matchesResponsible = !responsibleFilter || lead.Responsible === responsibleFilter;
      
      let matchesDate = true;
      if (dateFilter) {
        const leadDate = new Date(lead.Created.split('/').reverse().join('-'));
        const filterDate = new Date(dateFilter);
        matchesDate = leadDate.toDateString() === filterDate.toDateString();
      }

      return matchesSearch && matchesStage && matchesSource && matchesResponsible && matchesDate;
    });

    this.currentPage = 1;
    this.renderTable();
  }

  sortTable(column) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    const columnMap = {
      'sort-id': 'ID',
      'sort-name': 'Lead Name',
      'sort-stage': 'Stage',
      'sort-source': 'Source',
      'sort-responsible': 'Responsible',
      'sort-created': 'Created',
      'sort-followup': 'Follow Up'
    };

    const actualColumn = columnMap[column];
    if (!actualColumn) return;

    this.filteredLeads.sort((a, b) => {
      let aVal = a[actualColumn] || '';
      let bVal = b[actualColumn] || '';

      // Handle numeric sorting for ID
      if (actualColumn === 'ID') {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      }

      // Handle date sorting
      if (actualColumn === 'Created' || actualColumn === 'Follow Up') {
        aVal = new Date(aVal.split('/').reverse().join('-'));
        bVal = new Date(bVal.split('/').reverse().join('-'));
      }

      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    this.renderTable();
  }

  renderTable() {
    const tbody = document.querySelector('#leads-table tbody');
    if (!tbody) return;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageLeads = this.filteredLeads.slice(start, end);

    tbody.innerHTML = pageLeads.map(lead => `
      <tr>
        <td class="sort-id">${this.escapeHtml(lead.ID || '')}</td>
        <td class="sort-name">
          <div class="d-flex py-1 align-items-center">
            <span class="avatar avatar-sm me-2">${this.getInitials(lead['First Name'] || lead['Lead Name'])}</span>
            <div class="flex-fill">
              <div class="font-weight-medium">${this.escapeHtml(lead['Lead Name'] || '')}</div>
              <div class="text-muted">${this.escapeHtml(lead['First Name'] || '')}</div>
            </div>
          </div>
        </td>
        <td class="sort-stage">
          <span class="badge ${this.getStageClass(lead.Stage)}">${this.escapeHtml(lead.Stage || '')}</span>
        </td>
        <td class="sort-source">${this.escapeHtml(lead.Source || '')}</td>
        <td class="sort-responsible">${this.escapeHtml(lead.Responsible || '')}</td>
        <td class="sort-created">${this.escapeHtml(lead.Created || '')}</td>
        <td class="sort-followup">${this.escapeHtml(lead['Follow Up'] || '')}</td>
        <td>
          <div class="btn-list flex-nowrap">
            <button class="btn btn-white btn-sm" onclick="leadsManager.editLead('${lead.ID}')">Edit</button>
            <div class="dropdown">
              <button class="btn btn-white btn-sm dropdown-toggle align-text-top" data-bs-toggle="dropdown">Actions</button>
              <div class="dropdown-menu dropdown-menu-end">
                <a class="dropdown-item" href="#" onclick="leadsManager.viewDetails('${lead.ID}')">View Details</a>
                <a class="dropdown-item" href="#" onclick="leadsManager.sendEmail('${lead.ID}')">Send Email</a>
                <a class="dropdown-item" href="#" onclick="leadsManager.callLead('${lead.ID}')">Call</a>
                <div class="dropdown-divider"></div>
                <a class="dropdown-item text-danger" href="#" onclick="leadsManager.deleteLead('${lead.ID}')">Delete</a>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    this.updatePagination();
  }

  updatePagination() {
    const totalCount = this.filteredLeads.length;
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, totalCount);

    const showingCount = document.getElementById('showing-count');
    const totalCountEl = document.getElementById('total-count');

    if (showingCount) showingCount.textContent = `${start} to ${end}`;
    if (totalCountEl) totalCountEl.textContent = totalCount.toString();
  }

  updateStats() {
    const totalLeads = this.leads.length;
    const newLeads = this.leads.filter(lead => lead.Stage === 'NEW').length;
    const attemptLeads = this.leads.filter(lead => lead.Stage === 'ATTEMPT').length;
    const customerLeads = this.leads.filter(lead => lead.Stage === 'CUSTOMER').length;

    // Update stat cards
    const statElements = document.querySelectorAll('.h1.mb-3');
    if (statElements.length >= 4) {
      statElements[0].textContent = totalLeads;
      statElements[1].textContent = newLeads;
      statElements[2].textContent = attemptLeads;
      statElements[3].textContent = customerLeads;
    }
  }

  getStageClass(stage) {
    const stageClasses = {
      'NEW': 'bg-primary',
      'ATTEMPT': 'bg-warning',
      'CONTACTED': 'bg-info',
      'OPTIONS SENT': 'bg-purple',
      'CUSTOMER': 'bg-success',
      'UNSUCCESSFUL': 'bg-danger',
      'Junk Lead': 'bg-secondary',
      'IDLE': 'bg-orange'
    };
    return stageClasses[stage] || 'bg-secondary';
  }

  getInitials(name) {
    if (!name) return 'L';
    return name.charAt(0).toUpperCase();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  exportToCSV() {
    if (this.filteredLeads.length === 0) {
      this.showNotification('No data to export', 'warning');
      return;
    }

    const headers = Object.keys(this.filteredLeads[0]);
    const csvContent = [
      headers.join(','),
      ...this.filteredLeads.map(lead => 
        headers.map(header => `"${(lead[header] || '').toString().replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    this.showNotification('Leads exported successfully!', 'success');
  }

  showNotification(message, type = 'info') {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
      ${message}
      <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // Action methods
  editLead(id) {
    console.log('Edit lead:', id);
    // Implement edit functionality
  }

  viewDetails(id) {
    console.log('View details:', id);
    // Implement view details functionality
  }

  sendEmail(id) {
    console.log('Send email to lead:', id);
    // Implement email functionality
  }

  callLead(id) {
    console.log('Call lead:', id);
    // Implement call functionality
  }

  deleteLead(id) {
    if (confirm('Are you sure you want to delete this lead?')) {
      this.leads = this.leads.filter(lead => lead.ID !== id);
      this.saveLeads();
      this.filterLeads();
      this.updateStats();
      this.showNotification('Lead deleted successfully!', 'success');
    }
  }
}

// Initialize the leads manager when DOM is loaded
let leadsManager;
document.addEventListener('DOMContentLoaded', () => {
  leadsManager = new LeadsManager();
});
