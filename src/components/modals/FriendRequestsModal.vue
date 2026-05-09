<template>
    <Teleport to="body">
        <div v-if="uiStore.showFriendRequestsModal" class="modal" @click.self="close">
            <div class="modal-content">
                <h3>Friend Requests</h3>
                <div class="requests-list">
                    <div v-if="loading" class="loading">Loading...</div>
                    <div v-else-if="chatStore.friendRequests.length === 0" class="empty">No pending friend requests</div>
                    <div v-for="request in chatStore.friendRequests" :key="request.id" class="request-item">
                        <div class="request-info">
                            <img :src="getAvatarUrl(request.fromUser)" class="request-avatar" alt="avatar" loading="lazy" />
                            <div class="request-details">
                                <span class="request-name">{{ request.fromNickname || request.fromUsername }}</span>
                                <span v-if="request.fromNickname && request.fromNickname !== request.fromUsername" class="request-username">@{{ request.fromUsername }}</span>
                                <span v-if="request.message" class="request-message">{{ request.message }}</span>
                                <span class="request-time">{{ formatDate(request.createdAt) }}</span>
                            </div>
                        </div>
                        <div class="request-actions">
                            <button class="button accept" @click="acceptRequest(request.id)">Accept</button>
                            <button class="button reject" @click="rejectRequest(request.id)">Reject</button>
                        </div>
                    </div>
                </div>
                <button class="button cancel" @click="close">Close</button>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useUIStore, useChatStore } from '@/stores';
import { getAvatarUrl } from '@/utils/helpers';

const uiStore = useUIStore();
const chatStore = useChatStore();
const loading = ref(true);

function formatDate(dateStr: string): string
{
    try
    {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    catch
    {
        return dateStr;
    }
}

function acceptRequest(requestId: number)
{
    chatStore.acceptFriendRequest(requestId);
}

function rejectRequest(requestId: number)
{
    chatStore.rejectFriendRequest(requestId);
    // Remove from local list immediately
    chatStore.friendRequests = chatStore.friendRequests.filter(r => r.id !== requestId);
}

function close()
{
    uiStore.showFriendRequestsModal = false;
}

// Load friend requests when modal opens
watch(() => uiStore.showFriendRequestsModal, (show) =>
{
    if (show)
    {
        loading.value = true;
        chatStore.getFriendRequests();
    }
});

// Watch for loaded data
watch(() => chatStore.friendRequests, () =>
{
    loading.value = false;
}, { deep: true });

// Register handler for the requests list response
onMounted(() =>
{
    // Requests are already handled in App.vue via wsService.on('friend_requests_list')
});

onUnmounted(() =>
{
});
</script>

<style scoped>
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
    display: flex;
    justify-content: center;
    align-items: center;
}

.modal-content {
    background: var(--panel-bg);
    padding: 20px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    width: 400px;
    max-height: 80%;
    display: flex;
    flex-direction: column;
}

.modal-content h3 {
    margin-top: 0;
    color: var(--primary-color);
}

.requests-list {
    flex: 1;
    overflow-y: auto;
    margin: 15px 0;
    max-height: 400px;
}

.loading,
.empty {
    padding: 20px;
    text-align: center;
    color: var(--secondary-color);
}

.request-item {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.request-item:last-child {
    border-bottom: none;
}

.request-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
}

.request-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
}

.request-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.request-name {
    font-weight: bold;
    color: var(--text-color);
}

.request-username {
    font-size: 0.8em;
    color: var(--secondary-color);
}

.request-message {
    font-size: 0.85em;
    color: var(--text-color);
    font-style: italic;
}

.request-time {
    font-size: 0.75em;
    color: var(--secondary-color);
}

.request-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
}

.button {
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    font-size: 0.8em;
}

.button.accept {
    background-color: var(--primary-color);
    color: white;
}

.button.accept:hover {
    opacity: 0.9;
}

.button.reject {
    background-color: transparent;
    color: var(--text-color);
    border: 1px solid var(--border-color);
}

.button.cancel {
    background-color: transparent;
    color: var(--text-color);
    border: 1px solid var(--border-color);
    width: 100%;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
}
</style>
