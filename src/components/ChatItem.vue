<template>
    <div :class="['friend-item', { active: isActive }]" @click="$emit('select')">
        <!-- Icon -->
        <div class="chat-icon-container unread-parent">
            <template v-if="isGroup">
                <div class="chat-icon">
                    <svg class="group-icon-svg" viewBox="0 0 24 24">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                </div>
            </template>
            <template v-else>
                <div class="user-avatar-wrapper">
                    <img v-if="otherId" :src="getAvatarUrl(otherId)" class="user-avatar" alt="avatar" loading="lazy" @error="handleImageError" />
                    <DonorBadgeIcon v-if="otherId && chat.otherUserIsDonor" class="donor-badge" />
                </div>
            </template>
            <div v-if="unreadCount > 0" class="unread-badge" :class="{ 'do-not-disturb': doNotDisturb }">
                {{ unreadCount > 99 ? '…' : unreadCount }}
            </div>
            <div v-else-if="unreadCount < 0" class="unread-badge at-badge">
                @
            </div>
        </div>

        <!-- Info -->
        <div class="chat-info">
            <span class="name">{{ displayName }}</span>
            <span class="status">{{ statusText }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Chat } from '@/types';
import { getAvatarUrl } from '@/utils/helpers';
import { useUserStore } from '@/stores';
import DonorBadgeIcon from './icons/DonorBadgeIcon.vue';

const props = defineProps<{
    chat: Chat;
    isActive: boolean;
}>();

defineEmits<{
    select: [];
}>();

const userStore = useUserStore();

const isGroup = computed(() => !props.chat.isPrivate);

const displayName = computed(() => props.chat.name || 'Chat ' + props.chat.chatId);

const otherId = computed(() =>
{
    // For private chats, find the other user (not the current user)
    if (props.chat.isPrivate && props.chat.members && userStore.currentUser)
    {
        const myUserId = typeof userStore.currentUser.id === 'object'
            ? userStore.currentUser.id.value
            : userStore.currentUser.id;
        const otherMember = props.chat.members.find(m => m.id !== myUserId);
        return otherMember?.id || null;
    }
    return null;
});

const unreadCount = computed(() => props.chat.unreadCount || 0);
const doNotDisturb = computed(() => props.chat.doNotDisturb || false);

const statusText = computed(() =>
{
    if (isGroup.value)
    {
        const memberCount = props.chat.members?.length || 0;
        return `${memberCount} members`;
    }
    return 'Private chat';
});

function handleImageError(e: Event)
{
    const img = e.target as HTMLImageElement;
    img.style.display = 'none';
}
</script>

<style scoped>
.friend-item {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
}

.friend-item:hover,
.friend-item.active {
    background-color: rgba(88, 166, 255, 0.1);
}

.chat-icon-container {
    position: relative;
    margin-right: 12px;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
}

.chat-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--border-color);
    border-radius: 10px;
}

.group-icon-svg {
    width: 24px;
    height: 24px;
    fill: var(--primary-color);
}

.user-avatar-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
}

.user-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    background-color: var(--border-color);
}

.donor-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 18px;
    height: 18px;
}

.unread-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background-color: #ff3b30;
    color: white;
    width: 18px;
    height: 18px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: bold;
    border: 2px solid var(--panel-bg);
    box-sizing: content-box;
    z-index: 10;
}

.unread-badge.do-not-disturb {
    background-color: var(--secondary-color);
}

.unread-badge.at-badge {
    background-color: #ff3b30;
    color: white;
    font-weight: bold;
    font-size: 16px;
}

.chat-info {
    flex: 1;
    overflow: hidden;
}

.name {
    font-weight: bold;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.status {
    font-size: 0.8em;
    color: var(--secondary-color);
}
</style>
