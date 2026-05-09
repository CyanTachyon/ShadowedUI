<template>
    <Teleport to="body">
        <div v-if="uiStore.showGroupInvitationsModal" class="modal" @click.self="close">
            <div class="modal-content">
                <h3>Group Invitations</h3>
                <div class="invitations-list">
                    <div v-if="loading" class="loading">Loading...</div>
                    <div v-else-if="chatStore.groupInvitations.length === 0" class="empty">No pending group invitations</div>
                    <div v-for="invitation in chatStore.groupInvitations" :key="invitation.id" class="invitation-item">
                        <div class="invitation-info">
                            <div class="invitation-details">
                                <span class="invitation-chat">{{ invitation.chatName || 'Group Chat' }}</span>
                                <span class="invitation-desc">
                                    <strong>{{ invitation.inviterName }}</strong> invited
                                    <strong>{{ invitation.targetUsername }}</strong>
                                </span>
                                <span class="invitation-time">{{ formatDate(invitation.createdAt) }}</span>
                            </div>
                        </div>
                        <div class="invitation-actions">
                            <button class="button accept" @click="approveInvitation(invitation.id)">Approve</button>
                            <button class="button reject" @click="rejectInvitation(invitation.id)">Reject</button>
                        </div>
                    </div>
                </div>
                <button class="button cancel" @click="close">Close</button>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useUIStore, useChatStore } from '@/stores';

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

function approveInvitation(invitationId: number)
{
    chatStore.handleGroupInvitation(invitationId, true);
    // Remove from local list
    chatStore.groupInvitations = chatStore.groupInvitations.filter(i => i.id !== invitationId);
}

function rejectInvitation(invitationId: number)
{
    chatStore.handleGroupInvitation(invitationId, false);
    // Remove from local list
    chatStore.groupInvitations = chatStore.groupInvitations.filter(i => i.id !== invitationId);
}

function close()
{
    uiStore.showGroupInvitationsModal = false;
}

watch(() => uiStore.showGroupInvitationsModal, (show) =>
{
    if (show)
    {
        loading.value = true;
        chatStore.getGroupInvitations();
    }
});

watch(() => chatStore.groupInvitations, () =>
{
    loading.value = false;
}, { deep: true });
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

.invitations-list {
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

.invitation-item {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.invitation-item:last-child {
    border-bottom: none;
}

.invitation-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.invitation-chat {
    font-weight: bold;
    color: var(--text-color);
}

.invitation-desc {
    font-size: 0.85em;
    color: var(--text-color);
}

.invitation-desc strong {
    color: var(--primary-color);
}

.invitation-time {
    font-size: 0.75em;
    color: var(--secondary-color);
}

.invitation-actions {
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
