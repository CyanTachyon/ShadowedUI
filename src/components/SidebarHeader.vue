<template>
    <div class="sidebar-header">
        <div class="header-left">
            <!-- User Avatar & Menu -->
            <div class="avatar-container" @click.stop="toggleUserMenu" title="User Menu">
                <img :src="userStore.getAvatarUrl()" class="user-avatar" alt="Avatar" loading="lazy" />
                <span class="user-name">{{ userStore.currentUser?.username || 'User' }}</span>
            </div>
            <div v-if="uiStore.showUserMenu" class="dropdown-menu show">
                <div class="menu-item" @click="triggerAvatarUpload">Set Avatar</div>
                <div class="menu-item" @click="openSignatureEdit">Edit Signature</div>
                <div class="menu-item" @click="triggerBackgroundUpload">Set Background</div>
                <div v-if="uiStore.chatBackground" class="menu-item" @click="clearBackground">Clear Background</div>
                <div class="menu-item" @click="openResetPassword">Reset Password</div>
                <div class="menu-item" @click="uiStore.toggleTheme()">Switch Theme</div>
                <div class="menu-item logout" @click="userStore.logout()">Logout</div>
            </div>
            <!-- Signature Edit Modal -->
            <div v-if="showSignatureModal" class="signature-modal-overlay" @click.self="closeSignatureModal">
                <div class="signature-modal">
                    <div class="modal-header">
                        <span>Edit Signature</span>
                        <button class="close-btn" @click="closeSignatureModal">×</button>
                    </div>
                    <div class="modal-body">
                        <input
                            v-model="newSignature"
                            type="text"
                            class="signature-input"
                            placeholder="Enter your signature (max 100 chars)"
                            maxlength="100"
                            @keyup.enter="saveSignature"
                        />
                        <div class="char-count">{{ newSignature.length }}/100</div>
                    </div>
                    <div class="modal-footer">
                        <button class="cancel-btn" @click="closeSignatureModal">Cancel</button>
                        <button class="save-btn" @click="saveSignature">Save</button>
                    </div>
                </div>
            </div>
            <input ref="avatarInput" type="file" accept="image/*" style="display: none" @change="uploadAvatar" />
            <input ref="backgroundInput" type="file" accept="image/*" style="display: none" @change="uploadBackground" />
        </div>

        <div class="header-right">
            <!-- Add Button & Menu -->
            <button class="icon-button plus-button" @click.stop="toggleAddMenu" title="Add New"><PlusIcon /></button>
            <div v-if="uiStore.showAddMenu" class="dropdown-menu show right">
                <div class="menu-item" @click="openAddFriend">Add Friend</div>
                <div class="menu-item" @click="openCreateGroup">Create Group Chat</div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUserStore, useChatStore, useUIStore } from '@/stores';
import { uploadAvatar as uploadAvatarApi } from '@/services/api';
import PlusIcon from './icons/PlusIcon.vue';
import { wsService } from '@/services/websocket';

const userStore = useUserStore();
const chatStore = useChatStore();
const uiStore = useUIStore();

const avatarInput = ref<HTMLInputElement | null>(null);
const backgroundInput = ref<HTMLInputElement | null>(null);
const showSignatureModal = ref(false);
const newSignature = ref('');

function toggleUserMenu()
{
    uiStore.showAddMenu = false;
    uiStore.showUserMenu = !uiStore.showUserMenu;
}

function toggleAddMenu()
{
    uiStore.showUserMenu = false;
    uiStore.showAddMenu = !uiStore.showAddMenu;
}

function openSignatureEdit()
{
    uiStore.showUserMenu = false;
    newSignature.value = userStore.currentUser?.signature || '';
    showSignatureModal.value = true;
}

function closeSignatureModal()
{
    showSignatureModal.value = false;
    newSignature.value = '';
}

function saveSignature()
{
    wsService.sendPacket('update_signature', { signature: newSignature.value });
    if (userStore.currentUser)
    {
        userStore.currentUser.signature = newSignature.value;
    }
    chatStore.showToast('Signature updated', 'success');
    closeSignatureModal();
}

function triggerAvatarUpload()
{
    avatarInput.value?.click();
    uiStore.showUserMenu = false;
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
}

function openAddFriend()
{
    uiStore.showAddMenu = false;
    uiStore.showAddFriendModal = true;
}

function openCreateGroup()
{
    uiStore.showAddMenu = false;
    uiStore.showCreateGroupModal = true;
    chatStore.invitingToChat = false;
    wsService.send('get_friends');
}

function triggerBackgroundUpload()
{
    backgroundInput.value?.click();
    uiStore.showUserMenu = false;
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
    uiStore.showUserMenu = false;
    chatStore.showToast('Background cleared', 'success');
}

function openResetPassword()
{
    uiStore.showUserMenu = false;
    uiStore.showResetPasswordModal = true;
}
</script>

<style scoped>
.sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
}

.header-left,
.header-right {
    display: flex;
    align-items: center;
    position: relative;
}

.avatar-container {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 5px;
    border-radius: 8px;
    transition: background-color 0.2s;
}

.avatar-container:hover {
    background-color: rgba(88, 166, 255, 0.1);
}

.user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    background-color: var(--border-color);
}

.user-name {
    margin-left: 10px;
    font-weight: 500;
}

.dropdown-menu {
    position: absolute;
    top: 45px;
    left: 0;
    background-color: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    width: 160px;
    display: flex;
    z-index: 100;
    flex-direction: column;
    overflow: hidden;
}

.dropdown-menu.right {
    right: 0;
    left: auto;
}

.menu-item {
    padding: 10px 15px;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 0.9em;
    color: var(--text-color);
}

.menu-item:hover {
    background-color: rgba(88, 166, 255, 0.1);
    color: var(--primary-color);
}

.menu-item.logout {
    color: #f85149;
    border-top: 1px solid var(--border-color);
}

.menu-item.logout:hover {
    background-color: rgba(248, 81, 73, 0.1);
}

.icon-button {
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 1.5rem;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: background 0.2s, color 0.2s;
}

.icon-button:hover {
    background-color: rgba(88, 166, 255, 0.1);
    color: var(--primary-color);
}

/* Signature Modal Styles */
.signature-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.signature-modal {
    background-color: var(--panel-bg);
    border-radius: 8px;
    width: 350px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}

.signature-modal .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
    font-weight: bold;
}

.signature-modal .close-btn {
    background: none;
    border: none;
    color: var(--text-color);
    font-size: 1.2em;
    cursor: pointer;
    padding: 5px;
}

.signature-modal .modal-body {
    padding: 15px;
}

.signature-input {
    width: 100%;
    padding: 10px;
    background-color: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-color);
    font-size: 0.95em;
    box-sizing: border-box;
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

.signature-modal .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 15px;
    border-top: 1px solid var(--border-color);
}

.signature-modal .cancel-btn {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    background-color: transparent;
    color: var(--text-color);
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.signature-modal .cancel-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

.signature-modal .save-btn {
    padding: 8px 16px;
    border: none;
    background-color: var(--primary-color);
    color: white;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.signature-modal .save-btn:hover {
    background-color: #4a90d9;
}
</style>
