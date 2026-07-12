const token = localStorage.getItem('token');

function redirectToLogin() {
  if (!token) {
    window.location.href = '/login.html';
  }
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function setUserState(user) {
  const profileLink = document.getElementById('profile-link');
  if (profileLink) {
    profileLink.textContent = user ? user.full_name || user.email : 'Profile';
  }
}

async function loadNavUser() {
  if (!token) return;
  try {
    const { user } = await api('/api/auth/me');
    setUserState(user);
  } catch (error) {
    console.error(error);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    fullName: form.fullName.value,
    email: form.email.value,
    password: form.password.value
  };
  try {
    const { token: authToken, user } = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(user));
    window.location.href = '/dashboard.html';
  } catch (error) {
    alert(error.message);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  try {
    const { token: authToken, user } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.email.value, password: form.password.value })
    });
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(user));
    window.location.href = '/dashboard.html';
  } catch (error) {
    alert(error.message);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

function bindAuthForms() {
  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) logoutButton.addEventListener('click', logout);
}

document.addEventListener('DOMContentLoaded', () => {
  bindAuthForms();
  loadNavUser();
});
