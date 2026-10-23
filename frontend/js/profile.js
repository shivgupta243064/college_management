document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  const profileForm = document.getElementById('profile-form');
  const avatar = document.getElementById('profile-avatar');
  const usernameDisplay = document.getElementById('profile-username');
  const roleDisplay = document.getElementById('profile-role');

  const nameInput = document.getElementById('prof-fullname');
  const emailInput = document.getElementById('prof-email');
  const passInput = document.getElementById('prof-password');

  async function loadProfile() {
    try {
      const res = await api('/api/users/profile');
      const user = res.user;
      
      avatar.innerText = user.fullname ? user.fullname.charAt(0).toUpperCase() : 'U';
      usernameDisplay.innerText = '@' + user.username;
      roleDisplay.innerText = user.role.toUpperCase();

      nameInput.value = user.fullname;
      emailInput.value = user.email;

      // Update local storage just in case
      setAuth(getToken(), user);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const payload = {
      fullname: nameInput.value,
      email: emailInput.value
    };
    if (passInput.value) {
      payload.password = passInput.value;
    }

    try {
      const btn = profileForm.querySelector('button');
      btn.disabled = true;
      btn.innerText = 'Updating...';

      const res = await api('/api/users/profile', {
        method: 'PUT',
        body: payload
      });

      if (res.success) {
        showToast('Profile updated successfully');
        setAuth(getToken(), res.user);
        passInput.value = '';
        loadProfile(); // refresh UI
        renderNavbar(); // update navbar avatar if needed
      }

      btn.disabled = false;
      btn.innerText = 'Update Profile';
    } catch (err) {
      showToast(err.message, 'error');
      profileForm.querySelector('button').disabled = false;
      profileForm.querySelector('button').innerText = 'Update Profile';
    }
  });

  loadProfile();
});
