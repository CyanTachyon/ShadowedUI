<template>
    <div id="auth-overlay">
        <!-- Login Box -->
        <div v-if="!showRegister" class="auth-box">
            <h2>Login</h2>
            <input v-model="loginUsername" type="text" placeholder="Username" @keyup.enter="handleLogin" />
            <input v-model="loginPassword" type="password" placeholder="Password" @keyup.enter="handleLogin" />
            <button class="button" @click="handleLogin">Login</button>
            <a class="link" @click="showRegister = true">Register a new account</a>
            <div class="theme-toggle-container">
                <button class="theme-toggle" @click="uiStore.toggleTheme()">Theme</button>
            </div>
        </div>

        <!-- Register Box -->
        <div v-else class="auth-box">
            <h2>Register</h2>
            <input v-model="regUsername" type="text" placeholder="Username" />
            <input v-model="regPassword" type="password" placeholder="Password" />
            <input v-model="regPasswordConfirm" type="password" placeholder="Confirm Password" @keyup.enter="handleRegister" />
            <button class="button" @click="handleRegister">Register</button>
            <a class="link" @click="showRegister = false">Back to Login</a>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUserStore, useUIStore } from '@/stores';

const userStore = useUserStore();
const uiStore = useUIStore();

const showRegister = ref(false);
const loginUsername = ref('');
const loginPassword = ref('');
const regUsername = ref('');
const regPassword = ref('');
const regPasswordConfirm = ref('');

async function handleLogin()
{
    await userStore.login(loginUsername.value, loginPassword.value);
}

async function handleRegister()
{
    const success = await userStore.register(
        regUsername.value,
        regPassword.value,
        regPasswordConfirm.value
    );
    if (!success)
    {
        regPassword.value = '';
        regPasswordConfirm.value = '';
    }
}
</script>

<style scoped>
#auth-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--bg-color);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 100;
}

.auth-box {
    background-color: var(--panel-bg);
    padding: 2rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow);
    width: 300px;
    text-align: center;
}

.auth-box h2 {
    margin-top: 0;
    color: var(--primary-color);
}

.auth-box input {
    width: 100%;
    padding: 0.5rem;
    margin: 0.5rem 0;
    background-color: var(--input-bg);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    border-radius: 4px;
    box-sizing: border-box;
}

.button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    width: 100%;
    margin-top: 0.5rem;
    transition: background-color 0.2s;
}

.button:hover {
    filter: brightness(1.1);
}

.link {
    color: var(--primary-color);
    cursor: pointer;
    margin-top: 1rem;
    display: block;
    font-size: 0.9em;
}

.theme-toggle-container {
    margin-top: 10px;
    display: flex;
    justify-content: center;
}

.theme-toggle {
    background: none;
    border: 1px solid var(--border-color);
    color: var(--text-color);
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
}
</style>
