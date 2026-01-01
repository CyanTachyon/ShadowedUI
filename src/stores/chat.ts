import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Chat, Message, Broadcast, ChatDetails, Friend, Toast, ToastType } from '@/types';
import { wsService } from '@/services/websocket';
import { fetchPublicKeyByUsername } from '@/services/api';
import
{
    decryptSymmetricKey,
    encryptSymmetricKey,
    generateSymmetricKey,
    importPublicKey
} from '@/utils/crypto';
import { useUserStore } from './user';
import { useUIStore } from './ui';
import { isPageInForeground } from '@/utils/helpers';

export const useChatStore = defineStore('chat', () =>
{
    // State
    const chats = ref<Chat[]>([]);
    const currentChatId = ref<number | null>(null);
    const currentChatMessages = ref<Message[]>([]);
    const chatKeys = ref<Map<number, CryptoKey>>(new Map());
    const currentChatDetails = ref<ChatDetails['chat'] | null>(null);
    const replyingToMessage = ref<Message | null>(null);
    const isDoNotDisturb = ref(false);

    // Broadcast state
    const isBroadcastView = ref(false);
    const currentBroadcasts = ref<Broadcast[]>([]);
    const broadcastOffset = ref(0);
    const hasMoreBroadcasts = ref(true);

    // Moments state
    const isMomentsView = ref(false);
    const viewingUserMomentsId = ref<number | null>(null);

    // UI state
    const toasts = ref<Toast[]>([]);
    const pendingChatToOpen = ref<number | null>(null);
    const hasMoreMessages = ref(true);
    const currentChatOffset = ref(0);
    const showSettingsPanel = ref(false);
    const invitingToChat = ref(false);
    const friends = ref<Friend[]>([]);
    const messagesLoading = ref(false);

    // Computed
    const currentChat = computed(() =>
    {
        if (!currentChatId.value) return null;
        return chats.value.find(c => c.chatId === currentChatId.value) || null;
    });

    // Toast methods
    let toastId = 0;
    function showToast(message: string, type: ToastType = 'info', onClick?: () => void): void
    {
        const id = ++toastId;
        toasts.value.push({ id, message, type, onClick });
        setTimeout(() =>
        {
            toasts.value = toasts.value.filter(t => t.id !== id);
        }, 3000);

        // 发送浏览器通知
        if ('Notification' in window && !isPageInForeground() && Notification.permission === 'granted')
        {
            const notification = new Notification('Shadow Chat', {
                body: message,
                icon: '/icon.png',
                tag: `toast-${id}`,
                requireInteraction: false
            });

            if (onClick)
            {
                notification.onclick = () =>
                {
                    window.focus();
                    onClick();
                    notification.close();
                };
            }

            setTimeout(() => notification.close(), 3000);
        }
    }

    // Chat key management
    async function decryptChatKey(encryptedKey: string): Promise<CryptoKey | null>
    {
        const userStore = useUserStore();
        if (!userStore.privateKey) return null;
        return await decryptSymmetricKey(encryptedKey, userStore.privateKey);
    }

    function getChatKey(chatId: number): CryptoKey | undefined
    {
        return chatKeys.value.get(chatId);
    }

    function setChatKey(chatId: number, key: CryptoKey): void
    {
        chatKeys.value.set(chatId, key);
    }

    // Chat list handling
    async function handleChatsList(chatsList: Chat[]): Promise<void>
    {
        const userStore = useUserStore();
        const uiStore = useUIStore();

        for (const chat of chatsList)
        {
            if (!chatKeys.value.has(chat.chatId) && userStore.privateKey)
            {
                const aesKey = await decryptSymmetricKey(chat.key, userStore.privateKey);
                if (aesKey)
                {
                    chatKeys.value.set(chat.chatId, aesKey);
                }
                else
                {
                    console.error('Failed to decrypt key for chat', chat.chatId);
                }
            }
        }

        chats.value = chatsList;

        // 检查当前打开的聊天是否还存在
        if (currentChatId.value !== null)
        {
            const currentChatExists = chatsList.some(c => c.chatId === currentChatId.value);
            if (!currentChatExists)
            {
                // 当前聊天已被删除，关闭聊天视图
                const wasInSettings = showSettingsPanel.value;
                
                currentChatId.value = null;
                currentChatMessages.value = [];
                currentChatDetails.value = null;
                showSettingsPanel.value = false;
                isBroadcastView.value = false;
                uiStore.setViewState('list');
                
                // 根据当前状态处理历史
                // 如果在设置页面，需要回退两步（settings -> chat -> list）
                // 如果在聊天页面，需要回退一步（chat -> list）
                // 使用 go() 而不是 replaceState，确保历史栈正确
                if (wasInSettings)
                {
                    history.go(-2);
                }
                else
                {
                    history.back();
                }
            }
        }

        if (pendingChatToOpen.value)
        {
            const chatToOpen = chatsList.find(c => c.chatId === pendingChatToOpen.value);
            if (chatToOpen)
            {
                selectChat(chatToOpen);
            }
            pendingChatToOpen.value = null;
        }
    }

    // Select a chat
    function selectChat(chat: Chat): void
    {
        const uiStore = useUIStore();

        isBroadcastView.value = false;
        isMomentsView.value = false; // Clear moments view
        currentChatId.value = chat.chatId;
        isDoNotDisturb.value = chat.doNotDisturb;
        currentChatMessages.value = [];
        currentChatOffset.value = 0;
        hasMoreMessages.value = true;
        showSettingsPanel.value = false;
        replyingToMessage.value = null;
        messagesLoading.value = true;

        uiStore.setViewState('chat');

        // 检查当前历史状态，决定是 push 还是 replace
        const currentState = history.state;
        if (currentState?.view === 'chat' || currentState?.view === 'settings')
        {
            // 已经在聊天/设置视图，替换当前状态
            history.replaceState({ view: 'chat', chatId: chat.chatId }, '', '');
        }
        else
        {
            // 从列表进入聊天，压入新状态
            history.pushState({ view: 'chat', chatId: chat.chatId }, '', '');
        }

        loadChatMessages(chat.chatId, 0);
    }

    function loadChatMessages(chatId: number, offset: number): void
    {
        wsService.sendPacket('get_messages', {
            chatId,
            begin: offset,
            count: 50
        });
    }

    function loadMoreMessages(): void
    {
        if (!currentChatId.value || !hasMoreMessages.value) return;
        currentChatOffset.value += 50;
        loadChatMessages(currentChatId.value, currentChatOffset.value);
    }

    function mergeMessages(messages: Message[])
    {
        const map = new Map(currentChatMessages.value.map(m => [m.id, m]));
        for (const m of messages) 
            if (m.type === 'TEXT' && !m.content) map.delete(m.id);
            else map.set(m.id, m);
        currentChatMessages.value = Array.from(map.values()).sort((a, b) => b.id - a.id);
    }

    // Message handling
    function handleMessagesList(data: { chatId: number; messages: Message[]; }): void
    {
        if (data.chatId === currentChatId.value)
        {
            hasMoreMessages.value = data.messages.length > 0;
            messagesLoading.value = false;
        }
        mergeMessages(data.messages);
    }

    function handleReceiveMessage(data: { message: Message; }): void
    {
        if (data.message.chatId === currentChatId.value)
            mergeMessages([data.message]);
        if (data.message.chatId !== currentChatId.value || !isPageInForeground())
        {
            const chat = chats.value.find(c => c.chatId === data.message.chatId);
            if (!chat) return;
            if (chat.doNotDisturb) return;
            const message = chat.isPrivate ? `New message from ${data.message.senderName || 'a friend'}` : `New message in ${chat.name || 'a group chat'}`;
            showToast(message, 'info', () =>
            {
                const chat = chats.value.find(c => c.chatId === data.message.chatId);
                if (chat) selectChat(chat);
            });
        }
    }

    // Handle message edit response
    function handleMessageEdited(data: { messageId: number; content: string; chatId: number; }): void
    {
        // 更新当前聊天中的消息
        const messageIndex = currentChatMessages.value.findIndex(m => m.id === data.messageId);
        if (messageIndex !== -1)
        {
            currentChatMessages.value[messageIndex] = {
                ...currentChatMessages.value[messageIndex],
                content: data.content
            };
        }
    }

    // Edit or delete (withdraw) a message
    function editMessage(messageId: number, message: string | null): void
    {
        wsService.sendPacket('edit_message', {
            messageId,
            message
        });
    }

    // Broadcast handling
    function openBroadcasts(): void
    {
        const uiStore = useUIStore();

        isBroadcastView.value = true;
        isMomentsView.value = false;
        currentChatId.value = null;
        currentBroadcasts.value = [];
        broadcastOffset.value = 0;
        hasMoreBroadcasts.value = true;
        showSettingsPanel.value = false;

        uiStore.setViewState('chat');

        // 检查当前历史状态，决定是 push 还是 replace
        const currentState = history.state;
        if (currentState?.view === 'chat' || currentState?.view === 'settings')
        {
            // 已经在聊天/设置视图，替换当前状态
            history.replaceState({ view: 'chat', chatId: 'broadcasts' }, '', '');
        }
        else
        {
            // 从列表进入广播，压入新状态
            history.pushState({ view: 'chat', chatId: 'broadcasts' }, '', '');
        }

        loadBroadcasts();
    }

    function loadBroadcasts(): void
    {
        wsService.sendPacket('get_broadcasts', {
            system: null,
            before: broadcastOffset.value > 0 ? broadcastOffset.value : Number.MAX_SAFE_INTEGER,
            count: 50
        });
    }

    // 刷新广播列表（获取最新的广播，不清空现有列表）
    function refreshBroadcasts(): void
    {
        wsService.sendPacket('get_broadcasts', {
            system: null,
            before: Number.MAX_SAFE_INTEGER,
            count: 50
        });
    }

    function handleBroadcastsList(data: { broadcasts: Broadcast[]; }): void
    {
        hasMoreBroadcasts.value = data.broadcasts.length > 0;
        currentBroadcasts.value.push(...data.broadcasts);
        // Remove duplicates and sort
        currentBroadcasts.value = Array.from(
            new Map(currentBroadcasts.value.map(b => [b.id, b])).values()
        ).sort((a, b) => a.id - b.id);

        // 更新 offset 为最小的 id
        if (currentBroadcasts.value.length > 0)
        {
            broadcastOffset.value = Math.min(...currentBroadcasts.value.map(b => b.id));
        }
    }

    function loadMoreBroadcasts(): void
    {
        if (!hasMoreBroadcasts.value) return;
        loadBroadcasts();
    }

    // Friend management
    async function addFriend(targetUsername: string): Promise<void>
    {
        const userStore = useUserStore();

        try
        {
            const targetPublicKeyStr = await fetchPublicKeyByUsername(targetUsername);
            if (!targetPublicKeyStr)
            {
                showToast('User not found or no key', 'error');
                return;
            }

            const targetPublicKey = await importPublicKey(targetPublicKeyStr);
            const myPublicKey = await userStore.getMyPublicKey();

            if (!myPublicKey)
            {
                throw new Error('My public key unavailable');
            }

            const symmetricKey = await generateSymmetricKey();
            const encryptedKeyForFriend = await encryptSymmetricKey(symmetricKey, targetPublicKey);
            const encryptedKeyForSelf = await encryptSymmetricKey(symmetricKey, myPublicKey);

            wsService.sendPacket('add_friend', {
                targetUsername,
                keyForFriend: encryptedKeyForFriend,
                keyForSelf: encryptedKeyForSelf
            });
        }
        catch (e: any)
        {
            console.error('Add friend error', e);
            showToast('Failed: ' + e.message, 'error');
        }
    }

    // Group management
    async function createGroup(groupName: string, memberUsernames: string[]): Promise<void>
    {
        const userStore = useUserStore();

        if (memberUsernames.length < 2)
        {
            showToast('Group chat requires at least 3 members (including yourself)', 'error');
            return;
        }

        try
        {
            const publicKeys: Record<string, CryptoKey> = {};

            for (const username of memberUsernames)
            {
                const pubKey = await fetchPublicKeyByUsername(username);
                if (!pubKey)
                {
                    showToast(`User not found: ${username}`, 'error');
                    return;
                }
                publicKeys[username] = await importPublicKey(pubKey);
            }

            const myPublicKey = await userStore.getMyPublicKey();
            if (!myPublicKey)
            {
                throw new Error('My public key unavailable');
            }

            const symmetricKey = await generateSymmetricKey();
            const encryptedKeys: Record<string, string> = {};

            encryptedKeys[userStore.currentUser!.username] = await encryptSymmetricKey(symmetricKey, myPublicKey);

            for (const username of memberUsernames)
                if (username !== userStore.currentUser!.username)
                    encryptedKeys[username] = await encryptSymmetricKey(symmetricKey, publicKeys[username]);

            wsService.sendPacket('create_group', {
                name: groupName || null,
                memberUsernames,
                encryptedKeys
            });
        }
        catch (e: any)
        {
            console.error('Create group error', e);
            showToast('Failed: ' + e.message, 'error');
        }
    }

    async function inviteMemberToChat(username: string): Promise<void>
    {
        if (!currentChatDetails.value || !currentChatId.value)
        {
            showToast('No chat selected', 'error');
            return;
        }

        try
        {
            const chatKey = chatKeys.value.get(currentChatId.value);
            if (!chatKey)
            {
                showToast('Chat key not available', 'error');
                return;
            }

            const publicKeyStr = await fetchPublicKeyByUsername(username);
            if (!publicKeyStr)
            {
                showToast(`User not found: ${username}`, 'error');
                return;
            }

            const publicKey = await importPublicKey(publicKeyStr);
            const encryptedKey = await encryptSymmetricKey(chatKey, publicKey);

            wsService.sendPacket('add_member_to_chat', {
                chatId: currentChatId.value,
                username,
                encryptedKey
            });
        }
        catch (e: any)
        {
            console.error('Invite member error', e);
            showToast('Failed to invite member: ' + e.message, 'error');
        }
    }

    // Settings
    function toggleChatSettings(): void
    {
        const uiStore = useUIStore();
        if (showSettingsPanel.value)
            history.back();
        else
        {
            currentChatDetails.value = null;
            showSettingsPanel.value = true;
            uiStore.setViewState('settings');
            const currentState = history.state;
            if (currentState?.view === 'settings')
                history.replaceState({ view: 'settings', chatId: currentChatId.value }, '', '')
            else
                history.pushState({ view: 'settings', chatId: currentChatId.value }, '', '')
            if (currentChatId.value)
                wsService.sendPacket('get_chat_details', { chatId: currentChatId.value })
        }
    }

    // 关闭设置面板（不触发 history.back，用于 popstate 处理）
    function closeChatSettings(): void
    {
        const uiStore = useUIStore();
        showSettingsPanel.value = false;
        uiStore.setViewState('chat');
    }

    // 直接打开设置面板（不修改历史，用于 popstate 处理）
    function openSettingsPanel(): void
    {
        const uiStore = useUIStore();
        showSettingsPanel.value = true;
        uiStore.setViewState('settings');
        if (currentChatId.value)
        {
            wsService.sendPacket('get_chat_details', { chatId: currentChatId.value });
        }
    }

    // 恢复聊天视图（不修改历史，用于 popstate 处理）
    function restoreChatView(chat: Chat): void
    {
        const uiStore = useUIStore();

        isBroadcastView.value = false;
        currentChatId.value = chat.chatId;
        currentChatMessages.value = [];
        currentChatOffset.value = 0;
        hasMoreMessages.value = true;
        showSettingsPanel.value = false;
        messagesLoading.value = true;

        uiStore.setViewState('chat');
        loadChatMessages(chat.chatId, 0);
    }

    // 恢复广播视图（不修改历史，用于 popstate 处理）
    function restoreBroadcastView(): void
    {
        const uiStore = useUIStore();

        isBroadcastView.value = true;
        currentChatId.value = null;
        currentBroadcasts.value = [];
        broadcastOffset.value = 0;
        hasMoreBroadcasts.value = true;
        showSettingsPanel.value = false;

        uiStore.setViewState('chat');
        loadBroadcasts();
    }

    // 恢复 moments 视图（不修改历史，用于 popstate 处理）
    function restoreMomentsView(): void
    {
        const uiStore = useUIStore();

        isMomentsView.value = true;
        isBroadcastView.value = false;
        currentChatId.value = null;
        viewingUserMomentsId.value = null;
        showSettingsPanel.value = false;

        uiStore.setViewState('chat');
        // MomentsView 组件自己负责加载数据
    }

    function handleChatDetails(data: ChatDetails): void
    {
        if (data.chat.id === currentChatId.value)
            currentChatDetails.value = data.chat;
    }

    function updateChatName(newName: string): void
    {
        if (!currentChatId.value || !newName) return;
        wsService.sendPacket('rename_chat', {
            chatId: currentChatId.value,
            newName
        });
    }

    function kickMember(chatId: number, username: string): void
    {
        wsService.sendPacket('kick_member_from_chat', { chatId, username });
    }

    function setDoNotDisturb(value: boolean): void
    {
        if (!currentChatId.value) return;
        isDoNotDisturb.value = value;
        wsService.sendPacket('set_do_not_disturb', {
            chatId: currentChatId.value,
            doNotDisturb: value
        });
    }

    // Refresh
    function refreshChats(): void
    {
        wsService.send('get_chats');
    }

    function setFriends(friendsList: Friend[]): void
    {
        friends.value = friendsList;
    }

    function handleUnreadCount(data: { chatId: number; unread: number; }): void
    {
        const chat = chats.value.find(c => c.chatId === data.chatId);
        if (chat)
        {
            chat.unreadCount = data.unread;
        }
    }

    // Moments methods
    function openMoments(): void
    {
        const uiStore = useUIStore();

        isMomentsView.value = true;
        isBroadcastView.value = false;
        currentChatId.value = null;
        showSettingsPanel.value = false;
        viewingUserMomentsId.value = null;

        uiStore.setViewState('chat');

        // 检查当前历史状态，决定是 push 还是 replace
        const currentState = history.state;
        if (currentState?.view === 'chat' || currentState?.view === 'settings')
        {
            // 已经在聊天/设置视图，替换当前状态
            history.replaceState({ view: 'chat', chatId: 'moments' }, '', '');
        }
        else
        {
            // 从列表进入 Moments，压入新状态
            history.pushState({ view: 'chat', chatId: 'moments' }, '', '');
        }
    }

    function switchToChats(): void
    {
        isMomentsView.value = false;
        viewingUserMomentsId.value = null;
    }

    function viewUserMoments(userId: number): void
    {
        const uiStore = useUIStore();

        viewingUserMomentsId.value = userId;
        isMomentsView.value = true;
        isBroadcastView.value = false;
        currentChatId.value = null;
        showSettingsPanel.value = false;

        uiStore.setViewState('chat');

        wsService.sendPacket('get_user_moments', {
            userId,
            before: 0,
            count: 50
        });
    }

    function setReplyingTo(message: Message): void
    {
        replyingToMessage.value = message;
    }

    function clearReplyingTo(): void
    {
        replyingToMessage.value = null;
    }

    return {
        // State
        chats,
        currentChatId,
        currentChatMessages,
        chatKeys,
        currentChatDetails,
        replyingToMessage,
        isDoNotDisturb,
        isBroadcastView,
        currentBroadcasts,
        broadcastOffset,
        hasMoreBroadcasts,
        isMomentsView,
        viewingUserMomentsId,
        toasts,
        pendingChatToOpen,
        hasMoreMessages,
        currentChatOffset,
        showSettingsPanel,
        invitingToChat,
        friends,
        messagesLoading,

        // Computed
        currentChat,

        // Methods
        showToast,
        decryptChatKey,
        getChatKey,
        setChatKey,
        handleChatsList,
        selectChat,
        loadChatMessages,
        loadMoreMessages,
        handleMessagesList,
        handleReceiveMessage,
        handleMessageEdited,
        editMessage,
        openBroadcasts,
        loadBroadcasts,
        loadMoreBroadcasts,
        refreshBroadcasts,
        handleBroadcastsList,
        addFriend,
        createGroup,
        inviteMemberToChat,
        toggleChatSettings,
        closeChatSettings,
        openSettingsPanel,
        restoreChatView,
        restoreBroadcastView,
        restoreMomentsView,
        handleChatDetails,
        updateChatName,
        kickMember,
        setDoNotDisturb,
        refreshChats,
        setFriends,
        handleUnreadCount,
        openMoments,
        switchToChats,
        viewUserMoments,
        setReplyingTo,
        clearReplyingTo
    };
});


