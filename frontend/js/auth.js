document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const btn = loginForm.querySelector('button');
      
      try {
        btn.disabled = true;
        btn.textContent = 'Logging in...';
        
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: { username, password }
        });
        
        if (data.success) {
          setAuth(data.token, data.user);
          showToast('Login successful!');
          setTimeout(() => {
            window.location.href = '/dashboard.html';
          }, 1000);
        }
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Login';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullname = document.getElementById('fullname').value;
      const email = document.getElementById('email').value;
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const btn = registerForm.querySelector('button');
      
      try {
        btn.disabled = true;
        btn.textContent = 'Registering...';
        
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: { fullname, email, username, password }
        });
        
        if (data.success) {
          setAuth(data.token, data.user);
          showToast('Registration successful!');
          setTimeout(() => {
            window.location.href = '/dashboard.html';
          }, 1000);
        }
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Register';
      }
    });
  }
});
