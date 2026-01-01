<template>
    <div class="user-profile-page">
        <div class="profile-content">
            <div class="profile-header-section">
                <div class="avatar-container">
                    <img v-if="userId" :src="getAvatarUrl(userId)" class="profile-avatar" alt="avatar" />
                </div>
                <div class="profile-info">
                    <h1 class="profile-username">{{ user?.username || 'Loading...' }}</h1>
                    <div v-if="user?.signature" class="profile-signature">{{ user.signature }}</div>
                    <div class="profile-user-id">ID: {{ userId }}</div>
                </div>
            </div>

            <div v-if="loading" class="profile-loading">
                <div class="loading-spinner"></div>
                <p>Loading profile...</p>
            </div>

            <div v-else-if="user" class="profile-details">
                <div class="detail-section">
                    <h2 class="section-title">About</h2>
                    <div v-if="user.signature" class="detail-item">
                        <span class="detail-label">Signature</span>
                        <span class="detail-value signature-text">{{ user.signature }}</span>
                    </div>
                    <div v-if="!user.signature" class="detail-item">
                        <span class="detail-value no-signature">This user hasn't set a signature yet.</span>
                    </div>
                </div>

                <!-- Moment Permission Section -->
                <div class="detail-section moment-section">
                    <h2 class="section-title">Moments</h2>
                    <div class="moment-controls">
                        <div class="moment-control-item">
                            <span class="control-label">Allow to view my moments</span>
                            <button class="toggle-btn" :class="{ active: momentPermission?.canFriendViewMine }" @click="toggleMomentPermission" :disabled="loadingPermission">
                                {{ momentPermission?.canFriendViewMine ? 'Yes' : 'No' }}
                            </button>
                        </div>
                        <button class="action-button full-width" :class="{ primary: momentPermission?.canIViewFriends, secondary: !momentPermission?.canIViewFriends }" @click="viewFriendMoments" :disabled="(!momentPermission?.canIViewFriends || loadingPermission) && userId !== userStore.userId">
                            <MessageIcon />
                            <span>View Their Moments</span>
                        </button>
                    </div>
                </div>

                <div class="action-section">
                    <button v-if="userId !== userStore.userId" class="action-button primary" @click="startChat">
                        <MessageIcon />
                        <span>Send Message</span>
                    </button>
                    <button class="action-button secondary" @click="goBack">
                        <ArrowLeftIcon />
                        <span>Back</span>
                    </button>
                </div>
            </div>

            <div v-else class="profile-error">
                <p>Failed to load user profile</p>
                <button class="action-button secondary" @click="goBack">
                    <ArrowLeftIcon />
                    <span>Back</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useChatStore, useUIStore, useUserStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { getAvatarUrl } from '@/utils/helpers';
import { fetchUserInfo } from '@/services/api';
import { encryptSymmetricKey, decryptSymmetricKey, importPublicKey } from '@/utils/crypto';
import type { MomentPermission } from '@/types';
import MessageIcon from './icons/MessageIcon.vue';
import ArrowLeftIcon from './icons/ArrowLeftIcon.vue';

const chatStore = useChatStore();
const uiStore = useUIStore();
const userStore = useUserStore();

const loading = ref(true);
const user = ref<{ id: number; username: string; signature: string | null; } | null>(null);
const momentPermission = ref<MomentPermission | null>(null);
const loadingPermission = ref(false);

const userId = computed(() => uiStore.profileUserId);

watch(() => uiStore.profileUserId, async (newUserId) =>
{
    if (newUserId)
    {
        await loadUserProfile(newUserId);
    }
});

watch(() => uiStore.viewState, (newState) =>
{
    if (newState !== 'profile')
    {
        uiStore.profileUserId = null;
        user.value = null;
    }
});

onMounted(async () =>
{
    if (userId.value)
    {
        await loadUserProfile(userId.value);
        loadMomentPermission();
    }

    // Register WebSocket handlers
    wsService.on('moment_permission_status', handleMomentPermissionStatus);
    wsService.on('moment_permission_updated', handleMomentPermissionUpdated);
});

onUnmounted(() =>
{
    // Clean up WebSocket handlers
    wsService.off('moment_permission_status', handleMomentPermissionStatus);
    wsService.off('moment_permission_updated', handleMomentPermissionUpdated);
});

async function loadUserProfile(targetUserId: number)
{
    loading.value = true;
    user.value = null;

    try
    {
        // Try to fetch from API first
        const userInfo = await fetchUserInfo(targetUserId);
        if (userInfo)
        {
            user.value = userInfo;
        }
        else
        {
            // Fallback to local data
            const username = getUsernameById(targetUserId);
            if (username)
            {
                user.value = { id: targetUserId, username, signature: null };
            }
            else
            {
                user.value = { id: targetUserId, username: `User ${targetUserId}`, signature: null };
            }
        }
        loading.value = false;
    }
    catch (error)
    {
        console.error('Failed to load user profile:', error);
        loading.value = false;
    }
}

function getUsernameById(targetUserId: number): string | null
{
    // Check if user is in current chat members
    const chat = chatStore.currentChat;
    if (chat && chat.isPrivate && chat.parsedOtherIds && chat.parsedOtherNames)
    {
        const idx = chat.parsedOtherIds.findIndex(id => id === targetUserId);
        if (idx >= 0)
        {
            return chat.parsedOtherNames[idx] || null;
        }
    }

    // Check current chat details
    if (chatStore.currentChatDetails)
    {
        const member = chatStore.currentChatDetails.members.find(m => m.id === targetUserId);
        if (member)
        {
            return member.username;
        }
    }

    // Check friends list
    const friend = chatStore.friends.find(f => f.id === targetUserId);
    if (friend)
    {
        return friend.username;
    }

    return null;
}

function startChat()
{
    if (!user.value) return;

    chatStore.addFriend(user.value.username);
}

// Moment permission functions
function loadMomentPermission()
{
    if (!userId.value) return;
    loadingPermission.value = true;
    wsService.sendPacket('get_moment_permission', {
        friendId: userId.value
    });
}

async function toggleMomentPermission()
{
    if (!userId.value || !momentPermission.value) return;

    const newState = !momentPermission.value.canFriendViewMine;

    // If disabling, just call toggle_moment_permission to remove member
    if (!newState)
    {
        loadingPermission.value = true;
        wsService.sendPacket('toggle_moment_permission', {
            friendId: userId.value,
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
            if (user.value)
            {
                wsService.sendPacket('get_public_key_by_username', { username: user.value.username });
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
            friendId: userId.value,
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
    if (!userId.value) return;
    chatStore.viewUserMoments(userId.value);
}

// WebSocket handlers
const handleMomentPermissionStatus = (data: MomentPermission) =>
{
    loadingPermission.value = false;
    if (data.friendId === userId.value)
    {
        momentPermission.value = data;
    }
};

const handleMomentPermissionUpdated = (data: { friendId: number; canView: boolean; }) =>
{
    loadingPermission.value = false;
    if (data.friendId === userId.value && momentPermission.value)
    {
        momentPermission.value.canFriendViewMine = data.canView;
    }
};

function goBack()
{
    uiStore.setViewState('chat');
}
</script>

<style scoped>
.user-profile-page {
    width: 100%;
    height: 100%;
    background-color: var(--bg-color);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
}

.profile-content {
    width: 100%;
    max-width: 600px;
    padding: 24px;
    margin: 0 auto;
}

.profile-header-section {
    text-align: center;
    margin-bottom: 32px;
}

.avatar-container {
    display: inline-block;
    margin-bottom: 16px;
}

.profile-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid var(--accent-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.profile-info {
    text-align: center;
}

.profile-username {
    margin: 0 0 8px 0;
    font-size: 28px;
    font-weight: 700;
    color: var(--text-color);
}

.profile-signature {
    font-size: 14px;
    color: var(--text-secondary);
    font-style: italic;
    line-height: 1.5;
}

.profile-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: var(--text-secondary);
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.profile-details {
    background-color: var(--panel-bg);
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

.detail-section {
    padding: 24px;
    border-bottom: 1px solid var(--border-color);
}

.section-title {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.detail-item {
    display: flex;
    flex-direction: column;
    margin-bottom: 16px;
}

.detail-item:last-child {
    margin-bottom: 0;
}

.detail-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 4px;
    text-transform: uppercase;
}

.detail-value {
    font-size: 15px;
    color: var(--text-color);
    word-break: break-word;
}

.signature-text {
    font-style: italic;
    line-height: 1.6;
}

.no-signature {
    font-style: italic;
    color: var(--text-secondary);
    font-size: 14px;
}

.action-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 24px;
}

.action-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 24px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    outline: none;
    position: relative;
    overflow: hidden;
}

.action-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%);
    opacity: 0;
    transition: opacity 0.2s;
}

.action-button:hover::before {
    opacity: 1;
}

.action-button.primary {
    background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-button.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.action-button.primary:active {
    transform: translateY(0);
}

.action-button.secondary {
    background-color: transparent;
    color: var(--text-color);
    border: 1px solid var(--border-color);
}

.action-button.secondary:hover {
    background-color: var(--hover-bg);
    border-color: var(--text-secondary);
}

.profile-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: var(--text-secondary);
}

.profile-error p {
    margin: 0 0 16px 0;
}

/* Moment Permission Styles */
.moment-section {
    border-bottom: none;
}

.moment-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.moment-control-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background-color: var(--bg-color);
    border-radius: 8px;
}

.control-label {
    font-size: 14px;
    color: var(--text-color);
}

.toggle-btn {
    padding: 8px 16px;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
}

.toggle-btn:hover:not(:disabled) {
    border-color: var(--accent-color);
    color: var(--text-color);
}

.toggle-btn.active {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
}

.toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.action-button.full-width {
    width: 100%;
}

.action-button.full-width:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--bg-color) !important;
    color: var(--text-secondary) !important;
    border: 1px solid var(--border-color) !important;
    box-shadow: none !important;
}

.action-button.full-width:disabled::before {
    display: none;
}
</style>
