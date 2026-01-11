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
                    <div class="moment-avatar-wrapper">
                        <img :src="getAvatarUrl(moment.ownerId)" class="avatar clickable" alt="avatar" @click="openUserProfile(moment.ownerId)" />
                        <DonorBadgeIcon v-if="moment.ownerIsDonor" class="donor-badge" />
                    </div>
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

                <!-- Reactions section -->
                <div class="moment-reactions">
                    <div v-if="moment.reactions && moment.reactions.length > 0" class="reactions-summary" @click="handleReactionsClick($event, moment.messageId)" @contextmenu.prevent.stop="handleReactionsClick($event, moment.messageId)">
                        <span class="reaction-emojis">
                            {{getMomentTopReactions(moment.messageId).map(r => r.emoji).join('')}}
                        </span>
                        <span class="reaction-count">
                            {{moment.reactions.reduce((sum, r) => sum + r.userIds.length, 0)}}
                        </span>
                    </div>
                    <!-- Add Reaction Button -->
                    <div class="add-reaction-btn" :class="{ 'has-reaction': getMomentCurrentReaction(moment.messageId) }" @click="handleAddReactionClick($event, moment.messageId)" @contextmenu.prevent.stop="handleAddReactionClick($event, moment.messageId)">
                        <span v-if="getMomentCurrentReaction(moment.messageId)" class="current-reaction-emoji">{{ getMomentCurrentReaction(moment.messageId) }}</span>
                        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8 15s1.5 2 4 2 4-2 4-2"></path>
                            <line x1="9" y1="9" x2="9.01" y2="9"></line>
                            <line x1="15" y1="9" x2="15.01" y2="9"></line>
                        </svg>
                    </div>
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
                        <div v-for="comment in getMomentComments(moment.messageId)" :key="comment.id" class="comment-item" @contextmenu.prevent="handleCommentContextMenu($event, moment.messageId, comment)">
                            <div class="comment-avatar-wrapper">
                                <img :src="getAvatarUrl(comment.senderId)" class="comment-avatar clickable" alt="avatar" @click="openUserProfile(comment.senderId)" />
                                <DonorBadgeIcon v-if="comment.senderIsDonor" class="comment-donor-badge" />
                            </div>
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

        <!-- Comment Context Menu -->
        <ContextMenu :visible="commentContextMenuVisible" :x="commentContextMenuX" :y="commentContextMenuY" :items="commentContextMenuItems" @close="commentContextMenuVisible = false" @select="handleMenuSelect" />

        <!-- Emoji Picker -->
        <EmojiPicker :visible="emojiPickerVisible" :x="emojiPickerX" :y="emojiPickerY" @close="emojiPickerVisible = false" @select="handleEmojiSelect" />

        <!-- Reactions Popup -->
        <ReactionsPopup :visible="reactionsPopupVisible" :x="reactionsPopupX" :y="reactionsPopupY" :reactions="getSelectedMomentReactions()" :users="getUserMap()" @close="reactionsPopupVisible = false" @user-click="handleUserClick" />

        <!-- Edit Moment/Comment Modal -->
        <EditMomentModal :visible="showEditModal" :moment="selectedComment?.momentId ? moments.find(m => m.messageId === selectedComment?.momentId) || null : selectedMoment" :comment="selectedComment?.comment || null" @close="showEditModal = false" />

        <!-- Delete Moment/Comment Modal -->
        <DeleteMomentModal :visible="showDeleteModal" :moment="selectedComment?.momentId ? moments.find(m => m.messageId === selectedComment?.momentId) || null : selectedMoment" :comment="selectedComment?.comment || null" @close="showDeleteModal = false" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, reactive, onUnmounted } from 'vue';
import { useChatStore, useUserStore, useUIStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { getAvatarUrl, getUserId } from '@/utils/helpers';
import { sendPacket } from '@/services/api';
import
{
    decryptSymmetricKey,
    decryptMessageString,
    generateSymmetricKey,
    encryptSymmetricKey,
    encryptMessageString
} from '@/utils/crypto';
import type { Moment, MomentComment, Reaction } from '@/types';
import EditMomentModal from './modals/EditMomentModal.vue';
import DeleteMomentModal from './modals/DeleteMomentModal.vue';
import CommentInput from './CommentInput.vue';
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue';
import EditIcon from './icons/EditIcon.vue';
import DeleteIcon from './icons/DeleteIcon.vue';
import DonorBadgeIcon from './icons/DonorBadgeIcon.vue';
import EmojiPicker from './EmojiPicker.vue';
import ReactionsPopup from './ReactionsPopup.vue';

interface DecryptedMoment extends Moment
{
    decryptedContent?: string;
    imageUrl?: string;
}

const chatStore = useChatStore();
const userStore = useUserStore();
const uiStore = useUIStore();

let myMomentKey: CryptoKey | null = null;
let myEncryptedMomentKey: string | null = null;

const moments = ref<DecryptedMoment[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const showPostModal = ref(false);
const newMomentText = ref('');
const currentViewingUserName = ref('');

// Context menu state
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const selectedMoment = ref<DecryptedMoment | null>(null);

// Comment context menu state
const commentContextMenuVisible = ref(false);
const commentContextMenuX = ref(0);
const commentContextMenuY = ref(0);
const selectedComment = ref<{ momentId: number; comment: MomentComment; } | null>(null);

// Modals state
const showEditModal = ref(false);
const showDeleteModal = ref(false);

// Comments state
const showComments = ref<Set<number>>(new Set());
const comments = reactive<Map<number, MomentComment[]>>(new Map());

// Emoji picker state
const emojiPickerVisible = ref(false);
const emojiPickerX = ref(0);
const emojiPickerY = ref(0);

// Reactions popup state
const reactionsPopupVisible = ref(false);
const reactionsPopupX = ref(0);
const reactionsPopupY = ref(0);
const selectedMomentId = ref<number | null>(null);

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

// Check if current user is the comment owner
const isCommentOwner = computed(() =>
{
    if (!userStore.currentUser || !selectedComment.value) return false;
    const currentUserId = getUserId(userStore.currentUser.id);
    return selectedComment.value.comment.senderId === currentUserId;
});

// Cache for decrypted keys
const keyCache = new Map<string, CryptoKey>();

// Helper functions for reactions
function getMomentTopReactions(momentId: number)
{
    const moment = moments.value.find(m => m.messageId === momentId);
    if (!moment || !moment.reactions) return [];
    return [...moment.reactions]
        .sort((a, b) => b.userIds.length - a.userIds.length)
        .slice(0, 10);
}

function getMomentCurrentReaction(momentId: number): string | null
{
    const moment = moments.value.find(m => m.messageId === momentId);
    if (!moment || !moment.reactions || !userStore.currentUser) return null;
    const userId = getUserId(userStore.currentUser.id);
    for (const reaction of moment.reactions)
    {
        if (reaction.userIds.includes(userId))
        {
            return reaction.emoji;
        }
    }
    return null;
}

async function getDecryptedKey(encryptedKey: string): Promise<CryptoKey | null>
{
    if (keyCache.has(encryptedKey)) return keyCache.get(encryptedKey)!;
    if (!userStore.privateKey) return null;
    const key = await decryptSymmetricKey(encryptedKey, userStore.privateKey);
    if (key) keyCache.set(encryptedKey, key);
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

// Comment context menu items
const commentContextMenuItems = computed<ContextMenuItem[]>(() =>
{
    const items: ContextMenuItem[] = [];
    if (isCommentOwner.value && selectedComment.value?.comment.type === 'TEXT')
    {
        items.push({ id: 'edit', label: 'Edit', icon: EditIcon });
    }
    if (isCommentOwner.value)
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
    if (viewingUserId.value)
    {
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
            before: moments.value.length,
            count: 20
        });
    }
    else
    {
        // Load more all moments
        wsService.sendPacket('get_moments', {
            offset: moments.value.length,
            count: 20
        });
    }
}

async function postMoment()
{
    if (!myMomentKey || !myEncryptedMomentKey)
    {
        chatStore.showToast('Moment key not available', 'error');
        return;
    }
    try
    {
        const encryptedContent = await encryptMessageString(newMomentText.value.trim(), myMomentKey);
        wsService.sendPacket('post_moment', {
            content: encryptedContent,
            key: myEncryptedMomentKey,
            type: 'TEXT'
        });
        showPostModal.value = false;
        newMomentText.value = '';
    }
    catch (e)
    {
        console.error('Failed to post moment:', e);
        chatStore.showToast('Failed to post moment', 'error');
    }
}

async function handleMomentKeyResponse(data: { exists: boolean; key?: string; chatId?: number; })
{
    try
    {
        let encryptedKey: string;
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
            encryptedKey = data.key;
            const decryptedKey = await getDecryptedKey(data.key);
            if (!decryptedKey)
            {
                chatStore.showToast('Failed to decrypt moment key', 'error');
                return;
            }
            key = decryptedKey;
        }
        myMomentKey = key;
        myEncryptedMomentKey = encryptedKey;
    }
    catch (e)
    {
        console.error('Failed to handle moment key response:', e);
        chatStore.showToast('Failed to post moment', 'error');
    }
}

async function handleMomentsList(data: { moments: Moment[]; username?: string; })
{
    loading.value = false;
    hasMore.value = !!data.moments.length;
    if (data.username) currentViewingUserName.value = data.username;
    const decrypted = await Promise.all(data.moments.map(decryptMoment));
    const existingIds = new Set(moments.value.map(m => m.messageId));
    const newMoments = decrypted.filter(m => !existingIds.has(m.messageId));
    moments.value = [...moments.value, ...newMoments].sort((a, b) => b.time - a.time);
    if (data.username) moments.value = moments.value.filter(m => m.ownerName === data.username);
}

function goBackToAllMoments()
{
    // 使用浏览器历史返回，由 popstate 处理器恢复状态
    history.back();
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

function handleCommentContextMenu(event: MouseEvent, momentId: number, comment: MomentComment)
{
    event.stopPropagation(); // Prevent bubbling to moment's context menu
    selectedComment.value = { momentId, comment };
    commentContextMenuX.value = event.clientX;
    commentContextMenuY.value = event.clientY;
    commentContextMenuVisible.value = commentContextMenuItems.value.length > 0;
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
    return comments.get(momentId) || [];
}

// Edit moment or comment handler
async function handleMomentEdited(data: { messageId: number; content?: string; reactions?: any; })
{
    // First check if it's a moment
    const moment = moments.value.find(m => m.messageId === data.messageId);
    if (moment)
    {
        // Update content if provided
        if (data.content !== undefined)
        {
            moment.content = data.content;
            moment.decryptedContent = '[Updated]';
            // Re-decrypt
            decryptMoment(moment).then(decrypted =>
            {
                moment.decryptedContent = decrypted.decryptedContent;
            });
        }

        // Update reactions if provided
        if (data.reactions !== undefined)
        {
            moment.reactions = data.reactions;
        }

        return;
    }

    // If not a moment, check if it's a comment
    for (const [momentId, momentComments] of comments.entries())
    {
        const commentIndex = momentComments.findIndex(c => c.id === data.messageId);
        if (commentIndex !== -1)
        {
            // Found the comment - decrypt and update it
            const parentMoment = moments.value.find(m => m.messageId === momentId);
            if (!parentMoment) return;

            const key = await getDecryptedKey(parentMoment.key);
            if (!key) return;

            try
            {
                const decryptedContent = await decryptMessageString(data.content!, key);
                const updatedComments = [...momentComments];
                updatedComments[commentIndex] = {
                    ...updatedComments[commentIndex],
                    content: decryptedContent
                };
                comments.set(momentId, updatedComments);
            }
            catch (e)
            {
                console.error('Failed to decrypt updated comment:', e);
            }
            return;
        }
    }
}

// Delete moment or comment handler
function handleMomentDeleted(data: { messageId: number; })
{
    // First check if it's a moment
    const momentIndex = moments.value.findIndex(m => m.messageId === data.messageId);
    if (momentIndex !== -1)
    {
        moments.value = moments.value.filter(m => m.messageId !== data.messageId);
        comments.delete(data.messageId);
        showComments.value.delete(data.messageId);
        return;
    }

    // If not a moment, check if it's a comment
    for (const [momentId, momentComments] of comments.entries())
    {
        const commentIndex = momentComments.findIndex(c => c.id === data.messageId);
        if (commentIndex !== -1)
        {
            // Found the comment - remove it
            const updatedComments = momentComments.filter(c => c.id !== data.messageId);
            comments.set(momentId, updatedComments);
            return;
        }
    }
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
            senderIsDonor: data.comment.senderIsDonor,
            time: data.comment.time,
            type: data.comment.type
        };

        // Add comment to the moment's comments
        const existingComments = comments.get(momentId) || [];
        comments.set(momentId, [...existingComments, comment]);
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
    const commentsList = await Promise.all(data.comments.map(async (c: any) =>
    {
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
            senderIsDonor: c.senderIsDonor,
            time: c.time,
            type: c.type
        };
    }));

    comments.set(momentId, commentsList);
}

function handleCommentSent()
{
    // Comment was sent successfully
}

function getSelectedMomentReactions(): Reaction[]
{
    const moment = moments.value.find(m => m.messageId === selectedMomentId.value);
    return moment?.reactions || [];
}

// Reaction handlers
function handleAddReactionClick(event: MouseEvent, momentId: number)
{
    selectedMomentId.value = momentId;
    const moment = moments.value.find(m => m.messageId === momentId);
    if (!moment) return;

    // If current user already reacted, clicking should toggle it off
    const currentReaction = getMomentCurrentReaction(momentId);
    if (currentReaction)
    {
        sendPacket('toggle_reaction', {
            messageId: momentId,
            emoji: currentReaction
        });
        return;
    }

    // Otherwise, open emoji picker
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    emojiPickerX.value = rect.left;
    emojiPickerY.value = rect.bottom + 4;
    emojiPickerVisible.value = true;
}

function handleReactionsClick(event: MouseEvent, momentId: number)
{
    selectedMomentId.value = momentId;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    reactionsPopupX.value = rect.left;
    reactionsPopupY.value = rect.bottom + 4;
    reactionsPopupVisible.value = true;
}

function handleEmojiSelect(emoji: string)
{
    if (!userStore.currentUser || selectedMomentId.value === null) return;

    // If clicking the same emoji, toggle it off
    const currentReaction = getMomentCurrentReaction(selectedMomentId.value);
    if (currentReaction === emoji)
    {
        sendPacket('toggle_reaction', {
            messageId: selectedMomentId.value,
            emoji: emoji
        });
        return;
    }

    // Otherwise, send new reaction
    sendPacket('toggle_reaction', {
        messageId: selectedMomentId.value,
        emoji: emoji
    });
}

function getUserMap(): Map<number, string>
{
    const userMap = new Map<number, string>();
    const moment = moments.value.find(m => m.messageId === selectedMomentId.value);
    if (!moment || !moment.reactions) return userMap;

    for (const reaction of moment.reactions)
        for (const userId of reaction.userIds)
            if (!userMap.has(userId))
                userMap.set(userId, `User ${userId}`);
    return userMap;
}

function handleUserClick(userId: number)
{
    if (!userStore.currentUser) return;
    if (userId === getUserId(userStore.currentUser.id)) return;
    uiStore.navigateToProfile(userId);
}

// Register WebSocket handlers
onMounted(() =>
{
    wsService.on('moments_list', handleMomentsList);
    wsService.on('my_moment_key', handleMomentKeyResponse);
    wsService.on('moment_edited', handleMomentEdited);
    wsService.on('moment_deleted', handleMomentDeleted);
    wsService.on('comment_added', handleCommentAdded);
    wsService.on('moment_comments', handleMomentComments);
    if (chatStore.isMomentsView) loadMoments();
    sendPacket('get_my_moment_key', {});
});

onUnmounted(() =>
{
    wsService.off('moments_list', handleMomentsList);
    wsService.off('my_moment_key', handleMomentKeyResponse);
    wsService.off('moment_edited', handleMomentEdited);
    wsService.off('moment_deleted', handleMomentDeleted);
    wsService.off('comment_added', handleCommentAdded);
    wsService.off('moment_comments', handleMomentComments);
});

// Watch for view changes
watch(() => chatStore.isMomentsView, (newVal) =>
{
    if (newVal)
    {
        moments.value = [];
        if (!viewingUserId.value) currentViewingUserName.value = '';
        loadMoments();
    }
});

// Watch for viewing user changes
watch(() => viewingUserId.value, (newUserId, oldUserId) =>
{
    if (chatStore.isMomentsView && newUserId !== oldUserId)
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

.moment-avatar-wrapper {
    position: relative;
    width: 40px;
    height: 40px;
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

.donor-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 18px;
    height: 18px;
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
    box-sizing: border-box;
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

/* Reactions styles */
.moment-reactions {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 50px;
    margin-top: 8px;
}

.reactions-summary {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.05);
    cursor: pointer;
    font-size: 0.8em;
    transition: background-color 0.15s ease;
}

.reactions-summary:hover {
    background: rgba(0, 0, 0, 0.1);
}

.reaction-emojis {
    display: flex;
    gap: 2px;
    font-family: 'Noto Color Emoji';
}

.reaction-count {
    font-size: 0.85em;
    opacity: 0.8;
}

.add-reaction-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0.5;
    transition: all 0.15s ease;
}

.add-reaction-btn.has-reaction {
    opacity: 1;
}

.add-reaction-btn:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.05);
}

.current-reaction-emoji {
    font-size: 16px;
    line-height: 1;
    font-family: 'Noto Color Emoji';
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
    padding-left: 10px;
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

.comment-avatar-wrapper {
    position: relative;
    width: 28px;
    height: 28px;
}

.comment-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.comment-donor-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 14px;
    height: 14px;
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
