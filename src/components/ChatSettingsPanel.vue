<template>
    <div id="chat-settings-panel">
        <div class="settings-header">
            <span>Chat Info</span>
            <button class="close-btn" @click="chatStore.toggleChatSettings()">×</button>
        </div>
        <div class="settings-content" v-if="members.length">
            <!-- Chat Name Section (Group only) -->
            <div v-if="!isPrivate" class="settings-section">
                <div class="section-title">Chat Name</div>
                <div class="current-name">{{ chatName }}</div>
                <div class="rename-group">
                    <template v-if="isOwner">
                        <input v-model="newName" type="text" placeholder="New name" />
                        <button @click="renameChat">Rename</button>
                    </template>
                    <button class="do-not-disturb-btn" :class="{ active: chatStore.isDoNotDisturb }" @click="chatStore.setDoNotDisturb(!chatStore.isDoNotDisturb)">
                        {{ chatStore.isDoNotDisturb ? 'Disable' : 'Enable' }} Do Not Disturb
                    </button>
                    <button v-if="isOwner" class="leave-group-btn" @click="leaveGroup">Delete Group</button>
                    <button v-else class="leave-group-btn" @click="leaveGroup">Leave Group</button>
                </div>
            </div>

            <!-- Members Section -->
            <div class="settings-section">
                <div class="section-title" v-if="!isPrivate">Members ({{ members.length }})</div>

                <button v-if="!isPrivate" class="button invite-btn" @click="showInviteModal">
                    Invite Member
                </button>

                <div class="member-list">
                    <div v-for="member in members.filter(m => m.id !== myId || !isPrivate)" :key="member.id" class="member-item">
                        <img :src="getAvatarUrl(member.id)" class="member-avatar" alt="avatar" @click="startPrivateChat(member.username)" />
                        <span class="member-name" @click="startPrivateChat(member.username)">
                            {{ member.username }}
                            <span v-if="member.id === ownerId" class="owner-badge">(Owner)</span>
                            <span v-if="member.id === myId" class="me-badge">(Me)</span>
                        </span>
                        <button v-if="isOwner && member.id !== myId && !isPrivate" class="kick-member-btn" @click="kickMember(member)">
                            kick
                        </button>
                    </div>
                </div>
                <!-- Show other member's signature in private chat -->
                <div v-if="isPrivate && otherMemberSignature" class="signature-section">
                    <div class="signature-label">Signature</div>
                    <div class="signature-content">{{ otherMemberSignature }}</div>
                </div>
            </div>

            <div v-if="isPrivate" class="settings-section">
                <button class="button do-not-disturb-btn" :class="{ active: chatStore.isDoNotDisturb }" @click="chatStore.setDoNotDisturb(!chatStore.isDoNotDisturb)" style="width: 100%;">
                    {{ chatStore.isDoNotDisturb ? 'Disable' : 'Enable' }} Do Not Disturb
                </button>
                <button class="button delete-chat-btn" @click="deleteChat">
                    Delete Chat
                </button>
            </div>
        </div>
        <div v-else class="settings-content" style="display: flex; justify-content: center; align-items: center; height: 100%;">
            Loading...
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useChatStore, useUserStore, useUIStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { getAvatarUrl, getUserId } from '@/utils/helpers';
import type { ChatMember } from '@/types';

const chatStore = useChatStore();
const userStore = useUserStore();
const uiStore = useUIStore();

const newName = ref('');

const details = computed(() => chatStore.currentChatDetails);

const isPrivate = computed(() => details.value?.isPrivate ?? true);

const chatName = computed(() =>
{
    if (!details.value) return '';
    return details.value.name || `Chat ${details.value.id}`;
});

const members = computed(() => details.value?.members || []);

const ownerId = computed(() => details.value?.ownerId);

const myId = computed(() =>
{
    if (!userStore.currentUser) return null;
    return getUserId(userStore.currentUser.id);
});

const isOwner = computed(() => ownerId.value === myId.value);

const otherMemberSignature = computed(() =>
{
    if (!isPrivate.value) return null;
    const otherMember = members.value.find(m => m.id !== myId.value);
    return otherMember?.signature || null;
});

function renameChat()
{
    if (!newName.value.trim()) return;
    chatStore.updateChatName(newName.value.trim());
    newName.value = '';
}

function leaveGroup()
{
    if (!details.value || !userStore.currentUser) return;
    if (!isOwner.value) uiStore.openKickMemberModal(
        details.value.id,
        chatName.value,
        myId.value!,
        userStore.currentUser.username
    );
    else uiStore.openDeleteChatModal(
        details.value.id,
        myId.value!,
        chatName.value,
        true
    );
}

function showInviteModal()
{
    chatStore.invitingToChat = true;
    uiStore.showCreateGroupModal = true;
    wsService.send('get_friends');
}

function startPrivateChat(username: string)
{
    if (username === userStore.currentUser?.username) return;
    chatStore.addFriend(username);
}

function kickMember(member: ChatMember)
{
    if (!details.value) return;
    uiStore.openKickMemberModal(
        details.value.id,
        chatName.value,
        member.id,
        member.username
    );
}

function deleteChat()
{
    if (!details.value || !isPrivate.value) return;
    // 找到对方的用户信息（不是我自己的那个成员）
    const otherMember = members.value.find(m => m.id !== myId.value);
    if (!otherMember) return;
    
    uiStore.openDeleteChatModal(
        details.value.id,
        otherMember.id,
        otherMember.username,
        false
    );
}
</script>

<style scoped>
#chat-settings-panel {
    width: 250px;
    background: var(--panel-bg);
    border-left: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    animation: slideInRight 0.3s ease;
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
    }

    to {
        transform: translateX(0);
    }
}

.settings-header {
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.close-btn {
    background: none;
    border: 1px solid var(--border-color);
    color: var(--text-color);
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1.2em;
}

.settings-content {
    flex: 1;
    overflow-y: auto;
}

.settings-section {
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
}

.section-title {
    font-size: 0.8em;
    color: var(--secondary-color);
    text-transform: uppercase;
    margin-bottom: 10px;
}

.current-name {
    font-weight: bold;
    margin-bottom: 5px;
}

.rename-group {
    display: flex;
    gap: 5px;
    margin-top: 5px;
    flex-flow: column;
}

.rename-group input {
    flex: 1;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    padding: 4px 8px;
    border-radius: 4px;
}

.rename-group button {
    background: var(--primary-color);
    border: 1px solid var(--border-color);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
}

.rename-group .leave-group-btn {
    background: #f85149;
}

.do-not-disturb-btn {
    background: var(--panel-bg) !important;
    border: 1px solid var(--border-color) !important;
    color: var(--text-color) !important;
}

.do-not-disturb-btn.active {
    background: var(--primary-color) !important;
    color: white !important;
}

.button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
}

.invite-btn {
    width: 100%;
    margin-bottom: 10px;
}

.member-list {
    display: flex;
    flex-direction: column;
}

.member-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    font-size: 0.9em;
}

.member-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    cursor: pointer;
}

.member-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
}

.member-name:hover {
    color: var(--primary-color);
}

.owner-badge {
    color: var(--primary-color);
    font-size: 0.8em;
}

.me-badge {
    color: var(--secondary-color);
    font-size: 0.8em;
}

.kick-member-btn {
    background: #f85149;
    border: none;
    color: white;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
}

.delete-chat-btn {
    width: 100%;
    background: #e74c3c;
    margin-top: 10px;
}

.delete-chat-btn:hover {
    background: #c0392b;
}

.signature-section {
    margin-top: 15px;
    padding-top: 10px;
    border-top: 1px solid var(--border-color);
}

.signature-label {
    font-size: 0.8em;
    color: var(--secondary-color);
    text-transform: uppercase;
    margin-bottom: 5px;
}

.signature-content {
    font-size: 0.9em;
    color: var(--text-color);
    font-style: italic;
    word-break: break-word;
}

@media (max-width: 768px) {
    #chat-settings-panel {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 20;
        background-color: var(--panel-bg);
    }
}
</style>
