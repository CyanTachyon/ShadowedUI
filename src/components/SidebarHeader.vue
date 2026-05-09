<template>
    <div class="sidebar-header">
        <div class="header-left">
            <!-- User Avatar -->
            <div class="avatar-container" @click="openOwnProfile" title="My Profile">
                <img :src="userStore.getAvatarUrl()" class="user-avatar" alt="Avatar" loading="lazy" />
                <span class="user-name">{{ userStore.currentUser?.username || 'User' }}</span>
            </div>
        </div>

        <div class="header-right">
            <!-- Add Button & Menu -->
            <button class="icon-button friend-requests-btn" @click="openFriendRequests" title="Friend Requests">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                <span v-if="pendingRequestCount > 0" class="badge">{{ pendingRequestCount > 99 ? '…' : pendingRequestCount }}</span>
            </button>
            <button class="icon-button plus-button" @click.stop="toggleAddMenu" title="Add New">
                <PlusIcon />
            </button>
            <div v-if="uiStore.showAddMenu" class="dropdown-menu show right">
                <div class="menu-item" @click="openSearchUserById">Search User by ID</div>
                <div class="menu-item" @click="openSearchUserByName">Search User by Name</div>
                <div class="menu-item" @click="openCreateGroup">Create Group Chat</div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useUserStore, useChatStore, useUIStore } from '@/stores';
import { computed } from 'vue';
import PlusIcon from './icons/PlusIcon.vue';
import { wsService } from '@/services/websocket';

const userStore = useUserStore();
const chatStore = useChatStore();
const uiStore = useUIStore();

const pendingRequestCount = computed(() => chatStore.friendRequests.length);

function openFriendRequests()
{
    uiStore.showFriendRequestsModal = true;
    chatStore.getFriendRequests();
}

function openOwnProfile()
{
    if (userStore.userId)
    {
        uiStore.navigateToProfile(userStore.userId);
    }
}

function toggleAddMenu()
{
    uiStore.showAddMenu = !uiStore.showAddMenu;
}

function openSearchUserById()
{
    uiStore.showAddMenu = false;
    uiStore.showSearchUserByIdModal = true;
}

function openSearchUserByName()
{
    uiStore.showAddMenu = false;
    uiStore.showSearchUserByNameModal = true;
}

function openCreateGroup()
{
    uiStore.showAddMenu = false;
    uiStore.showCreateGroupModal = true;
    chatStore.invitingToChat = false;
    wsService.send('get_friends');
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
    gap: 4px;
}

.friend-requests-btn {
    position: relative;
}

.badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    font-size: 0.65em;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
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
    left: auto;
    right: 0;
    background-color: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    width: 180px;
    display: flex;
    z-index: 100;
    flex-direction: column;
    overflow: hidden;
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
