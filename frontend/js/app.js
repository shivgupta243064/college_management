// API Base
const API_BASE = '';

// Auth utilities
function getToken() { return localStorage.getItem('token'); }
function getUser() { 
  const u = localStorage.getItem('user'); 
  try { return u ? JSON.parse(u) : null; } catch(e) { return null; }
}
function setAuth(token, user) { 
  localStorage.setItem('token', token); 
  localStorage.setItem('user', JSON.stringify(user)); 
}
function clearAuth() { 
  localStorage.removeItem('token'); 
  localStorage.removeItem('user'); 
}
function isLoggedIn() { return !!getToken(); }
function isAdmin() { 
  const u = getUser(); 
  return u && u.role === 'admin'; 
}
function requireAuth() { 
  if (!isLoggedIn()) { 
    window.location.href = '/login.html'; 
    return false; 
  } 
  return true; 
}
function requireAdmin() { 
  if (!isAdmin()) { 
    window.location.href = '/dashboard.html'; 
    return false; 
  } 
  return true; 
}

// API helper
async function api(endpoint, options = {}) {
  const config = { headers: { 'Content-Type': 'application/json' }, ...options };
  const token = getToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  if (config.body && typeof config.body === 'object') config.body = JSON.stringify(config.body);
  
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  } catch (error) {
    throw error;
  }
}

// Toast notifications
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Render navbar based on auth state
function renderNavbar() {
  const navbarContainer = document.getElementById('navbar');
  if (!navbarContainer) return;

  const user = getUser();
  
  let links = `
    <li><a href="/index.html">Home</a></li>
    <li><a href="/dashboard.html">Dashboard</a></li>
  `;

  if (isAdmin()) {
    links += `<li><a href="/admin.html">Admin Panel</a></li>`;
  }

  let authSection = '';
  if (isLoggedIn()) {
    const initials = user.fullname ? user.fullname.charAt(0).toUpperCase() : 'U';
    authSection = `
      <div class="auth-buttons">
        <a href="/profile.html" class="d-flex align-center gap-1">
          <div class="avatar" style="width:32px;height:32px;font-size:0.9rem;">${initials}</div>
          <span class="text-secondary" style="font-size:0.9rem;">${user.username}</span>
        </a>
        <button id="logout-btn" class="btn btn-secondary btn-sm">Logout</button>
      </div>
    `;
  } else {
    authSection = `
      <div class="auth-buttons">
        <a href="/login.html" class="btn btn-secondary btn-sm">Login</a>
        <a href="/register.html" class="btn btn-primary btn-sm">Register</a>
      </div>
    `;
  }

  navbarContainer.innerHTML = `
    <nav class="navbar">
      <div class="container">
        <a href="/" class="logo">CampusEvents</a>
        <ul class="nav-links">
          ${links}
        </ul>
        ${authSection}
      </div>
    </nav>
  `;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuth();
      window.location.href = '/login.html';
    });
  }
}

// Format date helper
function formatDate(dateStr) {
  if (!dateStr) return '';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}

// Get category color/class
function getCategoryClass(category) {
  const cat = category.toLowerCase();
  if (cat.includes('tech')) return 'badge-technical';
  if (cat.includes('cultur')) return 'badge-cultural';
  if (cat.includes('sport')) return 'badge-sports';
  if (cat.includes('work')) return 'badge-workshop';
  if (cat.includes('seminar')) return 'badge-seminar';
  return 'badge-default';
}

function getCategoryIcon(category) {
  const cat = category.toLowerCase();
  if (cat.includes('tech')) return '💻';
  if (cat.includes('cultur')) return '🎭';
  if (cat.includes('sport')) return '🏆';
  if (cat.includes('work')) return '📝';
  if (cat.includes('seminar')) return '🎤';
  return '📌';
}

// Loading state
function showLoading(container, minHeight = '200px') {
  if (typeof container === 'string') container = document.querySelector(container);
  if (!container) return;
  container.innerHTML = `<div style="min-height: ${minHeight}; display: flex; align-items: center; justify-content: center;"><div class="loading-spinner"></div></div>`;
}

function hideLoading(container) {
  // Assuming the next code will overwrite innerHTML, or just empty it
  if (typeof container === 'string') container = document.querySelector(container);
  if (container) container.innerHTML = '';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  document.body.classList.add('page-enter');
});
