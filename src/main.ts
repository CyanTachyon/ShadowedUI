import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useUserStore } from './stores';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');

if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied')
{
    Notification.requestPermission();
}

useUserStore().tryAutoLogin();