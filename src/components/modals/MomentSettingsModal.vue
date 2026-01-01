<template>
    <Teleport to="body">
        <div v-if="uiStore.showMomentSettingsModal" class="modal" @click.self="close">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Moments Privacy</h3>
                    <button class="close-btn" @click="close">
                        <CloseIcon />
                    </button>
                </div>

                <div class="section-title">Who can view your moments</div>
                <div class="friends-list">
                    <div v-if="loading" class="loading">Loading friends...</div>
                    <div v-else-if="chatStore.friends.length === 0" class="empty">
                        No friends found. Add someone first!
                    </div>
                    <div v-for="friend in chatStore.friends" :key="friend.id" class="friend-item" @click="togglePermission(friend)">
                        <img :src="getAvatarUrl(friend.id)" class="friend-avatar" alt="avatar" />
                        <span class="friend-name">{{ friend.username }}</span>
                        <button class="toggle-btn" :class="{ active: friend.canViewMoments }" :disabled="loadingPermission[friend.id]">
                            <span v-if="loadingPermission[friend.id]" class="loading-spinner"></span>
                            <span v-else>{{ friend.canViewMoments ? 'Visible' : 'Hidden' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useChatStore, useUserStore, useUIStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { getAvatarUrl } from '@/utils/helpers';
import
{
    encryptSymmetricKey,
    decryptSymmetricKey,
    importPublicKey
} from '@/utils/crypto';
import type { Friend } from '@/types';
import CloseIcon from '../icons/CloseIcon.vue';

const chatStore = useChatStore();
const userStore = useUserStore();
const uiStore = useUIStore();

const loading = ref(true);
const loadingPermission = ref<Record<number, boolean>>({});

watch(
    () => chatStore.friends,
    () =>
    {
        loading.value = false;
    }
);

watch(
    () => uiStore.showMomentSettingsModal,
    (show) =>
    {
        if (show)
        {
            loading.value = true;
            wsService.send('get_friends');
        }
    }
);

function close()
{
    uiStore.showMomentSettingsModal = false;
}

async function togglePermission(friend: Friend)
{
    const currentState = friend.canViewMoments ?? false;
    const newState = !currentState;

    if (loadingPermission.value[friend.id]) return;

    loadingPermission.value[friend.id] = true;

    // If disabling, just call toggle_moment_permission
    if (!newState)
    {
        wsService.sendPacket('toggle_moment_permission', {
            friendId: friend.id,
            canView: false
        });
        // Update local state immediately
        friend.canViewMoments = false;
        loadingPermission.value[friend.id] = false;
        return;
    }

    // If enabling, need to get and encrypt moment key
    try
    {
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
                loadingPermission.value[friend.id] = false;
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
            setTimeout(() => togglePermission(friend), 1000);
            return;
        }

        // Decrypt my moment key
        if (!userStore.privateKey)
        {
            chatStore.showToast('Private key not available', 'error');
            loadingPermission.value[friend.id] = false;
            return;
        }

        const decryptedMomentKey = await decryptSymmetricKey(myMomentKeyResult.key, userStore.privateKey);
        if (!decryptedMomentKey)
        {
            chatStore.showToast('Failed to decrypt moment key', 'error');
            loadingPermission.value[friend.id] = false;
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
            wsService.sendPacket('get_public_key_by_username', { username: friend.username });

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
            loadingPermission.value[friend.id] = false;
            return;
        }

        // Encrypt moment key with friend's public key
        const encryptedFriendKey = await encryptSymmetricKey(decryptedMomentKey, await importPublicKey(friendPublicKey));

        // Send get_moment_permission with encryptedKey to add friend as viewer
        wsService.sendPacket('get_moment_permission', {
            friendId: friend.id,
            encryptedKey: encryptedFriendKey
        });

        // Update local state
        friend.canViewMoments = true;
        loadingPermission.value[friend.id] = false;

    }
    catch (e: any)
    {
        console.error('Failed to toggle moment permission:', e);
        chatStore.showToast('Failed to update permission', 'error');
        loadingPermission.value[friend.id] = false;
    }
}
</script>

<style scoped>
.modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: var(--panel-bg);
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
}

.close-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
}

.close-btn:hover {
    background-color: var(--hover-bg);
    color: var(--text-color);
}

.section-title {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 12px;
    font-weight: 500;
}

.friends-list {
    flex: 1;
    overflow-y: auto;
    margin-top: 8px;
}

.loading, .empty {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
}

.friend-item {
    display: flex;
    align-items: center;
    padding: 12px;
    background-color: var(--bg-color);
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.friend-item:hover {
    background-color: var(--hover-bg);
}

.friend-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 12px;
    object-fit: cover;
}

.friend-name {
    flex: 1;
    font-size: 0.95rem;
    font-weight: 500;
}

.toggle-btn {
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid var(--border-color);
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-secondary);
    min-width: 80px;
}

.toggle-btn:not(:disabled):hover {
    background-color: var(--hover-bg);
}

.toggle-btn.active {
    background-color: #4c6ef5;
    color: white;
    border-color: #4c6ef5;
}

.toggle-btn.active:hover {
    background-color: #3b5bdb;
}

.toggle-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.loading-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 768px) {
    .modal-content {
        max-width: 95%;
        padding: 16px;
    }

    .friend-item {
        padding: 10px;
    }
}
</style>
