import { createApp } from 'vue'
import { createPinia } from 'pinia'

// 1. Импортируем Vuetify
import 'vuetify/styles'; // Обязательные стили
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

import App from './App.vue';

import './assets/main.css'

// 2. Создаем экземпляр Vuetify
const vuetify = createVuetify({
  components,
  directives,
});

const app = createApp(App);

app.use(createPinia());
app.use(vuetify); // 3. Подключаем Vuetify к приложению

app.mount('#app');
