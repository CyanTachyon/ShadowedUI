<template>
    <div class="chat-area">
        <ChatHeader />
        <div class="chat-content" :style="chatContentStyle">
            <!-- Show Mine Settings Panel -->
            <MineSettingsPanel v-if="uiStore.viewState === 'mine'" />

            <!-- Show Moments View when in moments mode -->
            <MomentsView v-else-if="chatStore.isMomentsView" />

            <!-- Show regular chat messages otherwise -->
            <MessagesContainer v-else />

            <!-- Show chat settings panel in chat mode -->
            <ChatSettingsPanel v-if="!chatStore.isMomentsView && chatStore.showSettingsPanel" />
        </div>
        <!-- Input area only in chat mode -->
        <InputArea v-if="!chatStore.isMomentsView && uiStore.viewState !== 'mine'" />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useChatStore, useUIStore } from '@/stores';
import ChatHeader from './ChatHeader.vue';
import MessagesContainer from './MessagesContainer.vue';
import ChatSettingsPanel from './ChatSettingsPanel.vue';
import MineSettingsPanel from './MineSettingsPanel.vue';
import InputArea from './InputArea.vue';
import MomentsView from './MomentsView.vue';

const chatStore = useChatStore();
const uiStore = useUIStore();

const chatContentStyle = computed(() =>
{
    if (uiStore.chatBackground)
    {
        return {
            backgroundImage: `url(${uiStore.chatBackground})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        };
    }
    return {};
});
</script>

<style scoped>
.chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-color);
    min-width: 0; /* 防止子元素撑大容器 */
    overflow: hidden;
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
