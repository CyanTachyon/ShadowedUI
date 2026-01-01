<template>
    <div class="mine-settings-panel">
        <div class="mine-header">
            <div class="mine-avatar-wrapper">
                <img :src="userStore.getAvatarUrl()" class="mine-avatar" alt="Avatar" />
                <label for="avatar-upload" class="avatar-upload-label" title="Upload Avatar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                </label>
                <input id="avatar-upload" ref="avatarInput" type="file" accept="image/*" style="display: none" @change="uploadAvatar" />
            </div>
            <div class="mine-user-info">
                <div class="mine-username">{{ userStore.currentUser?.username || 'User' }}</div>
                <div class="mine-user-id">ID: {{ userStore.userId }}</div>
            </div>
        </div>

        <div class="mine-signature-section">
            <div class="signature-label">Signature</div>
            <input v-model="signature" type="text" class="signature-input" placeholder="Enter your signature (max 100 chars)" maxlength="100" @blur="saveSignature" @keyup.enter="saveSignature" />
            <div class="char-count">{{ signature.length }}/100</div>
        </div>

        <div class="mine-settings-list">
            <div class="settings-section-title">Appearance</div>

            <div class="setting-item" @click="triggerBackgroundUpload">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>Set Background</span>
            </div>

            <div v-if="uiStore.chatBackground" class="setting-item danger" @click="clearBackground">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Clear Background</span>
            </div>

            <div class="setting-item" @click="uiStore.toggleTheme()">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <span>Switch Theme</span>
                <span class="theme-badge">{{ uiStore.theme }}</span>
            </div>

            <div class="settings-section-title">Security</div>

            <div class="setting-item" @click="openResetPassword">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Reset Password</span>
            </div>

            <div class="settings-section-title">Account</div>

            <div class="setting-item logout" @click="userStore.logout()">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Logout</span>
            </div>
        </div>

        <input ref="backgroundInput" type="file" accept="image/*" style="display: none" @change="uploadBackground" />
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useUserStore, useChatStore, useUIStore } from '@/stores';
import { uploadAvatar as uploadAvatarApi } from '@/services/api';
import { wsService } from '@/services/websocket';

const userStore = useUserStore();
const chatStore = useChatStore();
const uiStore = useUIStore();

const backgroundInput = ref<HTMLInputElement | null>(null);
const signature = ref(userStore.currentUser?.signature || '');

watch(() => userStore.currentUser?.signature, (newSignature) =>
{
    if (newSignature !== undefined)
    {
        signature.value = newSignature;
    }
});

function saveSignature()
{
    if (signature.value === (userStore.currentUser?.signature || '')) return;
    wsService.sendPacket('update_signature', { signature: signature.value });
    if (userStore.currentUser)
    {
        userStore.currentUser.signature = signature.value;
    }
    chatStore.showToast('Signature updated', 'success');
}

async function uploadAvatar(event: Event)
{
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !userStore.currentUser || !userStore.authToken) return;

    try
    {
        await uploadAvatarApi(file, userStore.currentUser.username, userStore.authToken);
        chatStore.showToast('Avatar updated', 'success');
    }
    catch (e: any)
    {
        chatStore.showToast(e.message || 'Error uploading avatar', 'error');
    }
    input.value = '';
}

function triggerBackgroundUpload()
{
    backgroundInput.value?.click();
}

function uploadBackground(event: Event)
{
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) =>
    {
        const imageData = e.target?.result as string;
        uiStore.setChatBackground(imageData);
        chatStore.showToast('Background updated', 'success');
    };
    reader.onerror = () =>
    {
        chatStore.showToast('Error reading image', 'error');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function clearBackground()
{
    uiStore.setChatBackground(null);
    chatStore.showToast('Background cleared', 'success');
}

function openResetPassword()
{
    uiStore.showResetPasswordModal = true;
}
</script>

<style scoped>
.mine-settings-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    overflow-y: auto;
    padding: 20px;
    animation: fadeIn 0.2s ease;
    box-sizing: border-box;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.mine-header {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 20px 0;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 20px;
    box-sizing: border-box;
}

.mine-avatar-wrapper {
    position: relative;
    margin-right: 15px;
}

.mine-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    background-color: var(--border-color);
}

.avatar-upload-label {
    position: absolute;
    bottom: -5px;
    right: -5px;
    background-color: var(--primary-color);
    color: white;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s;
}

.avatar-upload-label:hover {
    background-color: var(--primary-hover);
}

.mine-user-info {
    flex: 1;
}

.mine-username {
    font-size: 1.3em;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 5px;
}

.mine-user-id {
    font-size: 0.9em;
    color: var(--secondary-color);
}

.mine-signature-section {
    width: 100%;
    margin-bottom: 20px;
    box-sizing: border-box;
}

.signature-label {
    font-size: 0.85em;
    color: var(--secondary-color);
    text-transform: uppercase;
    margin-bottom: 10px;
}

.signature-input {
    width: 100%;
    padding: 12px;
    background-color: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-color);
    font-size: 0.95em;
    box-sizing: border-box;
    transition: border-color 0.2s;
}

.signature-input:focus {
    outline: none;
    border-color: var(--primary-color);
}

.char-count {
    text-align: right;
    font-size: 0.8em;
    color: var(--secondary-color);
    margin-top: 5px;
}

.mine-settings-list {
    flex: 1;
    width: 100%;
    box-sizing: border-box;
}

.settings-section-title {
    font-size: 0.8em;
    color: var(--secondary-color);
    text-transform: uppercase;
    margin: 20px 0 10px 0;
    font-weight: 600;
}

.settings-section-title:first-of-type {
    margin-top: 0;
}

.setting-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 12px 15px;
    background-color: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 8px;
    box-sizing: border-box;
}

.setting-item:hover {
    background-color: var(--hover-bg);
    border-color: var(--primary-color);
}

.setting-item svg {
    margin-right: 12px;
    color: var(--text-color);
}

.setting-item span {
    color: var(--text-color);
    flex: 1;
}

.theme-badge {
    background-color: var(--primary-color);
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.75em;
    text-transform: uppercase;
}

.setting-item.danger {
    border-color: rgba(248, 81, 73, 0.3);
}

.setting-item.danger:hover {
    background-color: rgba(248, 81, 73, 0.1);
    border-color: #f85149;
}

.setting-item.danger svg,
.setting-item.danger span {
    color: #f85149;
}

.setting-item.logout {
    border-color: rgba(248, 81, 73, 0.3);
}

.setting-item.logout:hover {
    background-color: rgba(248, 81, 73, 0.1);
    border-color: #f85149;
}

.setting-item.logout svg,
.setting-item.logout span {
    color: #f85149;
}
</style>
