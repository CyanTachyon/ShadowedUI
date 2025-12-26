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
                <MessageBubble v-for="message in chatStore.currentChatMessages" :key="message.id" :message="message" />
                <div ref="loadTriggerRef" class="load-trigger"> {{ chatStore.hasMoreMessages ? 'Loading more messages...' : 'No more messages' }} </div>
            </template>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useChatStore } from '@/stores';
import MessageBubble from './MessageBubble.vue';
import BroadcastMessage from './BroadcastMessage.vue';

const chatStore = useChatStore();

const containerRef = ref<HTMLElement | null>(null);
const loadTriggerRef = ref<HTMLElement | null>(null);
const broadcastTriggerRef = ref<HTMLElement | null>(null);

// 使用 store 中的 loading 状态
const loading = computed(() => chatStore.messagesLoading);

let messageObserver: IntersectionObserver | null = null;
let broadcastObserver: IntersectionObserver | null = null;

const reversedBroadcasts = computed(() => [...chatStore.currentBroadcasts].reverse());

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

// 监听消息加载触发器元素
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
}
</style>
