<template>
    <div class="moments-view">
        <div class="moments-header">
            <h3>{{ viewingUserId ? `${viewingUserName}'s Moments` : 'Moments' }}</h3>
            <div v-if="!viewingUserId" class="header-buttons">
                <button class="settings-btn" @click="uiStore.showMomentSettingsModal = true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <button class="post-moment-btn" @click="showPostModal = true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>
            <button v-else class="back-btn" @click="goBackToAllMoments">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                <span>Back</span>
            </button>
        </div>

        <div v-if="loading" class="loading">Loading moments...</div>
        <div v-else-if="moments.length === 0" class="empty">
            <p>No moments yet</p>
            <p class="hint">Post your first moment or add friends to see theirs!</p>
        </div>
        <div v-else class="moments-list">
            <div v-for="moment in moments" :key="moment.messageId" class="moment-item" @contextmenu.prevent="handleContextMenu($event, moment)">
                <div class="moment-header">
                    <img :src="getAvatarUrl(moment.ownerId)" class="avatar clickable" alt="avatar" @click="openUserProfile(moment.ownerId)" />
                    <div class="moment-info">
                        <span class="owner-name clickable" @click="openUserProfile(moment.ownerId)">{{ moment.ownerName }}</span>
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
                
                <!-- Comment section -->
                <div class="moment-actions">
                    <button class="comment-toggle-btn" @click="toggleComments(moment.messageId)">
                        <span v-if="showComments.has(moment.messageId)">Hide comments</span>
                        <span v-else>Show comments</span>
                    </button>
                </div>
                
                <!-- Comments list -->
                <div v-if="showComments.has(moment.messageId)" class="comments-section">
                    <div v-if="getMomentComments(moment.messageId).length === 0" class="no-comments">
                        No comments yet
                    </div>
                    <div v-else class="comments-list">
                        <div v-for="comment in getMomentComments(moment.messageId)" :key="comment.id" class="comment-item">
                            <img :src="getAvatarUrl(comment.senderId)" class="comment-avatar clickable" alt="avatar" @click="openUserProfile(comment.senderId)" />
                            <div class="comment-content">
                                <span class="comment-sender clickable" @click="openUserProfile(comment.senderId)">{{ comment.senderName }}</span>
                                <span class="comment-time">{{ formatTime(comment.time) }}</span>
                                <p class="comment-text">{{ comment.content }}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Comment input -->
                    <CommentInput :moment="moment" @commentSent="handleCommentSent" />
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
        
        <!-- Context Menu -->
        <ContextMenu :visible="contextMenuVisible" :x="contextMenuX" :y="contextMenuY" :items="contextMenuItems" @close="contextMenuVisible = false" @select="handleMenuSelect" />
        
        <!-- Edit Moment Modal -->
        <EditMomentModal :visible="showEditModal" :moment="selectedMoment" @close="showEditModal = false" />
        
        <!-- Delete Moment Modal -->
        <DeleteMomentModal :visible="showDeleteModal" :moment="selectedMoment" @close="showDeleteModal = false" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useChatStore, useUserStore, useUIStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { getAvatarUrl, getUserId } from '@/utils/helpers';
import
{
    decryptSymmetricKey,
    decryptMessageString,
    generateSymmetricKey,
    encryptSymmetricKey,
    encryptMessageString
} from '@/utils/crypto';
import type { Moment, MomentComment } from '@/types';
import EditMomentModal from './modals/EditMomentModal.vue';
import DeleteMomentModal from './modals/DeleteMomentModal.vue';
import CommentInput from './CommentInput.vue';
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue';
import EditIcon from './icons/EditIcon.vue';
import DeleteIcon from './icons/DeleteIcon.vue';

interface DecryptedMoment extends Moment
{
    decryptedContent?: string;
    imageUrl?: string;
}

const chatStore = useChatStore();
const userStore = useUserStore();
const uiStore = useUIStore();

const moments = ref<DecryptedMoment[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const showPostModal = ref(false);
const newMomentText = ref('');
const currentOffset = ref(0);
const currentViewingUserName = ref('');

// Context menu state
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const selectedMoment = ref<DecryptedMoment | null>(null);

// Modals state
const showEditModal = ref(false);
const showDeleteModal = ref(false);

// Comments state
const showComments = ref<Set<number>>(new Set());
const comments = ref<Map<number, MomentComment[]>>(new Map());

// View mode: null = viewing all moments, number = viewing specific user's moments
const viewingUserId = computed(() => chatStore.viewingUserMomentsId);
const viewingUserName = computed(() =>
{
    if (!viewingUserId.value) return '';
    // Use the username from backend response first, fallback to friends list
    if (currentViewingUserName.value)
    {
        return currentViewingUserName.value;
    }
    const user = chatStore.friends.find(f => f.id === viewingUserId.value);
    return user?.username || `User ${viewingUserId.value}`;
});

// Check if current user is the moment owner
const isMomentOwner = computed(() =>
{
    if (!userStore.currentUser || !selectedMoment.value) return false;
    const currentUserId = getUserId(userStore.currentUser.id);
    return selectedMoment.value.ownerId === currentUserId;
});

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

// Context menu items
const contextMenuItems = computed<ContextMenuItem[]>(() =>
{
    const items: ContextMenuItem[] = [];
    if (isMomentOwner.value && selectedMoment.value?.type === 'TEXT')
    {
        items.push({ id: 'edit', label: 'Edit', icon: EditIcon });
    }
    if (isMomentOwner.value)
    {
        items.push({ id: 'delete', label: 'Delete', icon: DeleteIcon });
    }
    return items;
});

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

    if (viewingUserId.value)
    {
        // Load specific user's moments
        // Backend expects offset (not before as message ID or timestamp)
        wsService.sendPacket('get_user_moments', {
            userId: viewingUserId.value,
            before: 0,
            count: 20
        });
    }
    else
    {
        // Load all moments
        wsService.sendPacket('get_moments', {
            offset: 0,
            count: 20
        });
    }
}

async function loadMoreMoments()
{
    if (moments.value.length === 0) return;

    if (viewingUserId.value)
    {
        // Load more specific user's moments
        // Backend expects offset (not message ID)
        wsService.sendPacket('get_user_moments', {
            userId: viewingUserId.value,
            before: currentOffset.value,
            count: 20
        });
    }
    else
    {
        // Load more all moments
        wsService.sendPacket('get_moments', {
            offset: currentOffset.value,
            count: 20
        });
    }
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

async function handleUserMomentsList(data: { userId: number; username: string; moments: Moment[]; })
{
    loading.value = false;
    hasMore.value = data.moments.length >= 20;

    // Store the username from backend response
    if (data.username)
    {
        currentViewingUserName.value = data.username;
    }

    // Decrypt all moments
    const decrypted = await Promise.all(data.moments.map(decryptMoment));

    // When viewing specific user, just add all moments (they're already sorted by time)
    const existingIds = new Set(moments.value.map(m => m.messageId));
    const newMoments = decrypted.filter(m => !existingIds.has(m.messageId));

    moments.value = [...moments.value, ...newMoments].sort((a, b) => b.time - a.time);

    // Update offset for next load
    currentOffset.value = moments.value.length;
}

function goBackToAllMoments()
{
    chatStore.viewingUserMomentsId = null;
    currentViewingUserName.value = '';
    moments.value = [];
    loadMoments();
}

function openUserProfile(ownerId: number)
{
    if (!userStore.currentUser) return;
    const currentUserId = getUserId(userStore.currentUser.id);
    if (ownerId === currentUserId) return;
    uiStore.navigateToProfile(ownerId);
}

// Context menu handlers
function handleContextMenu(event: MouseEvent, moment: DecryptedMoment)
{
    selectedMoment.value = moment;
    contextMenuX.value = event.clientX;
    contextMenuY.value = event.clientY;
    // Only show context menu if there are items
    contextMenuVisible.value = contextMenuItems.value.length > 0;
}

function handleMenuSelect(item: ContextMenuItem)
{
    switch (item.id)
    {
        case 'edit':
            showEditModal.value = true;
            break;
        case 'delete':
            showDeleteModal.value = true;
            break;
    }
}

// Comment handlers
function toggleComments(momentId: number)
{
    if (showComments.value.has(momentId))
    {
        showComments.value.delete(momentId);
    }
    else
    {
        showComments.value.add(momentId);
        // Load comments for this moment
        loadMomentComments(momentId);
    }
}

async function loadMomentComments(momentId: number)
{
    try
    {
        wsService.sendPacket('get_moment_comments', {
            momentMessageId: momentId
        });
    }
    catch (e)
    {
        console.error('Failed to load comments:', e);
        chatStore.showToast('Failed to load comments', 'error');
    }
}

function getMomentComments(momentId: number): MomentComment[]
{
    return comments.value.get(momentId) || [];
}

// Edit moment handler
function handleMomentEdited(data: { messageId: number; content: string; })
{
    const moment = moments.value.find(m => m.messageId === data.messageId);
    if (moment)
    {
        moment.content = data.content;
        moment.decryptedContent = '[Updated]';
        // Re-decrypt
        decryptMoment(moment).then(decrypted =>
        {
            moment.decryptedContent = decrypted.decryptedContent;
        });
    }
}

// Delete moment handler
function handleMomentDeleted(data: { messageId: number; })
{
    moments.value = moments.value.filter(m => m.messageId !== data.messageId);
    comments.value.delete(data.messageId);
    showComments.value.delete(data.messageId);
    chatStore.showToast('Moment deleted', 'success');
}

// Comment added handler
async function handleCommentAdded(data: { comment: any; })
{
    // Find which moment this comment belongs to
    // Get the replyTo field to find the moment ID
    // replyTo is a ReplyInfo object with messageId, content, senderId, senderName, type
    const momentId = data.comment.replyTo?.messageId;
    if (momentId)
    {
        // Find the moment to get its key for decryption
        const moment = moments.value.find(m => m.messageId === momentId);
        if (!moment) return;
        
        // Get the decrypted key for this moment
        const key = await getDecryptedKey(moment.key);
        if (!key) return;
        
        // Decrypt the comment
        let decryptedContent = '[Decryption failed]';
        try
        {
            if (data.comment.type === 'TEXT')
            {
                decryptedContent = await decryptMessageString(data.comment.content, key);
            }
            else
            {
                decryptedContent = '[Image]';
            }
        }
        catch (e)
        {
            console.error('Failed to decrypt comment:', e);
        }
        
        const comment: MomentComment = {
            id: data.comment.id,
            content: decryptedContent,
            senderId: data.comment.senderId,
            senderName: data.comment.senderName,
            time: data.comment.time,
            type: data.comment.type
        };
        
        // Add comment to the moment's comments
        const existingComments = comments.value.get(momentId) || [];
        comments.value.set(momentId, [...existingComments, comment]);
        
        chatStore.showToast('New comment added', 'success');
    }
}

// Moment comments list handler
async function handleMomentComments(data: { momentMessageId: number; comments: any[]; })
{
    const momentId = data.momentMessageId;
    
    // Find the moment to get its key for decryption
    const moment = moments.value.find(m => m.messageId === momentId);
    if (!moment) return;
    
    // Get the decrypted key for this moment
    const key = await getDecryptedKey(moment.key);
    if (!key) return;
    
    // Decrypt each comment
    const commentsList = await Promise.all(data.comments.map(async (c: any) => {
        let decryptedContent = '[Decryption failed]';
        try
        {
            if (c.type === 'TEXT')
            {
                decryptedContent = await decryptMessageString(c.content, key);
            }
            else
            {
                decryptedContent = '[Image]';
            }
        }
        catch (e)
        {
            console.error('Failed to decrypt comment:', e);
        }
        
        return {
            id: c.id,
            content: decryptedContent,
            senderId: c.senderId,
            senderName: c.senderName,
            time: c.time,
            type: c.type
        };
    }));
    
    comments.value.set(momentId, commentsList);
}

function handleCommentSent()
{
    // Comment was sent successfully
    // The comment will be received via WebSocket and added to comments list
    // No need to refresh moments
}

// Register WebSocket handlers
onMounted(() =>
{
    wsService.on('moments_list', handleMomentsList);
    wsService.on('user_moments_list', handleUserMomentsList);
    wsService.on('my_moment_key', handleMomentKeyResponse);
    wsService.on('moment_edited', handleMomentEdited);
    wsService.on('moment_deleted', handleMomentDeleted);
    wsService.on('comment_added', handleCommentAdded);
    wsService.on('moment_comments', handleMomentComments);

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
        if (!viewingUserId.value)
        {
            currentViewingUserName.value = '';
        }
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

.header-buttons {
    display: flex;
    gap: 8px;
}

.settings-btn {
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: all 0.2s;
}

.settings-btn:hover {
    background: var(--hover-bg);
    color: var(--text-color);
    border-color: var(--text-secondary);
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

.back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-color);
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
}

.back-btn:hover {
    background: var(--hover-bg);
}

.back-btn svg {
    width: 18px;
    height: 18px;
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

.avatar.clickable {
    cursor: pointer;
    transition: opacity 0.2s;
}

.avatar.clickable:hover {
    opacity: 0.8;
}

.moment-info {
    display: flex;
    flex-direction: column;
}

.owner-name {
    font-weight: 600;
    font-size: 0.95rem;
}

.owner-name.clickable {
    cursor: pointer;
    transition: color 0.2s;
}

.owner-name.clickable:hover {
    color: var(--primary-color);
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

/* Comment styles */
.moment-actions {
    padding-left: 50px;
    margin-top: 10px;
}

.comment-toggle-btn {
    background: none;
    border: none;
    color: var(--primary-color);
    cursor: pointer;
    font-size: 0.85rem;
    padding: 4px 8px;
    transition: background 0.2s;
}

.comment-toggle-btn:hover {
    background: var(--hover-bg);
    border-radius: 4px;
}

.comments-section {
    padding-left: 50px;
    margin-top: 10px;
    border-top: 1px solid var(--border-color);
    padding-top: 10px;
}

.no-comments {
    color: var(--secondary-color);
    font-size: 0.85rem;
    padding: 8px 0;
    text-align: center;
}

.comments-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 10px;
}

.comment-item {
    display: flex;
    gap: 8px;
    padding: 8px;
    background: var(--hover-bg);
    border-radius: 6px;
}

.comment-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.comment-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.comment-sender {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--primary-color);
}

.comment-time {
    font-size: 0.75rem;
    color: var(--secondary-color);
}

.comment-text {
    margin: 0;
    font-size: 0.9rem;
    word-break: break-word;
    white-space: pre-wrap;
}
</style>
