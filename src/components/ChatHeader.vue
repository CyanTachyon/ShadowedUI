<template>
    <div class="chat-header">
        <button class="icon-button mobile-only" @click="goBack">←</button>
        <div class="chat-title">
            <template v-if="uiStore.viewState === 'mine'">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; min-width: 24px; min-height: 24px; max-width: 24px; max-height: 24px;">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Mine</span>
            </template>
            <template v-else-if="chatStore.isBroadcastView">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; min-width: 24px; min-height: 24px; max-width: 24px; max-height: 24px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Broadcasts</span>
            </template>
            <template v-else-if="chatStore.isMomentsView">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; min-width: 24px; min-height: 24px; max-width: 24px; max-height: 24px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8v4l3 3"></path>
                </svg>
                <span>Moments</span>
            </template>
            <template v-else-if="currentChat">
                <template v-if="!isGroup && otherId">
                    <img :src="getAvatarUrl(otherId)" class="chat-avatar" alt="avatar" loading="lazy" />
                </template>
                <template v-else-if="isGroup">
                    <img :src="getGroupAvatarUrl(currentChat.chatId)" class="chat-avatar group" alt="Group Avatar" loading="lazy" />
                </template>
                <span>{{ displayName }}</span>
            </template>
            <template v-else>
                <span>Select a friend</span>
            </template>
        </div>
        <button v-if="currentChat && !chatStore.isBroadcastView && !chatStore.isMomentsView && uiStore.viewState !== 'mine'" class="chat-settings-btn" @click="chatStore.toggleChatSettings()">
            <SettingsIcon />
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useChatStore, useUIStore, useUserStore } from '@/stores';
import { getAvatarUrl, getGroupAvatarUrl } from '@/utils/helpers';
import SettingsIcon from './icons/SettingsIcon.vue';

const chatStore = useChatStore();
const uiStore = useUIStore();
const userStore = useUserStore();

const currentChat = computed(() => chatStore.currentChat);

const isGroup = computed(() => currentChat.value && !currentChat.value.isPrivate);

const displayName = computed(() =>
{
    if (!currentChat.value) return '';
    return currentChat.value.name || `Chat ${currentChat.value.chatId}`;
});

const otherId = computed(() =>
{
    // For private chats, find the other user (not the current user)
    if (currentChat.value?.isPrivate && currentChat.value?.members && userStore.currentUser)
    {
        const myUserId = typeof userStore.currentUser.id === 'object'
            ? userStore.currentUser.id.value
            : userStore.currentUser.id;
        const otherMember = currentChat.value.members.find(m => m.id !== myUserId);
        return otherMember?.id || null;
    }
    return null;
});

function goBack()
{
    uiStore.setViewState('list');
}
</script>

<style scoped>
.chat-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--panel-bg);
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 42px;
}

/* 聊天标题容器，防止标题过长挤出设置按钮 */
.chat-title {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    /* 允许子元素收缩 */
    overflow: hidden;
    /* 防止撑大容器 */
}

/* 聊天标题文本省略号样式 */
.chat-title span {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.chat-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    margin-right: 8px;
    object-fit: cover;
}
.chat-avatar.group {
    border-radius: 25%;
}

.chat-settings-btn {
    background: none;
    border: none;
    color: var(--secondary-color);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 5px;
    border-radius: 50%;
    transition: background 0.2s, color 0.2s;
    width: 30px;
    height: 30px;
}

.chat-settings-btn:hover {
    background: rgba(88, 166, 255, 0.1);
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
    margin-right: 10px;
}

.mobile-only {
    display: none;
}

@media (max-width: 768px) {
    .mobile-only {
        display: flex;
    }

    .chat-header {
        padding: 5px 10px;
    }
}
</style>
