<template>
    <div class="chat-area">
        <ChatHeader />
        <div class="chat-content">
            <MessagesContainer />
            <ChatSettingsPanel v-if="chatStore.showSettingsPanel" />
        </div>
        <InputArea />
    </div>
</template>

<script setup lang="ts">
import { useChatStore } from '@/stores';
import ChatHeader from './ChatHeader.vue';
import MessagesContainer from './MessagesContainer.vue';
import ChatSettingsPanel from './ChatSettingsPanel.vue';
import InputArea from './InputArea.vue';

const chatStore = useChatStore();
</script>

<style scoped>
.chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-color);
}

.chat-content {
    display: flex;
    flex: 1;
    overflow: hidden;
}

@media (max-width: 768px) {
    .chat-area {
        display: none;
        width: 100%;
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        z-index: 10;
        background-color: var(--bg-color);
    }

    :global(body.view-chat) .chat-area {
        display: flex;
    }
}
</style>
