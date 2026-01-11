<template>
    <div id="chat-settings-panel">
        <div class="settings-header">
            <span>Chat Info</span>
            <button class="close-btn" @click="chatStore.toggleChatSettings()">
                <CloseIcon />
            </button>
        </div>
        <div class="settings-content" v-if="members.length">
            <!-- Group Avatar Section (Group only) -->
            <div v-if="!isPrivate && isOwner && chatId" class="settings-section">
                <div class="section-title">Group Avatar</div>
                <div class="group-avatar-wrapper">
                    <img :src="getGroupAvatarUrl(chatId)" class="group-avatar" alt="Group Avatar" />
                    <label for="group-avatar-upload" class="avatar-upload-label" title="Upload Group Avatar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                    </label>
                    <input id="group-avatar-upload" ref="groupAvatarInput" type="file" accept="image/*" style="display: none" @change="uploadGroupAvatar" />
                </div>
            </div>

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
                        <div class="member-avatar-wrapper">
                            <img :src="getAvatarUrl(member.id)" class="member-avatar" alt="avatar" @click="openUserProfile(member.id)" />
                            <DonorBadgeIcon v-if="member.isDonor" class="member-donor-badge" />
                        </div>
                        <span class="member-name" @click="openUserProfile(member.id)">
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

                <!-- Burn After Read Controls -->
                <div class="burn-after-read-controls">
                    <div class="section-title">Burn After Read</div>
                    <div class="burn-time-select">
                        <SelectDropdown
                            :options="burnTimeOptions"
                            v-model="selectedBurnTime"
                            placeholder="Off"
                            @update:modelValue="onBurnTimeChange"
                        />
                    </div>
                    <div class="burn-hint" v-if="currentBurnTime">
                        Messages will be deleted {{ formatBurnTime(currentBurnTime) }} after being read
                    </div>
                </div>

                <!-- Moment Permission Controls -->
                <div class="moment-controls">
                    <div class="moment-control-item">
                        <span>Allow to view my moments</span>
                        <button class="toggle-btn" :class="{ active: momentPermission?.canFriendViewMine }" @click="toggleMomentPermission" :disabled="loadingPermission">
                            {{ momentPermission?.canFriendViewMine ? 'Yes' : 'No' }}
                        </button>
                    </div>
                    <button class="button view-moments-btn" @click="viewFriendMoments" :disabled="!momentPermission?.canIViewFriends">
                        View Their Moments
                    </button>
                </div>

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
import { ref, computed, watch, onMounted } from 'vue';
import { useChatStore, useUserStore, useUIStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { getAvatarUrl, getGroupAvatarUrl, getUserId } from '@/utils/helpers';
import { uploadGroupAvatar as uploadGroupAvatarApi } from '@/services/api';
import
    {
        encryptSymmetricKey,
        decryptSymmetricKey,
        importPublicKey
    } from '@/utils/crypto';
import type { ChatMember, MomentPermission } from '@/types';
import CloseIcon from './icons/CloseIcon.vue';
import DonorBadgeIcon from './icons/DonorBadgeIcon.vue';
import SelectDropdown from './SelectDropdown/SelectDropdown.vue';

const chatStore = useChatStore();
const userStore = useUserStore();
const uiStore = useUIStore();

const groupAvatarInput = ref<HTMLInputElement | null>(null);
const newName = ref('');
const momentPermission = ref<MomentPermission | null>(null);
const loadingPermission = ref(false);
const selectedBurnTime = ref<number | null>(null);

// 阅后即焚时间选项
const burnTimeOptions = [
    { value: null, label: 'Off' },
    { value: 10000, label: '10 seconds' },
    { value: 30000, label: '30 seconds' },
    { value: 60000, label: '1 minute' },
    { value: 300000, label: '5 minutes' },
    { value: 3600000, label: '1 hour' },
];

const details = computed(() => chatStore.currentChatDetails);

const isPrivate = computed(() => details.value?.isPrivate ?? true);

// 当前聊天的阅后即焚时间
const currentBurnTime = computed(() =>
{
    if (!chatStore.currentChatId) return null;
    const chat = chatStore.chats.find(c => c.chatId === chatStore.currentChatId);
    return chat?.burnTime ?? null;
});

// 监听 currentBurnTime 变化来更新 select 值
watch(currentBurnTime, (newVal) =>
{
    selectedBurnTime.value = newVal;
}, { immediate: true });

// 格式化阅后即焚时间显示
function formatBurnTime(ms: number): string
{
    if (ms < 60000) return `${ms / 1000} seconds`;
    if (ms < 3600000) return `${ms / 60000} minute${ms >= 120000 ? 's' : ''}`;
    return `${ms / 3600000} hour${ms >= 7200000 ? 's' : ''}`;
}

// 阅后即焚时间变化处理
function onBurnTimeChange()
{
    chatStore.setBurnTime(selectedBurnTime.value);
}

const chatName = computed(() =>
{
    if (!details.value) return '';
    return details.value.name || `Chat ${details.value.id}`;
});

const members = computed(() => details.value?.members || []);

const chatId = computed(() => details.value?.id);

const ownerId = computed(() => details.value?.ownerId);

const myId = computed(() =>
{
    if (!userStore.currentUser) return null;
    return getUserId(userStore.currentUser.id);
});

const isOwner = computed(() => ownerId.value === myId.value);

const otherMemberId = computed(() =>
{
    if (!isPrivate.value) return null;
    const otherMember = members.value.find(m => m.id !== myId.value);
    return otherMember?.id || null;
});

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

function openUserProfile(userId: number)
{
    if (userId === myId.value) return;
    uiStore.navigateToProfile(userId);
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

async function uploadGroupAvatar(event: Event)
{
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !userStore.currentUser || !userStore.authToken || !chatId.value) return;

    try
    {
        await uploadGroupAvatarApi(file, chatId.value, userStore.currentUser.username, userStore.authToken);
        chatStore.showToast('Group avatar updated successfully', 'success');
        // Force refresh avatar image
        const avatarImg = document.querySelector('.group-avatar') as HTMLImageElement;
        if (avatarImg)
        {
            avatarImg.src = `${getGroupAvatarUrl(chatId.value)}?t=${Date.now()}`;
        }
    }
    catch (e)
    {
        console.error('Failed to upload group avatar:', e);
        chatStore.showToast('Failed to upload group avatar', 'error');
    }
    // Reset input
    input.value = '';
}

// Moment permission functions
function loadMomentPermission()
{
    if (!isPrivate.value || !otherMemberId.value) return;
    loadingPermission.value = true;
    wsService.sendPacket('get_moment_permission', {
        friendId: otherMemberId.value
    });
}

async function toggleMomentPermission()
{
    if (!otherMemberId.value || !momentPermission.value) return;

    const newState = !momentPermission.value.canFriendViewMine;

    // If disabling, just call toggle_moment_permission to remove member
    if (!newState)
    {
        loadingPermission.value = true;
        wsService.sendPacket('toggle_moment_permission', {
            friendId: otherMemberId.value,
            canView: false
        });
        return;
    }

    // If enabling, we need to:
    // 1. Get my moment key
    // 2. Get friend's public key
    // 3. Encrypt key with friend's public key
    // 4. Send get_moment_permission with encryptedKey

    try
    {
        loadingPermission.value = true;

        // Get my moment key
        const myMomentKeyResult = await new Promise<{ exists: boolean; key?: string; chatId?: number; }>((resolve, reject) =>
        {
            const handler = (data: any) =>
            {
                wsService.off('my_moment_key', handler);
                resolve(data);
            };
            wsService.on('my_moment_key', handler);
            wsService.sendPacket('get_my_moment_key', {});

            // 10 second timeout
            setTimeout(() =>
            {
                wsService.off('my_moment_key', handler);
                reject(new Error('Timeout getting moment key'));
            }, 10000);
        });

        // Handle case where moment chat doesn't exist yet
        if (!myMomentKeyResult.exists || !myMomentKeyResult.key)
        {
            // Need to create a new moment key
            const myPublicKey = await userStore.getMyPublicKey();
            if (!myPublicKey)
            {
                chatStore.showToast('Public key not available', 'error');
                loadingPermission.value = false;
                return;
            }

            // Generate a new symmetric key
            const key = await window.crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            // Encrypt it with my own public key
            const encryptedKey = await encryptSymmetricKey(key, myPublicKey);

            // Post first moment to create the chat
            wsService.sendPacket('post_moment', {
                content: '', // Empty content, just to create the chat
                type: 'TEXT',
                key: encryptedKey || null
            });

            // Wait a bit for the chat to be created, then retry
            setTimeout(() => toggleMomentPermission(), 1000);
            return;
        }

        // Decrypt my moment key
        if (!userStore.privateKey)
        {
            chatStore.showToast('Private key not available', 'error');
            loadingPermission.value = false;
            return;
        }

        const decryptedMomentKey = await decryptSymmetricKey(myMomentKeyResult.key, userStore.privateKey);
        if (!decryptedMomentKey)
        {
            chatStore.showToast('Failed to decrypt moment key', 'error');
            loadingPermission.value = false;
            return;
        }

        // Get friend's public key
        const friendPublicKey = await new Promise<string | null>((resolve, reject) =>
        {
            const handler = (data: any) =>
            {
                wsService.off('public_key_by_username', handler);
                resolve(data.publicKey || null);
            };
            wsService.on('public_key_by_username', handler);
            const otherMember = members.value.find(m => m.id === otherMemberId.value);
            if (otherMember)
            {
                wsService.sendPacket('get_public_key_by_username', { username: otherMember.username });
            } else
            {
                resolve(null);
            }

            // 10 second timeout
            setTimeout(() =>
            {
                wsService.off('public_key_by_username', handler);
                reject(new Error('Timeout getting public key'));
            }, 10000);
        });

        if (!friendPublicKey)
        {
            chatStore.showToast('Failed to get friend public key', 'error');
            loadingPermission.value = false;
            return;
        }

        // Encrypt moment key with friend's public key
        const encryptedFriendKey = await encryptSymmetricKey(decryptedMomentKey, await importPublicKey(friendPublicKey));

        // Send get_moment_permission with encryptedKey to add friend as viewer
        wsService.sendPacket('get_moment_permission', {
            friendId: otherMemberId.value,
            encryptedKey: encryptedFriendKey
        });

    } catch (e)
    {
        console.error('Failed to enable moment permission:', e);
        chatStore.showToast('Failed to enable moment permission', 'error');
        loadingPermission.value = false;
    }
}

function viewFriendMoments()
{
    if (!otherMemberId.value) return;
    chatStore.viewUserMoments(otherMemberId.value);
}

// Watch for details changes to load moment permission
watch(() => details.value, () =>
{
    if (isPrivate.value && otherMemberId.value)
    {
        loadMomentPermission();
    }
}, { immediate: true });

// Register WebSocket handlers
onMounted(() =>
{
    wsService.on('moment_permission_status', (data: MomentPermission) =>
    {
        loadingPermission.value = false;
        if (data.friendId === otherMemberId.value)
        {
            momentPermission.value = data;
        }
    });
    wsService.on('moment_permission_updated', (data: { friendId: number; canView: boolean; }) =>
    {
        loadingPermission.value = false;
        if (data.friendId === otherMemberId.value && momentPermission.value)
        {
            momentPermission.value.canFriendViewMine = data.canView;
        }
    });
});
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
    width: 35px;
    height: 35px;
    display: flex;
    justify-content: center;
    align-items: center;
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

.group-avatar-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
}

.group-avatar {
    width: 80px;
    height: 80px;
    border-radius: 10px;
    object-fit: cover;
    background-color: var(--border-color);
}

.avatar-upload-label {
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: 28px;
    height: 28px;
    background: var(--primary-color);
    border: 2px solid var(--panel-bg);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    transition: transform 0.2s;
}

.avatar-upload-label:hover {
    transform: scale(1.1);
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

.member-avatar-wrapper {
    position: relative;
    width: 32px;
    height: 32px;
}

.member-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    cursor: pointer;
}

.member-donor-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
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

.moment-controls {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid var(--border-color);
}

.burn-after-read-controls {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid var(--border-color);
}

.burn-after-read-controls .section-title {
    font-size: 0.8em;
    color: var(--secondary-color);
    text-transform: uppercase;
    margin-bottom: 10px;
}

.burn-time-select {
    margin-bottom: 8px;
}

.burn-hint {
    font-size: 0.8em;
    color: var(--secondary-color);
    font-style: italic;
}

.moment-control-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-size: 0.9em;
}

.toggle-btn {
    padding: 4px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--panel-bg);
    color: var(--text-color);
    cursor: pointer;
    font-size: 0.85em;
    transition: all 0.2s;
}

.toggle-btn.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
}

.toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.view-moments-btn {
    width: 100%;
    margin-top: 10px;
    background: var(--primary-color);
}

.view-moments-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
