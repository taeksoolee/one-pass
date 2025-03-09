const refreshToken = (() => {
  return {
    get() {
      return localStorage.getItem('refreshToken');
    },
    set(token) {
      localStorage.setItem('refreshToken', token);
    },
    remove() {
      localStorage.removeItem('refreshToken');
    }
  }
})();

const state = new Proxy({
  accessToken: undefined,
}, {
  set: (target, key, value) => {
    target[key] = value;

    if (key === 'accessToken') {
      if (!!target[key]) {
        document.forms.loginForm.style.display = 'none';
        document.querySelector('#app').style.display = 'block';
      } else {
        document.forms.loginForm.style.display = 'block';
        document.querySelector('#app').style.display = 'none';
      }
    }

    return true;
  },
  get: (target, key) => {
    return target[key];
  },
});

const inited = (async () => {
  
  try {
    if (!refreshToken.get()) {
      throw new Error('Unauthorized');
    }
    const data = await fetch('http://localhost:3000/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: refreshToken.get() }),
    }).then(response => {
      if (!response.ok) {
        throw new Error('Unauthorized');
      }
      return response.json();
    });

    state.accessToken = data.accessToken;
  } catch (err) {
    refreshToken.remove();
    state.accessToken = null;
  }

  return true;
})();

async function login (username, password) {
  fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })
    .then(response => response.json())
    .then(data => {
      state.accessToken = data.accessToken;
      refreshToken.set(data.refreshToken);
    });
};

async function logout () {
  await fetch('http://localhost:3000/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  refreshToken.remove();
  state.accessToken = null;
}

const handleSubmitLoginForm = async function (e) {
  e.preventDefault();

  const username = this.username.value;
  const password = this.password.value;

  await login(username, password);

  this.username.value = ''
  this.password.value = ''
}

const handleClickLogoutBtn = function (e) {
  logout();
}

