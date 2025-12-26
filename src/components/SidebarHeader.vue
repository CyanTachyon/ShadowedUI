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
                <div class="menu-item" @click="openResetPassword">Reset Password</div>
                <div class="menu-item" @click="uiStore.toggleTheme()">Switch Theme</div>
                <div class="menu-item logout" @click="userStore.logout()">Logout</div>
            </div>
            <input ref="avatarInput" type="file" accept="image/*" style="display: none" @change="uploadAvatar" />
        </div>

        <div class="header-right">
            <!-- Add Button & Menu -->
            <button class="icon-button plus-button" @click.stop="toggleAddMenu" title="Add New">+</button>
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

const userStore = useUserStore();
const chatStore = useChatStore();
const uiStore = useUIStore();

const avatarInput = ref<HTMLInputElement | null>(null);

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
        // Force refresh avatar by updating the URL
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

function openResetPassword()
{
    uiStore.showUserMenu = false;
    uiStore.showResetPasswordModal = true;
}

import { wsService } from '@/services/websocket';
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
</style>
