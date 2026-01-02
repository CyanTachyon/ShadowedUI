<template>
    <div class="container" @click="handleGlobalClick">
        <ToastContainer />

        <!-- Auth Overlay -->
        <AuthOverlay v-if="!userStore.isAuthenticated" />

        <!-- Chat Interface -->
        <template v-else-if="uiStore.viewState !== 'profile'">
            <Sidebar />
            <ChatArea />
        </template>

        <!-- Profile Page -->
        <UserProfilePage v-else-if="uiStore.viewState === 'profile'" />

        <!-- Modals -->
        <AddFriendModal />
        <CreateGroupModal />
        <ResetPasswordModal />
        <KickMemberModal />
        <DeleteChatModal />
        <MomentSettingsModal />
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useUserStore, useChatStore, useUIStore } from '@/stores';
import { wsService } from '@/services/websocket';

import ToastContainer from '@/components/ToastContainer.vue';
import AuthOverlay from '@/components/AuthOverlay.vue';
import Sidebar from '@/components/Sidebar.vue';
import ChatArea from '@/components/ChatArea.vue';
import UserProfilePage from '@/components/UserProfilePage.vue';
import AddFriendModal from '@/components/modals/AddFriendModal.vue';
import CreateGroupModal from '@/components/modals/CreateGroupModal.vue';
import ResetPasswordModal from '@/components/modals/ResetPasswordModal.vue';
import KickMemberModal from '@/components/modals/KickMemberModal.vue';
import DeleteChatModal from '@/components/modals/DeleteChatModal.vue';
import MomentSettingsModal from '@/components/modals/MomentSettingsModal.vue';

const userStore = useUserStore();
const chatStore = useChatStore();
const uiStore = useUIStore();

function handleGlobalClick(event: MouseEvent)
{
    const target = event.target as HTMLElement;
    if (!target.closest('.header-right') && !target.closest('#add-menu'))
    {
        uiStore.showAddMenu = false;
    }
}

// Setup WebSocket handlers
function setupWebSocketHandlers()
{
    wsService.on('notify', (data) =>
    {
        const type = data.type.toLowerCase() as 'info' | 'error' | 'success' | 'warning';
        chatStore.showToast(data.message, type);
    });

    wsService.on('login_result', async (data) =>
    {
        if (data.success === false)
        {
            if (data.error) chatStore.showToast(data.error, 'error');
            userStore.logout();
            return;
        }
        const success = await userStore.handleLoginSuccess(data);
        if (success) chatStore.refreshChats();
    });

    wsService.on('chats_list', async (data) =>
    {
        await chatStore.handleChatsList(data.chats);
    });

    wsService.on('messages_list', (data) =>
    {
        chatStore.handleMessagesList(data);
    });

    wsService.on('receive_message', (data) =>
    {
        chatStore.handleReceiveMessage(data);
    });

    wsService.on('message_edited', (data) =>
    {
        chatStore.handleMessageEdited(data);
    });

    wsService.on('friends_list', (data) =>
    {
        chatStore.setFriends(data.friends);
    });

    wsService.on('chat_details', (data) =>
    {
        chatStore.handleChatDetails(data);
    });

    wsService.on('friend_added', (data) =>
    {
        chatStore.showToast(data.message, 'success');
        chatStore.refreshChats();
        chatStore.pendingChatToOpen = data.chatId;
    });

    wsService.on('broadcasts_list', (data) =>
    {
        chatStore.handleBroadcastsList(data);
    });

    wsService.on('unread_count', (data) =>
    {
        chatStore.handleUnreadCount(data);
    });

    wsService.on('public_key_by_username', () =>{});

    wsService.onConnect(async () =>
    {
        if (userStore.authToken && userStore.username) userStore.relogin();
    });
}

// Handle browser history
function handlePopState(event: PopStateEvent)
{
    const state = event.state;
    if (!state || state.view === 'list')
    {
        uiStore.setViewState('list');
        chatStore.currentChatId = null;
        chatStore.isBroadcastView = false;
        chatStore.showSettingsPanel = false;
    }
    else if (state.view === 'chat')
    {
        // 从 settings 返回到 chat
        if (chatStore.showSettingsPanel)
        {
            chatStore.closeChatSettings();
            return;
        }

        uiStore.setViewState('chat');

        // 清除 moments 视图状态（除非正在恢复 moments）
        if (state.chatId !== 'moments')
        {
            chatStore.isMomentsView = false;
            chatStore.viewingUserMomentsId = null;
        }

        if (state.chatId === 'broadcasts')
        {
            if (!chatStore.isBroadcastView)
            {
                // 直接恢复广播视图状态，不修改历史
                chatStore.restoreBroadcastView();
            }
        }
        else if (state.chatId === 'moments')
        {
            if (!chatStore.isMomentsView || (chatStore.viewingUserMomentsId !== state.viewingUserId))
            {
                // 直接恢复 moments 视图状态，不修改历史
                chatStore.restoreMomentsView(state.viewingUserId);
            }
        }
        else if (state.chatId && state.chatId !== chatStore.currentChatId)
        {
            const chat = chatStore.chats.find(c => c.chatId === state.chatId);
            if (chat)
            {
                // 直接恢复聊天状态，不修改历史
                chatStore.restoreChatView(chat);
            }
        }
    }
    else if (state.view === 'mine')
    {
        if (uiStore.viewState !== 'mine')
        {
            uiStore.setViewState('mine');
            chatStore.showSettingsPanel = false;
        }
        // 保存之前的状态信息，用于返回时恢复
        if (state.previousView && state.previousChatId)
        {
            (window as any).minePreviousState = {
                view: state.previousView,
                chatId: state.previousChatId
            };
        }
    }
    else if (state.view === 'about')
    {
        if (uiStore.viewState !== 'about')
        {
            uiStore.setViewState('about');
        }
    }
    else if (state.view === 'profile')
    {
        if (uiStore.viewState !== 'profile')
        {
            uiStore.profileUserId = state.userId;
            uiStore.setViewState('profile');
        }
    }
    // 处理从 mine 返回的情况
    else if ((!state || state.view === 'list') && (window as any).minePreviousState)
    {
        const previousState = (window as any).minePreviousState;
        (window as any).minePreviousState = null;

        if (previousState.view === 'chat')
        {
            if (previousState.chatId === 'broadcasts')
            {
                chatStore.openBroadcasts();
            }
            else if (previousState.chatId === 'moments')
            {
                chatStore.openMoments();
            }
            else
            {
                const chat = chatStore.chats.find(c => c.chatId === previousState.chatId);
                if (chat)
                {
                    uiStore.setViewState('chat');
                    chatStore.selectChat(chat);
                }
            }
        }
    }
    else if (state.view === 'settings')
    {
        // 从 profile 或其他页面返回到 settings
        uiStore.profileUserId = null;
        // 直接打开设置面板，不修改历史
        chatStore.openSettingsPanel(state.chatId);
    }
}

onMounted(() =>
{
    uiStore.initTheme();
    setupWebSocketHandlers();
    wsService.connect();
    window.addEventListener('popstate', handlePopState);

    // 设置初始历史状态
    history.replaceState({ view: 'list' }, '', '');
});

onUnmounted(() =>
{
    window.removeEventListener('popstate', handlePopState);
});
</script>

<style>
:root {
    --bg-color: #0d1117;
    --text-color: #c9d1d9;
    --primary-color: #58a6ff;
    --secondary-color: #8b949e;
    --border-color: #30363d;
    --panel-bg: #161b22;
    --input-bg: #0d1117;
    --shadow: 0 0 10px rgba(88, 166, 255, 0.2);
    --font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

[data-theme='light'] {
    --bg-color: #ffffff;
    --text-color: #24292f;
    --primary-color: #0969da;
    --secondary-color: #57606a;
    --border-color: #d0d7de;
    --panel-bg: #f6f8fa;
    --input-bg: #ffffff;
    --shadow: 0 0 10px rgba(9, 105, 218, 0.2);
}

html {
    height: 100%;
    width: 100%;
    user-select: none;
}

body {
    background-color: var(--bg-color);
    color: var(--text-color);
    font-family: var(--font-family);
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
    overflow: hidden;
    transition: background-color 0.3s, color 0.3s;
}

#app {
    width: 100%;
    height: 100%;
}

.container {
    width: 100%;
    height: 100%;
    background-color: var(--panel-bg);
    display: flex;
    overflow: hidden;
    position: relative;
}

/* Scrollbar styling */
::-webkit-scrollbar {
    width: 8px;
}

::-webkit-scrollbar-track {
    background: var(--bg-color);
}

::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--secondary-color);
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
    body.view-chat .sidebar {
        display: none;
    }

    body.view-chat .chat-area {
        display: flex;
    }
}
</style>
