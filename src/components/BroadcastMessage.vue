<template>
    <div :class="['broadcast-message', broadcastClass]">
        <div class="header">
            <img v-if="showAvatar" :src="getAvatarUrl(broadcast.senderId!)" class="broadcast-avatar" alt="avatar" loading="lazy" @click="handleSenderClick" />
            <div :class="['broadcast-sender', senderClass]" :style="{ cursor: isClickable ? 'pointer' : 'default' }" @click="handleSenderClick">
                {{ senderDisplay }}
            </div>
        </div>
        <div class="broadcast-content">{{ broadcast.content }}</div>
        <div class="broadcast-time">{{ formatDate(broadcast.time) }}</div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Broadcast } from '@/types';
import { useUserStore, useChatStore } from '@/stores';
import { getAvatarUrl, formatDate, getUserId } from '@/utils/helpers';

const props = defineProps<{
    broadcast: Broadcast;
}>();

const userStore = useUserStore();
const chatStore = useChatStore();

const isMyBroadcast = computed(() =>
{
    if (!userStore.currentUser) return false;
    return props.broadcast.senderId === getUserId(userStore.currentUser.id);
});

const isSystem = computed(() => props.broadcast.system);
const isAnonymous = computed(() => !props.broadcast.system && !props.broadcast.senderId);

const broadcastClass = computed(() =>
{
    if (isSystem.value) return 'system-broadcast';
    if (isMyBroadcast.value) return 'my-broadcast';
    if (isAnonymous.value) return 'anonymous-broadcast';
    return 'user-broadcast';
});

const senderClass = computed(() =>
{
    if (isSystem.value) return 'system';
    if (isMyBroadcast.value) return 'me';
    if (isAnonymous.value) return 'anonymous';
    return 'user';
});

const senderDisplay = computed(() =>
{
    if (isSystem.value) return '📢 System Broadcast';
    if (isAnonymous.value) return '🎭 Anonymous User';
    if (isMyBroadcast.value) return userStore.currentUser?.username || 'Me';
    return props.broadcast.senderName || 'Unknown';
});

const showAvatar = computed(() =>
{
    return !isSystem.value && !isAnonymous.value && props.broadcast.senderId;
});

const isClickable = computed(() =>
{
    return !isSystem.value && !isAnonymous.value && !isMyBroadcast.value;
});

function handleSenderClick()
{
    if (isClickable.value && props.broadcast.senderName)
    {
        chatStore.addFriend(props.broadcast.senderName);
    }
}
</script>

<style scoped>
.broadcast-message {
    padding: 6px;
    margin: 3px 0;
    border-radius: 10px;
    border-left: 4px solid;
    background-color: var(--panel-bg);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.broadcast-message.system-broadcast {
    border-left-color: #ff6b6b;
    background: linear-gradient(to right, rgba(255, 107, 107, 0.1), var(--panel-bg));
}

.broadcast-message.my-broadcast {
    border-left-color: #4c6ef5;
    background: linear-gradient(to right, rgba(76, 110, 245, 0.1), var(--panel-bg));
}

.broadcast-message.anonymous-broadcast {
    border-left-color: #868e96;
    background: linear-gradient(to right, rgba(134, 142, 150, 0.1), var(--panel-bg));
}

.broadcast-message.user-broadcast {
    border-left-color: #20c997;
    background: linear-gradient(to right, rgba(32, 201, 151, 0.1), var(--panel-bg));
}

.header {
    display: flex;
    align-items: center;
}

.broadcast-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    margin-right: 10px;
    object-fit: cover;
    cursor: pointer;
}

.broadcast-sender {
    font-weight: 600;
    margin: auto 0;
    font-size: 0.9em;
}

.broadcast-sender.system {
    color: #ff6b6b;
}

.broadcast-sender.me {
    color: #4c6ef5;
}

.broadcast-sender.anonymous {
    color: #868e96;
}

.broadcast-sender.user {
    color: #20c997;
}

.broadcast-content {
    border-radius: 8px;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
    line-height: 1.5;
    white-space: pre-wrap;
}

.broadcast-time {
    font-size: 0.7em;
    opacity: 0.7;
    text-align: right;
}
</style>
