<template>
    <div ref="containerRef" class="messages">
        <template v-if="chatStore.isBroadcastView">
            <div v-if="chatStore.currentBroadcasts.length === 0" class="placeholder">
                No broadcasts yet
            </div>
            <template v-else>
                <BroadcastMessage v-for="broadcast in reversedBroadcasts" :key="broadcast.id" :broadcast="broadcast" />
                <div ref="broadcastTriggerRef" class="load-trigger"> {{ chatStore.hasMoreBroadcasts ? 'Loading more broadcasts...' : 'No more broadcasts' }}</div>
            </template>
        </template>
        <template v-else>
            <div v-if="chatStore.currentChatMessages.length === 0 && chatStore.currentChatId" class="placeholder">
                {{ loading ? 'Loading messages...' : 'No messages yet. Start the conversation!' }}
            </div>
            <div v-else-if="!chatStore.currentChatId" class="placeholder">
                Select a chat to start messaging
            </div>
            <template v-else>
                <MessageBubble 
                    v-for="message in chatStore.currentChatMessages.filter(msg => msg.chatId === chatStore.currentChatId)" 
                    :key="message.id" 
                    :message="message"
                    :data-message-id="message.id"
                    :data-sender-id="message.senderId"
                    :data-read-at="message.readAt ?? ''"
                />
                <div ref="loadTriggerRef" class="load-trigger"> {{ chatStore.hasMoreMessages ? 'Loading more messages...' : 'No more messages' }} </div>
            </template>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useChatStore, useUserStore } from '@/stores';
import { getUserId, isPageInForeground } from '@/utils/helpers';
import MessageBubble from './MessageBubble.vue';
import BroadcastMessage from './BroadcastMessage.vue';

const chatStore = useChatStore();
const userStore = useUserStore();

const containerRef = ref<HTMLElement | null>(null);
const loadTriggerRef = ref<HTMLElement | null>(null);
const broadcastTriggerRef = ref<HTMLElement | null>(null);

// 使用 store 中的 loading 状态
const loading = computed(() => chatStore.messagesLoading);

let messageObserver: IntersectionObserver | null = null;
let broadcastObserver: IntersectionObserver | null = null;
let readObserver: IntersectionObserver | null = null;

const reversedBroadcasts = computed(() => [...chatStore.currentBroadcasts].reverse());

// 监听页面可见性，页面不可见时停止标记已读
let isPageVisible = isPageInForeground();

// 检测是否在底部（column-reverse 模式下，scrollTop 接近 0 表示在底部）
function isAtBottom(): boolean
{
    if (!containerRef.value) return false;
    return Math.abs(containerRef.value.scrollTop) < 50; // 允许 50px 的误差
}

// 滚动到底部
function scrollToBottom(): void
{
    if (containerRef.value)
    {
        containerRef.value.scrollTop = 0;
    }
}

// 监听页面可见性变化
function handleVisibilityChange(): void
{
    const wasVisible = isPageVisible;
    isPageVisible = isPageInForeground();
    
    // 如果页面从不可见变为可见，检查并标记可见消息已读
    if (!wasVisible && isPageVisible)
    {
        checkAndMarkVisibleMessages();
    }
}

// 检查当前可见的消息并标记已读
function checkAndMarkVisibleMessages(): void
{
    if (!containerRef.value || !isPrivateChat.value) return;
    
    const messageElements = containerRef.value.querySelectorAll('[data-message-id]');
    const containerRect = containerRef.value.getBoundingClientRect();
    
    messageElements.forEach(el =>
    {
        const htmlEl = el as HTMLElement;
        const rect = el.getBoundingClientRect();
        
        // 检查元素是否在容器可视区域内（带20px边距）
        const isVisible = rect.bottom >= containerRect.top - 20 && rect.top <= containerRect.bottom + 20;
        
        if (!isVisible) return;
        
        const messageId = parseInt(htmlEl.dataset.messageId || '0', 10);
        const senderId = parseInt(htmlEl.dataset.senderId || '0', 10);
        const readAt = htmlEl.dataset.readAt;
        
        // 只有对方发送的消息且未读时才标记
        if (messageId > 0 && senderId !== currentUserId.value && !readAt)
        {
            chatStore.markMessageRead(messageId);
        }
    });
}

// 监听 visibilitychange 事件
onMounted(() =>
{
    // 初始化页面可见状态
    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);
    
    setupReadObserver();
});

onUnmounted(() =>
{
    // 清理页面可见性监听
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleVisibilityChange);
    window.removeEventListener('blur', handleVisibilityChange);
    
    if (messageObserver)
    {
        messageObserver.disconnect();
    }
    if (broadcastObserver)
    {
        broadcastObserver.disconnect();
    }
    if (readObserver)
    {
        readObserver.disconnect();
    }
});
watch(loadTriggerRef, (el) =>
{
    if (messageObserver)
    {
        messageObserver.disconnect();
    }

    if (el && containerRef.value)
    {
        messageObserver = new IntersectionObserver(
            (entries) =>
            {
                if (entries[0].isIntersecting && chatStore.hasMoreMessages)
                {
                    chatStore.loadMoreMessages();
                }
            },
            {
                root: containerRef.value,
                threshold: 0,
                rootMargin: '100px'
            }
        );
        messageObserver.observe(el);
    }
});

// 监听广播加载触发器元素
watch(broadcastTriggerRef, (el) =>
{
    if (broadcastObserver)
    {
        broadcastObserver.disconnect();
    }

    if (el && containerRef.value)
    {
        broadcastObserver = new IntersectionObserver(
            (entries) =>
            {
                if (entries[0].isIntersecting && chatStore.hasMoreBroadcasts)
                {
                    chatStore.loadMoreBroadcasts();
                }
            },
            {
                root: containerRef.value,
                threshold: 0,
                rootMargin: '100px'
            }
        );
        broadcastObserver.observe(el);
    }
});

// 监听广播列表变化，如果在底部则自动滚动到底部
watch(() => chatStore.currentBroadcasts.length, (newLength, oldLength) =>
{
    if (chatStore.isBroadcastView && newLength > oldLength && isAtBottom())
    {
        // 使用 nextTick 确保 DOM 更新后再滚动
        setTimeout(() => scrollToBottom(), 0);
    }
});

// 监听消息列表变化，如果在底部则自动滚动到底部
watch(() => chatStore.currentChatMessages.length, (newLength, oldLength) =>
{
    if (!chatStore.isBroadcastView && newLength > oldLength && isAtBottom())
    {
        // 使用 setTimeout 确保 DOM 更新后再滚动
        setTimeout(() => scrollToBottom(), 0);
    }
});

// 当前聊天是否是私聊
const isPrivateChat = computed(() =>
{
    if (!chatStore.currentChatId) return false;
    const chat = chatStore.chats.find(c => c.chatId === chatStore.currentChatId);
    return chat?.isPrivate || false;
});

// 当前用户ID
const currentUserId = computed(() =>
{
    if (!userStore.currentUser) return null;
    return getUserId(userStore.currentUser.id);
});

// 设置阅后即焚消息的可见性检测
function setupReadObserver()
{
    if (readObserver)
    {
        readObserver.disconnect();
    }

    if (!containerRef.value || !isPrivateChat.value) return;

    readObserver = new IntersectionObserver(
        (entries) =>
        {
            for (const entry of entries)
            {
                if (!entry.isIntersecting) continue;

                const el = entry.target as HTMLElement;
                const messageId = parseInt(el.dataset.messageId || '0', 10);
                const senderId = parseInt(el.dataset.senderId || '0', 10);
                const readAt = el.dataset.readAt;

                // 只有页面可见时才标记已读
                if (!isPageVisible) return;

                // 只有对方发送的消息且未读时才标记
                if (messageId > 0 && senderId !== currentUserId.value && !readAt)
                {
                    chatStore.markMessageRead(messageId);
                }
            }
        },
        {
            root: containerRef.value,
            threshold: 0,
            rootMargin: '20px',
        }
    );

    // 观察所有消息元素
    observeMessageElements();
}

// 观察当前容器中的所有消息元素
function observeMessageElements()
{
    if (!readObserver || !containerRef.value) return;

    const messageElements = containerRef.value.querySelectorAll('[data-message-id]');
    messageElements.forEach(el =>
    {
        readObserver!.observe(el);
    });
}

// 当聊天切换时，清除已读标记记录
watch(() => chatStore.currentChatId, () =>
{
    setupReadObserver();
});

// 当消息列表变化时，重新设置观察器
watch(() => chatStore.currentChatMessages, () =>
{
    if (isPrivateChat.value)
    {
        // 延迟确保DOM更新
        setTimeout(() => observeMessageElements(), 100);
    }
}, { deep: true });

// 当聊天列表变化时（可能是burnTime变化），重新设置观察器
watch(() => chatStore.chats, () =>
{
    setupReadObserver();
}, { deep: true });

onMounted(() =>
{
    setupReadObserver();
});

onUnmounted(() =>
{
    if (messageObserver)
    {
        messageObserver.disconnect();
    }
    if (broadcastObserver)
    {
        broadcastObserver.disconnect();
    }
    if (readObserver)
    {
        readObserver.disconnect();
    }
});
</script>

<style scoped>
.messages {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
}

.placeholder {
    padding: 20px;
    text-align: center;
    color: var(--secondary-color);
    margin: auto;
}

.load-trigger {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 3px;
    opacity: 0.5;
}
</style>
