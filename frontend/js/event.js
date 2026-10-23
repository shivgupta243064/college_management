document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');

  if (!eventId) {
    document.getElementById('event-content').innerHTML = '<p class="text-center">Event not found.</p>';
    return;
  }

  const container = document.getElementById('event-content');
  showLoading(container);

  let eventData = null;
  let isRegistered = false;

  async function loadEvent() {
    try {
      const res = await api(`/api/events/${eventId}`);
      eventData = res.event;

      if (isLoggedIn()) {
        const regRes = await api(`/api/events/${eventId}/check-registration`);
        isRegistered = regRes.registered;
      }

      renderEvent();

      if (isAdmin()) {
        loadRegistrations();
      }
    } catch (err) {
      container.innerHTML = `<div class="glass-card text-center text-danger">${err.message}</div>`;
    }
  }

  function renderEvent() {
    let actionBtn = '';
    if (!isLoggedIn()) {
      actionBtn = `<a href="login.html" class="btn btn-primary">Login to Register</a>`;
    } else if (isRegistered) {
      actionBtn = `<button class="btn btn-danger" onclick="toggleRegistration()">Unregister</button>`;
    } else {
      const isFull = eventData.registration_count >= eventData.max_capacity;
      actionBtn = isFull ? 
        `<button class="btn btn-secondary" disabled>Event Full</button>` :
        `<button class="btn btn-primary" onclick="toggleRegistration()">Register for Event</button>`;
    }

    container.innerHTML = `
      <div class="event-header">
        <span class="badge ${getCategoryClass(eventData.category)} mb-2">${eventData.category}</span>
        <h1>${eventData.event_name}</h1>
        <div class="d-flex gap-3 justify-center text-secondary mt-2">
          <span>📅 ${formatDate(eventData.event_date)} at ${eventData.event_time}</span>
          <span>📍 ${eventData.venue}</span>
          <span>👥 ${eventData.registration_count} / ${eventData.max_capacity} Registered</span>
        </div>
      </div>
      
      <div class="glass-card mt-3">
        <h3>About this event</h3>
        <p class="mt-2 text-secondary" style="white-space: pre-wrap;">${eventData.description}</p>
        
        <div class="mt-4 pt-3" style="border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
          <div>
            ${isRegistered ? '<span class="text-success">✅ You are registered</span>' : ''}
          </div>
          <div>
            ${actionBtn}
          </div>
        </div>
      </div>
    `;
  }

  window.toggleRegistration = async () => {
    try {
      const method = isRegistered ? 'DELETE' : 'POST';
      const res = await api(`/api/events/${eventId}/register`, { method });
      if (res.success) {
        showToast(isRegistered ? 'Unregistered successfully' : 'Registered successfully');
        loadEvent(); // reload
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  async function loadRegistrations() {
    try {
      const section = document.getElementById('admin-registrations-section');
      section.style.display = 'block';
      const tbody = document.querySelector('#registrations-table tbody');
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';
      
      const res = await api(`/api/events/${eventId}/registrations`);
      document.getElementById('reg-count').innerText = res.registrations.length;
      
      if (res.registrations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary">No registrations yet.</td></tr>';
        return;
      }
      
      tbody.innerHTML = res.registrations.map(r => `
        <tr>
          <td>${r.fullname}</td>
          <td>${r.username}</td>
          <td>${r.email}</td>
          <td>${formatDate(r.registered_at)}</td>
        </tr>
      `).join('');
    } catch (err) {
      document.querySelector('#registrations-table tbody').innerHTML = `<tr><td colspan="4" class="text-danger">${err.message}</td></tr>`;
    }
  }

  loadEvent();
});
