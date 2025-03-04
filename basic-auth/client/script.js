

const { createApp, ref, reactive, onMounted, watch } = Vue;

const app = createApp({
  setup() {
    const inited = ref(false);
    const accessToken = ref('');
    const loginFormState = reactive({
      username: '',
      password: '',
    });

    const reqeustIntervalRefresh = (accessToken) => {
      const decoded = new jwt_decode(accessToken);
      const nextSec = decoded.exp - Date.now() / 1000 - 60;
      console.log(decoded.exp, nextSec);
      decoded.exp && setTimeout(refresh, nextSec * 1000);
    }

    const refresh = async () => {
      console.log('refresh');
      try {
        const data = await fetch('http://localhost:3000/auth/refresh', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }).then(response => response.json());
        accessToken.value = data.accessToken;
      } catch (e) {
        accessToken.value = '';
      }
    }

    watch(accessToken, (accessToken) => {
      accessToken && reqeustIntervalRefresh(accessToken);
    });

    const login = async () => {
      const data = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: loginFormState.username,
          password: loginFormState.password
        }),
      }).then(response => response.json());
      
      accessToken.value = data.accessToken;
    }

    const logout = async () => {
      await fetch('http://localhost:3000/auth/logout', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      accessToken.value = '';
    }

    const init = async () => {
      try {
        await refresh();
      } finally {
        inited.value = true;
      }
    }

    onMounted(init);

    const getResources = () => {
      fetch('http://localhost:3000/resources', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken.value}`,
        },
        // credentials: 'include',
      }).then(response => response.text()).then(console.log);
    }

    return {
      inited,
      accessToken,
      loginFormState,
      login,
      logout,
      getResources,
    }
  },
  template: `
  <template v-if="inited">
    <template v-if="accessToken">
      <h1>Signed</h1>
      <button @click="logout">Logout</button>

      <button @click="getResources">get resources</button>
    </template>
    <template v-else>
      <form @submit.prevent="login">
        <input type="text" v-model="loginFormState.username" />
        <input type="password" autocomplete="current-password" v-model="loginFormState.password" />
        <button>Login</button>
      </form>
    </template>
  </template>
  `,
});

app.mount('#app');

