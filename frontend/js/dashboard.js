document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  const user = getUser();
  document.getElementById('welcome-message').innerText = `Welcome, ${user.fullname}!`;

  // Update sidebar if admin
  if (isAdmin()) {
    const sidebar = document.getElementById('sidebar-menu');
    const adminLink = document.createElement('li');
    adminLink.innerHTML = `<a href="admin.html" class="nav-item"><span class="icon">⚙️</span> Admin Panel</a>`;
    sidebar.appendChild(adminLink);
  }

  let allEvents = [];
  let myRegistrations = [];
  let showOnlyMyEvents = false;
  let currentSearch = '';
  let currentCategory = '';

  // DOM Elements
  const eventsContainer = document.getElementById('dashboard-events');
  const searchInput = document.getElementById('search-input');
  const categoryTabs = document.querySelectorAll('.filter-tab');
  const navMyEvents = document.getElementById('nav-my-events');
  const heading = document.getElementById('events-heading');

  async function loadData() {
    showLoading(eventsContainer);
    try {
      const [eventsRes, profileRes] = await Promise.all([
        api('/api/events'),
        api('/api/users/profile')
      ]);

      allEvents = eventsRes.events || [];
      const profileUser = profileRes.user || {};
      // For simplicity, let's just fetch all events and filter locally based on user.events if available.
      // Alternatively, call /api/users/my-events
      const myEventsRes = await api('/api/users/my-events');
      myRegistrations = myEventsRes.events || [];

      updateStats();
      renderEvents();
    } catch (err) {
      eventsContainer.innerHTML = `<p class="text-danger w-100">${err.message}</p>`;
    }
  }

  function updateStats() {
    document.getElementById('stat-total').innerText = allEvents.length;
    document.getElementById('stat-my-regs').innerText = myRegistrations.length;
    const upcoming = allEvents.filter(e => new Date(e.event_date) > new Date()).length;
    document.getElementById('stat-upcoming').innerText = upcoming;
  }

  function renderEvents() {
    let filtered = allEvents;

    if (showOnlyMyEvents) {
      const myIds = myRegistrations.map(e => e.id);
      filtered = filtered.filter(e => myIds.includes(e.id));
    }

    if (currentSearch) {
      const s = currentSearch.toLowerCase();
      filtered = filtered.filter(e => 
        e.event_name.toLowerCase().includes(s) || 
        e.venue.toLowerCase().includes(s)
      );
    }

    if (currentCategory) {
      filtered = filtered.filter(e => e.category === currentCategory);
    }

    eventsContainer.innerHTML = '';

    if (filtered.length === 0) {
      eventsContainer.innerHTML = '<p class="text-secondary w-100">No events found matching your criteria.</p>';
      return;
    }

    const myIds = myRegistrations.map(e => e.id);

    filtered.forEach(event => {
      const isRegistered = myIds.includes(event.id);
      const card = document.createElement('div');
      card.className = 'glass-card event-card';
      
      let actionBtn = '';
      if (isRegistered) {
        actionBtn = `<button class="btn btn-secondary btn-sm" onclick="unregisterEvent(${event.id})">Unregister</button>`;
      } else {
        const isFull = event.registration_count >= event.max_capacity;
        actionBtn = isFull ? 
          `<button class="btn btn-secondary btn-sm" disabled>Full</button>` :
          `<button class="btn btn-primary btn-sm" onclick="registerEvent(${event.id})">Register</button>`;
      }

      card.innerHTML = `
        <div class="event-card-img">${getCategoryIcon(event.category)}</div>
        <div class="event-card-content">
          <span class="badge ${getCategoryClass(event.category)} mb-1" style="align-self: flex-start;">${event.category}</span>
          <h3 class="event-card-title">${event.event_name}</h3>
          <div class="event-card-info">
            <span>📅 ${formatDate(event.event_date)} | ${event.event_time}</span>
            <span>📍 ${event.venue}</span>
            <span>👥 ${event.registration_count}/${event.max_capacity} Registered</span>
          </div>
          <p class="event-card-desc">${event.description.substring(0, 70)}...</p>
          <div class="event-card-footer">
            <a href="event.html?id=${event.id}" class="btn btn-secondary btn-sm" style="border:none; padding-left:0;">Details</a>
            ${actionBtn}
          </div>
        </div>
      `;
      eventsContainer.appendChild(card);
    });
  }

  // Global functions for inline handlers
  window.registerEvent = async (id) => {
    try {
      const res = await api(`/api/events/${id}/register`, { method: 'POST' });
      if (res.success) {
        showToast('Registered successfully');
        loadData(); // reload
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.unregisterEvent = async (id) => {
    try {
      const res = await api(`/api/events/${id}/register`, { method: 'DELETE' });
      if (res.success) {
        showToast('Unregistered successfully');
        loadData(); // reload
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Event Listeners
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value;
      renderEvents();
    }, 300);
  });

  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      renderEvents();
    });
  });

  navMyEvents.addEventListener('click', (e) => {
    e.preventDefault();
    showOnlyMyEvents = true;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    navMyEvents.classList.add('active');
    heading.innerText = 'My Registered Events';
    renderEvents();
  });

  document.querySelector('a[href="dashboard.html"]').addEventListener('click', (e) => {
    if(e.currentTarget.classList.contains('active')) return;
    e.preventDefault();
    showOnlyMyEvents = false;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    e.currentTarget.classList.add('active');
    heading.innerText = 'All Events';
    renderEvents();
  });

  // Initial load
  loadData();
});
