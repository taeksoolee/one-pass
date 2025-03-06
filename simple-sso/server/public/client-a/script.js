

const { createApp, ref, reactive, onMounted, watch } = Vue;

const app = createApp({
  setup() {
    const inited = ref(false);
    const accessToken = ref('');
    const isPermissionDenied = ref(false);

    const reqeustIntervalRefresh = (accessToken) => {
      const decoded = new jwt_decode(accessToken);
      const nextSec = decoded.exp - Date.now() / 1000 - 60; // 1분 전에 갱신
      decoded.exp && setTimeout(refresh, nextSec * 1000);
    }

    const refresh = async () => {
      console.log('refresh');
      try {
        const data = await fetch('https://localhost:3000/auth/refresh', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }).then(response => {
          if (!response.ok) {
            if (response.status === 403) {
              isPermissionDenied.value = true;
            }
            throw new Error('failed');
          }
          return response.json();
        });
        accessToken.value = data.accessToken;
      } catch (e) {
        accessToken.value = '';
        // location.href = 'https://localhost:3000/logout';
      }
    }

    watch(accessToken, (accessToken) => {
      accessToken && reqeustIntervalRefresh(accessToken);
    });

    const logout = async () => {
      await fetch('https://localhost:3000/auth/logout', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // accessToken.value = '';
      location.href = 'https://localhost:3000/logout';
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
      fetch('https://localhost:3000/resources', {
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
      isPermissionDenied,
      accessToken,
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
      <template v-if="isPermissionDenied">
        <h1>Permission Denied</h1>
        <button @click="logout">Logout</button>
      </template>
      <template v-else>
        <h1>Not Signed</h1>
        <a href="https://localhost:3000">login</a>
      </template>
    </template>
  </template>
  `,
});

app.mount('#app');

