<template>
    <div class="chat-header">
        <button class="icon-button mobile-only" @click="goBack">←</button>
        <div class="chat-title">
            <template v-if="chatStore.isBroadcastView">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Broadcasts</span>
            </template>
            <template v-else-if="currentChat">
                <template v-if="!isGroup && otherId">
                    <img :src="getAvatarUrl(otherId)" class="chat-avatar" alt="avatar" loading="lazy" />
                </template>
                <template v-else-if="isGroup">
                    <svg class="group-icon-svg" style="width: 24px; height: 24px; margin-right: 8px" viewBox="0 0 24 24">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
                    </svg>
                </template>
                <span>{{ displayName }}</span>
            </template>
            <template v-else>
                <span>Select a friend</span>
            </template>
        </div>
        <button v-if="currentChat && !chatStore.isBroadcastView" class="chat-settings-btn" @click="chatStore.toggleChatSettings()">
            ⚙️
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useChatStore, useUIStore } from '@/stores';
import { getAvatarUrl } from '@/utils/helpers';

const chatStore = useChatStore();
const uiStore = useUIStore();

const currentChat = computed(() => chatStore.currentChat);

const isGroup = computed(() => currentChat.value && !currentChat.value.isPrivate);

const displayName = computed(() =>
{
    if (!currentChat.value) return '';
    return currentChat.value.name || `Chat ${currentChat.value.chatId}`;
});

const otherId = computed(() =>
{
    if (!currentChat.value) return null;
    return currentChat.value.parsedOtherIds && currentChat.value.parsedOtherIds.length > 0
        ? currentChat.value.parsedOtherIds[0]
        : null;
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

.chat-title {
    display: flex;
    align-items: center;
    flex: 1;
}

.chat-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    margin-right: 8px;
    object-fit: cover;
}

.group-icon-svg {
    fill: var(--primary-color);
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
