<template>
    <div class="moments-view">
        <div class="moments-header">
            <h3>Moments</h3>
            <button class="post-moment-btn" @click="showPostModal = true">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>
        </div>

        <div v-if="loading" class="loading">Loading moments...</div>
        <div v-else-if="moments.length === 0" class="empty">
            <p>No moments yet</p>
            <p class="hint">Post your first moment or add friends to see theirs!</p>
        </div>
        <div v-else class="moments-list">
            <div v-for="moment in moments" :key="moment.messageId" class="moment-item">
                <div class="moment-header">
                    <img :src="getAvatarUrl(moment.ownerId)" class="avatar" alt="avatar" />
                    <div class="moment-info">
                        <span class="owner-name">{{ moment.ownerName }}</span>
                        <span class="moment-time">{{ formatTime(moment.time) }}</span>
                    </div>
                </div>
                <div class="moment-content">
                    <template v-if="moment.type === 'TEXT'">
                        <p class="text-content">{{ moment.decryptedContent || 'Decrypting...' }}</p>
                    </template>
                    <template v-else-if="moment.type === 'IMAGE'">
                        <img v-if="moment.imageUrl" :src="moment.imageUrl" class="moment-image" alt="moment image" />
                        <p v-else class="text-content">Loading image...</p>
                    </template>
                </div>
            </div>
            <button v-if="hasMore" class="load-more-btn" @click="loadMoreMoments">
                Load More
            </button>
        </div>

        <!-- Post Moment Modal -->
        <div v-if="showPostModal" class="modal-overlay" @click.self="showPostModal = false">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Post a Moment</h3>
                    <button class="close-btn" @click="showPostModal = false">×</button>
                </div>
                <div class="modal-body">
                    <textarea v-model="newMomentText" placeholder="What's on your mind?" rows="4"></textarea>
                    <div class="modal-actions">
                        <button class="cancel-btn" @click="showPostModal = false">Cancel</button>
                        <button class="post-btn" @click="postMoment" :disabled="!newMomentText.trim()">Post</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useChatStore, useUserStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { getAvatarUrl } from '@/utils/helpers';
import
    {
        decryptSymmetricKey,
        decryptMessageString,
        generateSymmetricKey,
        encryptSymmetricKey,
        encryptMessageString
    } from '@/utils/crypto';
import type { Moment } from '@/types';

interface DecryptedMoment extends Moment
{
    decryptedContent?: string;
    imageUrl?: string;
}

const chatStore = useChatStore();
const userStore = useUserStore();

const moments = ref<DecryptedMoment[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const showPostModal = ref(false);
const newMomentText = ref('');
const currentOffset = ref(0);

// Cache for decrypted keys
const keyCache = new Map<string, CryptoKey>();

async function getDecryptedKey(encryptedKey: string): Promise<CryptoKey | null>
{
    if (keyCache.has(encryptedKey))
    {
        return keyCache.get(encryptedKey)!;
    }

    if (!userStore.privateKey) return null;

    const key = await decryptSymmetricKey(encryptedKey, userStore.privateKey);
    if (key)
    {
        keyCache.set(encryptedKey, key);
    }
    return key;
}

async function decryptMoment(moment: Moment): Promise<DecryptedMoment>
{
    const result: DecryptedMoment = { ...moment };

    try
    {
        const key = await getDecryptedKey(moment.key);
        if (!key) return result;

        if (moment.type === 'TEXT')
        {
            result.decryptedContent = await decryptMessageString(moment.content, key);
        }
        else if (moment.type === 'IMAGE')
        {
            // For images, the content might be a URL or need special handling
            // Similar to how regular messages handle images
            result.decryptedContent = '[Image]';
            // You might need to fetch and decrypt the image data
        }
    } 
    catch (e)
    {
        console.error('Failed to decrypt moment:', e);
        result.decryptedContent = '[Decryption failed]';
    }

    return result;
}

function formatTime(timestamp: number): string
{
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
}

async function loadMoments()
{
    loading.value = true;
    currentOffset.value = 0;
    wsService.sendPacket('get_moments', {
        offset: 0,
        count: 20
    });
}

async function loadMoreMoments()
{
    if (moments.value.length === 0) return;

    wsService.sendPacket('get_moments', {
        offset: currentOffset.value,
        count: 20
    });
}

async function postMoment()
{
    if (!newMomentText.value.trim()) return;

    try
    {
        // Get or create moment key
        wsService.sendPacket('get_my_moment_key', {});
    } 
    catch (e)
    {
        console.error('Failed to post moment:', e);
        chatStore.showToast('Failed to post moment', 'error');
    }
}

async function handleMomentKeyResponse(data: { exists: boolean; key?: string; chatId?: number; })
{
    if (!newMomentText.value.trim()) return;

    try
    {
        let encryptedKey: string | undefined;
        let key: CryptoKey;

        if (!data.exists || !data.key)
        {
            // Need to create new moment key
            key = await generateSymmetricKey();
            const myPublicKey = await userStore.getMyPublicKey();
            if (!myPublicKey)
            {
                chatStore.showToast('Public key not available', 'error');
                return;
            }
            encryptedKey = await encryptSymmetricKey(key, myPublicKey);
        } 
        else
        {
            // Decrypt existing key
            const decryptedKey = await getDecryptedKey(data.key);
            if (!decryptedKey)
            {
                chatStore.showToast('Failed to decrypt moment key', 'error');
                return;
            }
            key = decryptedKey;
        }

        // Encrypt the message
        const encryptedContent = await encryptMessageString(newMomentText.value, key);

        wsService.sendPacket('post_moment', {
            content: encryptedContent,
            type: 'TEXT',
            key: encryptedKey || null
        });

        showPostModal.value = false;
        newMomentText.value = '';

        // Refresh moments
        setTimeout(() => loadMoments(), 500);
    } 
    catch (e)
    {
        console.error('Failed to post moment:', e);
        chatStore.showToast('Failed to post moment', 'error');
    }
}

async function handleMomentsList(data: { moments: Moment[]; })
{
    loading.value = false;
    hasMore.value = data.moments.length >= 20;

    // Decrypt all moments
    const decrypted = await Promise.all(data.moments.map(decryptMoment));

    // Merge with existing moments
    const existingIds = new Set(moments.value.map(m => m.messageId));
    const newMoments = decrypted.filter(m => !existingIds.has(m.messageId));

    moments.value = [...moments.value, ...newMoments].sort((a, b) => b.time - a.time);

    // Update offset for next load
    currentOffset.value = moments.value.length;
}

// Register WebSocket handlers
onMounted(() =>
{
    wsService.on('moments_list', handleMomentsList);
    wsService.on('my_moment_key', handleMomentKeyResponse);

    if (chatStore.isMomentsView)
    {
        loadMoments();
    }
});

// Watch for view changes
watch(() => chatStore.isMomentsView, (newVal) =>
{
    if (newVal)
    {
        moments.value = [];
        loadMoments();
    }
});
</script>

<style scoped>
.moments-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
}

.moments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
}

.moments-header h3 {
    margin: 0;
    font-size: 1.1rem;
}

.post-moment-btn {
    background: var(--primary-color);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: opacity 0.2s;
}

.post-moment-btn:hover {
    opacity: 0.8;
}

.loading,
.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--secondary-color);
    text-align: center;
}

.empty .hint {
    font-size: 0.85rem;
    margin-top: 8px;
    opacity: 0.7;
}

.moments-list {
    flex: 1;
    overflow-y: auto;
}

.moment-item {
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
}

.moment-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
}

.moment-info {
    display: flex;
    flex-direction: column;
}

.owner-name {
    font-weight: 600;
    font-size: 0.95rem;
}

.moment-time {
    font-size: 0.8rem;
    color: var(--secondary-color);
}

.moment-content {
    padding-left: 50px;
}

.text-content {
    margin: 0;
    word-break: break-word;
    white-space: pre-wrap;
}

.moment-image {
    max-width: 100%;
    border-radius: 8px;
    margin-top: 8px;
}

.load-more-btn {
    width: 100%;
    padding: 12px;
    background: none;
    border: none;
    color: var(--primary-color);
    cursor: pointer;
    font-size: 0.9rem;
}

.load-more-btn:hover {
    background: var(--hover-bg);
}

/* Modal styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: var(--panel-bg);
    border-radius: 8px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
    margin: 0;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--text-color);
    cursor: pointer;
    padding: 0;
    line-height: 1;
}

.modal-body {
    padding: 15px;
}

.modal-body textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--text-color);
    resize: vertical;
    font-family: inherit;
    font-size: 0.95rem;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 15px;
}

.cancel-btn {
    padding: 8px 16px;
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-color);
    cursor: pointer;
}

.post-btn {
    padding: 8px 16px;
    background: var(--primary-color);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
}

.post-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
