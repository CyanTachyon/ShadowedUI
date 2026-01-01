<template>
    <div class="sidebar">
        <SidebarHeader />
        <div class="friend-list scrollable">
            <ChatItem v-for="chat in chatStore.chats" :key="chat.chatId" :chat="chat" :is-active="chatStore.currentChatId === chat.chatId" @select="chatStore.selectChat(chat)" />
        </div>
        <div class="tab-bar">
            <button
                class="tab-item"
                :class="{ active: chatStore.isBroadcastView }"
                @click="chatStore.openBroadcasts()"
                title="Broadcasts"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Broadcasts</span>
            </button>
            <button
                class="tab-item"
                :class="{ active: chatStore.isMomentsView }"
                @click="chatStore.openMoments()"
                title="Moments"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8v4l3 3"></path>
                </svg>
                <span>Moments</span>
            </button>
            <button
                class="tab-item"
                :class="{ active: uiStore.viewState === 'mine' }"
                @click="openMineSettings()"
                title="Mine"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Mine</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useChatStore, useUIStore } from '@/stores';
import SidebarHeader from './SidebarHeader.vue';
import ChatItem from './ChatItem.vue';

const chatStore = useChatStore();
const uiStore = useUIStore();

function openMineSettings() {
    const uiStore = useUIStore();
    const currentState = history.state;

    uiStore.setViewState('mine');

    // 如果已经在 mine 视图，替换当前状态
    if (currentState?.view === 'mine')
    {
        history.replaceState({ view: 'mine' }, '', '');
    }
    else
    {
        // 从其他视图（包括 chat/settings/list）进入 Mine，压入新状态
        // 保存之前的状态信息，返回时能正确恢复
        const mineState: any = { view: 'mine' };

        // 保存之前视图的状态信息
        if (currentState?.view)
        {
            mineState.previousView = currentState.view;
            mineState.previousChatId = currentState.chatId || null;
        }
        // 如果当前历史状态为空（首次进入），从 chatStore 获取当前状态
        else if (chatStore.currentChatId)
        {
            mineState.previousView = 'chat';
            mineState.previousChatId = chatStore.currentChatId;
        }
        else if (chatStore.isBroadcastView)
        {
            mineState.previousView = 'chat';
            mineState.previousChatId = 'broadcasts';
        }
        else if (chatStore.isMomentsView)
        {
            mineState.previousView = 'chat';
            mineState.previousChatId = 'moments';
        }

        history.pushState(mineState, '', '');
    }
}
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

.moments-list {
    flex: 1;
    overflow-y: auto;
}

.tab-bar {
    display: flex;
    border-top: 1px solid var(--border-color);
    background: var(--panel-bg);
}

.tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 0;
    background: none;
    border: none;
    color: var(--secondary-color);
    cursor: pointer;
    transition: color 0.2s, background-color 0.2s;
    gap: 4px;
}

.tab-item:hover {
    background: var(--hover-bg);
}

.tab-item.active {
    color: var(--primary-color);
}

.tab-item svg {
    width: 20px;
    height: 20px;
}

.tab-item span {
    font-size: 0.75rem;
}

@media (max-width: 768px) {
    .sidebar {
        width: 100%;
        border-right: none;
    }
}
</style>
