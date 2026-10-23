document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth() || !requireAdmin()) return;

  const tableBody = document.querySelector('#admin-events-table tbody');
  const modalOverlay = document.getElementById('event-modal-overlay');
  const eventForm = document.getElementById('event-form');
  let eventsList = [];

  async function loadEvents() {
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
    try {
      const res = await api('/api/events');
      eventsList = res.events || [];
      renderTable();
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">${err.message}</td></tr>`;
    }
  }

  function renderTable() {
    if (eventsList.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">No events found.</td></tr>';
      return;
    }
    
    tableBody.innerHTML = eventsList.map(e => `
      <tr>
        <td><strong>${e.event_name}</strong></td>
        <td>${formatDate(e.event_date)}</td>
        <td><span class="badge ${getCategoryClass(e.category)}">${e.category}</span></td>
        <td>${e.registration_count} / ${e.max_capacity}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editEvent(${e.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEvent(${e.id})">Delete</button>
          <a href="event.html?id=${e.id}" class="btn btn-secondary btn-sm" style="border:none">View</a>
        </td>
      </tr>
    `).join('');
  }

  // Modals
  window.openEventModal = () => {
    eventForm.reset();
    document.getElementById('event-id').value = '';
    document.getElementById('modal-title').innerText = 'Add Event';
    modalOverlay.classList.add('active');
  };

  window.closeEventModal = () => {
    modalOverlay.classList.remove('active');
  };

  window.editEvent = (id) => {
    const ev = eventsList.find(e => e.id === id);
    if (!ev) return;
    
    document.getElementById('event-id').value = ev.id;
    document.getElementById('event_name').value = ev.event_name;
    document.getElementById('event_date').value = ev.event_date.split('T')[0];
    document.getElementById('event_time').value = ev.event_time;
    document.getElementById('venue').value = ev.venue;
    document.getElementById('category').value = ev.category;
    document.getElementById('max_capacity').value = ev.max_capacity;
    document.getElementById('description').value = ev.description;
    
    document.getElementById('modal-title').innerText = 'Edit Event';
    modalOverlay.classList.add('active');
  };

  window.deleteEvent = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      const res = await api(`/api/events/${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Event deleted successfully');
        loadEvents();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const isEdit = !!id;
    
    const payload = {
      event_name: document.getElementById('event_name').value,
      event_date: document.getElementById('event_date').value,
      event_time: document.getElementById('event_time').value,
      venue: document.getElementById('venue').value,
      category: document.getElementById('category').value,
      max_capacity: parseInt(document.getElementById('max_capacity').value),
      description: document.getElementById('description').value
    };

    const method = isEdit ? 'PUT' : 'POST';
    const endpoint = isEdit ? `/api/events/${id}` : '/api/events';

    try {
      const btn = eventForm.querySelector('button[type="submit"]');
      const ogText = btn.innerText;
      btn.disabled = true;
      btn.innerText = 'Saving...';
      
      const res = await api(endpoint, { method, body: payload });
      if (res.success) {
        showToast(isEdit ? 'Event updated' : 'Event created');
        closeEventModal();
        loadEvents();
      }
      
      btn.disabled = false;
      btn.innerText = ogText;
    } catch (err) {
      showToast(err.message, 'error');
      eventForm.querySelector('button[type="submit"]').disabled = false;
      eventForm.querySelector('button[type="submit"]').innerText = 'Save Event';
    }
  });

  loadEvents();
});
