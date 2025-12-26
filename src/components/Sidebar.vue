<template>
    <div class="sidebar">
        <SidebarHeader />
        <BroadcastHeader @click="chatStore.openBroadcasts()" />
        <div class="friend-list scrollable">
            <ChatItem v-for="chat in chatStore.chats" :key="chat.chatId" :chat="chat" :is-active="chatStore.currentChatId === chat.chatId" @select="chatStore.selectChat(chat)" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useChatStore } from '@/stores';
import SidebarHeader from './SidebarHeader.vue';
import BroadcastHeader from './BroadcastHeader.vue';
import ChatItem from './ChatItem.vue';

const chatStore = useChatStore();
</script>

<style scoped>
.sidebar {
    width: 300px;
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
}

.friend-list {
    flex: 1;
    overflow-y: auto;
}

@media (max-width: 768px) {
    .sidebar {
        width: 100%;
        border-right: none;
    }
}
</style>
