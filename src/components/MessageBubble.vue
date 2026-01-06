<template>
    <div :class="['message', isMe ? 'sent' : 'received']" :style="{ marginLeft: showSender ? '40px' : '0' }" v-bind="$attrs" @contextmenu.prevent="handleContextMenu" @touchstart="handleTouchStart" @touchend="handleTouchEnd" @touchmove="handleTouchMove">
        <!-- Sender info for group chats -->
        <template v-if="showSender">
            <div class="message-sender" @click="openUserProfile">{{ message.senderName || `User ${message.senderId}` }}</div>
            <div class="sender-avatar-wrapper">
                <img :src="getAvatarUrl(message.senderId)" class="sender-avatar" alt="avatar" loading="lazy" @click="openUserProfile" />
                <DonorBadgeIcon v-if="message.senderIsDonor" class="donor-badge" />
            </div>
        </template>
 
        <!-- Message content -->
        <div class="content">
            <!-- Reply info -->
            <div v-if="message.replyTo" class="reply-info" @click="handleReplyContentClick">
                <span class="reply-sender">{{ message.replyTo.senderName }}:</span>
                <span class="reply-content" :class="{ 'clickable': isReplyToImage }">{{ decryptedReplyContent ? truncateReplyContent(decryptedReplyContent) : '[Decrypting...]' }}</span>
            </div>
 
            <template v-if="!chatKey">
                [Key Not Available]
            </template>
            <template v-else-if="message.type.toLowerCase() === 'text'">
                <span v-for="(chunk, index) in contentChunks" :key="index">
                    <span v-if="chunk.type === 'text'">{{ chunk.content }}</span>
                    <span v-else-if="chunk.isValidMember" class="at-mention" @click="handleAtClick(chunk.username)">{{ chunk.content }}</span>
                    <span v-else>{{ chunk.content }}</span>
                </span>
            </template>
            <template v-else-if="message.type.toLowerCase() === 'image'">
                <div class="image-container">
                    <!-- 占位图：与原图尺寸相同，防止布局跳动 -->
                    <img v-if="imagePlaceholder" :src="imagePlaceholder" class="message-image placeholder-image" alt="" />
                    <!-- 实际图片：加载后覆盖占位图 -->
                    <div v-if="imageUrl" class="image-wrapper" :class="{ 'overlay-image': imageMetadata }" @click="openImageViewer">
                        <img :src="imageUrl" class="message-image" alt="Image" />
                        <div class="image-hint">Click to view</div>
                    </div>
                    <!-- 没有元数据时的加载提示 -->
                    <div v-if="!imagePlaceholder && !imageUrl" class="loading-image">Loading image...</div>
                </div>
            </template>
            <template v-else-if="message.type.toLowerCase() === 'video'">
                <div class="video-container">
                    <!-- 视频缩略图 -->
                    <div v-if="!showVideoPlayer && (videoThumbnailUrl || videoPlaceholder)" class="video-thumbnail-wrapper" @click="playVideo">
                        <img :src="videoThumbnailUrl ?? videoPlaceholder ?? ''" class="video-thumbnail" alt="Video thumbnail" />
                        <div class="video-play-overlay">
                            <PlayIcon />
                        </div>
                        <div class="video-duration" v-if="videoMetadata">{{ formatVideoDuration(videoMetadata.duration) }}</div>
                    </div>
                    <!-- 视频加载中 -->
                    <div v-else-if="!showVideoPlayer && !videoUrl" class="loading-video">Loading video...</div>
                    <!-- 视频播放器 -->
                    <div v-if="showVideoPlayer && videoUrl" class="video-player-wrapper">
                        <video ref="videoPlayer" :src="videoUrl" controls class="video-player" @ended="videoEnded"></video>
                        <button class="video-close-btn" @click="closeVideoPlayer">×</button>
                    </div>
                    <!-- 下载进度 -->
                    <div v-if="downloadProgress > 0 && downloadProgress < 100" class="download-progress">
                        <div class="download-progress-bar" :style="{ width: downloadProgress + '%' }"></div>
                        <span class="download-progress-text">{{ downloadProgress }}%</span>
                    </div>
                </div>
            </template>
            <template v-else-if="message.type.toLowerCase() === 'file'">
                <div class="file-container" @click="downloadFile">
                    <div class="file-icon">
                        <FileIcon />
                    </div>
                    <div class="file-info">
                        <div class="file-name">{{ fileMetadata?.fileName || 'Unknown file' }}</div>
                        <div class="file-size">{{ fileMetadata ? formatFileSize(fileMetadata.size) : '' }}</div>
                    </div>
                    <div class="file-download-icon">
                        <DownloadIcon />
                    </div>
                    <!-- 下载进度 -->
                    <div v-if="downloadProgress > 0 && downloadProgress < 100" class="file-download-progress">
                        <div class="file-download-bar" :style="{ width: downloadProgress + '%' }"></div>
                    </div>
                </div>
            </template>
        </div>
 
        <!-- Metadata and Reactions -->
        <div class="meta-section" :style="{ justifyContent: isMe ? 'flex-end' : 'flex-start' }">
            <div class="meta">
                {{ formatDate(message.time) }}
            </div>
            <!-- Reaction Button -->
            <div v-if="message.reactions && message.reactions.length > 0" class="reactions-summary" @click="handleReactionsClick" @contextmenu.prevent.stop="handleReactionsClick">
                <span class="reaction-emojis">
                    {{topReactions.map(r => r.emoji).join('')}}
                </span>
                <span class="reaction-count">
                    {{message.reactions.reduce((sum, r) => sum + r.userIds.length, 0)}}
                </span>
            </div>
            <!-- Add Reaction Button -->
            <div class="add-reaction-btn" :class="{ 'has-reaction': currentUserReaction }" @click="handleAddReactionClick" @contextmenu.prevent.stop="handleAddReactionClick">
                <span v-if="currentUserReaction" class="current-reaction-emoji">{{ currentUserReaction }}</span>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
            </div>
            <!-- Message Status Icon -->
            <CloseIcon v-if="showUnreadIcon" class="message-status-icon" />
            <svg v-else-if="showReadNoBurnIcon" class="message-status-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <svg v-else-if="showBurnCountdown" class="message-status-icon" width="16" height="16" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" />
                <path :d="countdownArcPath" fill="currentColor" />
            </svg>
        </div>
    </div>
 
    <!-- Emoji Picker -->
    <EmojiPicker :visible="emojiPickerVisible" :x="emojiPickerX" :y="emojiPickerY" @close="emojiPickerVisible = false" @select="handleEmojiSelect" />
 
    <!-- Reactions Popup -->
    <ReactionsPopup :visible="reactionsPopupVisible" :x="reactionsPopupX" :y="reactionsPopupY" :reactions="message.reactions || []" :users="getUserMap()" @close="reactionsPopupVisible = false" @user-click="handleUserClick" />
 
    <!-- Context Menu -->
    <ContextMenu :visible="contextMenuVisible" :x="contextMenuX" :y="contextMenuY" :items="contextMenuItems" @close="contextMenuVisible = false" @select="handleMenuSelect" />
 
    <!-- Edit Message Modal -->
    <EditMessageModal :visible="editModalVisible" :message="message" @close="editModalVisible = false" />
 
    <!-- Image Viewer Modal -->
    <ImageViewerModal :visible="imageViewerVisible" :imageUrl="viewingImageUrl" @close="imageViewerVisible = false" />
</template>
 
<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import type { Message } from '@/types';
import { useChatStore, useUserStore, useUIStore } from '@/stores';
import { decryptMessageString, decryptMessageBytes } from '@/utils/crypto';
import { getAvatarUrl, formatDate, getUserId, parseAtMentions } from '@/utils/helpers';
import { fetchMessageFile, sendPacket } from '@/services/api';
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue';
import EditMessageModal from './modals/EditMessageModal.vue';
import ImageViewerModal from './modals/ImageViewerModal.vue';
import EmojiPicker from './EmojiPicker.vue';
import ReactionsPopup from './ReactionsPopup.vue';
import ReplyIcon from './icons/ReplyIcon.vue';
import EditIcon from './icons/EditIcon.vue';
import DeleteIcon from './icons/DeleteIcon.vue';
import CopyIcon from './icons/CopyIcon.vue';
import DownloadIcon from './icons/DownloadIcon.vue';
import PlayIcon from './icons/PlayIcon.vue';
import FileIcon from './icons/FileIcon.vue';
import DonorBadgeIcon from './icons/DonorBadgeIcon.vue';
import CloseIcon from './icons/CloseIcon.vue';
import { downloadFile as downloadFileApi } from '@/services/api';
import { formatFileSize, formatDuration } from '@/utils/helpers';
import type { VideoMetadata, FileMetadata } from '@/types';
 
defineOptions({
    inheritAttrs: false
});
 
const props = defineProps<{
    message: Message;
}>();
 
const chatStore = useChatStore();
const userStore = useUserStore();
const uiStore = useUIStore();
 
const decryptedContent = ref<string>('[Decrypting...]');
const decryptedReplyContent = ref<string>('');
const imageUrl = ref<string | null>(null);
const imagePlaceholder = ref<string | null>(null);
const imageMetadata = ref<{ width: number; height: number; } | null>(null);
const viewingImageUrl = ref<string | null>(null);
const imageViewerVisible = ref(false);
 
// Video state
const videoUrl = ref<string | null>(null);
const videoThumbnailUrl = ref<string | null>(null);
const videoPlaceholder = ref<string | null>(null);
const videoMetadata = ref<VideoMetadata | null>(null);
const showVideoPlayer = ref(false);
const videoPlayer = ref<HTMLVideoElement | null>(null);
const isDownloading = ref(false);
 
// File state
const fileMetadata = ref<FileMetadata | null>(null);
 
// Download progress
const downloadProgress = ref(0);
 
// Context menu state
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const editModalVisible = ref(false);
 
// Emoji picker state
const emojiPickerVisible = ref(false);
const emojiPickerX = ref(0);
const emojiPickerY = ref(0);
 
// Reactions popup state
const reactionsPopupVisible = ref(false);
const reactionsPopupX = ref(0);
const reactionsPopupY = ref(0);

// Burn countdown state
const remainingBurnSeconds = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

// Touch handling for long press
let touchTimer: ReturnType<typeof setTimeout> | null = null;
let touchStartX = 0;
let touchStartY = 0;
const LONG_PRESS_DURATION = 500;
const TOUCH_MOVE_THRESHOLD = 10;
 
const isMe = computed(() =>
{
    if (!userStore.currentUser) return false;
    return props.message.senderId === getUserId(userStore.currentUser.id);
});
 
const chatKey = computed(() => chatStore.getChatKey(props.message.chatId));
 
const showSender = computed(() =>
{
    if (isMe.value) return false;
    const chat = chatStore.chats.find(c => c.chatId === props.message.chatId);
    return chat && !chat.isPrivate;
});
 
const isReplyToImage = computed(() =>
{
    return props.message.replyTo?.type && props.message.replyTo.type.toLowerCase() === 'image';
});
 
// 当前用户对该消息的reaction
const currentUserReaction = computed(() =>
{
    if (!props.message.reactions) return null;
    if (!userStore.currentUser) return null;
 
    const userId = getUserId(userStore.currentUser.id);
 
    // 查找当前用户在哪个reaction中
    for (const reaction of props.message.reactions)
    {
        if (reaction.userIds.includes(userId))
        {
            return reaction.emoji;
        }
    }
 
    return null;
});
 
// 点赞最多的3个reaction
const topReactions = computed(() =>
{
    if (!props.message.reactions) return [];
    return [...props.message.reactions]
        .sort((a, b) => b.userIds.length - a.userIds.length)
        .slice(0, 3);
});

// 获取当前聊天
const currentChat = computed(() => chatStore.chats.find(c => c.chatId === props.message.chatId));
 
// 是否显示未读图标（私聊 + 未读）
const showUnreadIcon = computed(() =>
{
    return currentChat.value?.isPrivate && props.message.readAt == null;
});


const showBurnCountdown = computed(() => typeof props.message.readAt === 'number' && typeof props.message.burn === 'number');
const showReadNoBurnIcon = computed(() => currentChat.value?.isPrivate && typeof props.message.readAt === 'number' && !showBurnCountdown.value);

// 计算SVG扇形路径
const countdownArcPath = computed(() =>
{
    if (remainingBurnSeconds.value <= 0 || !showBurnCountdown.value) return '';

    const totalSeconds = Math.floor((props.message.burn! - props.message.readAt!) / 1000);
    const ratio = remainingBurnSeconds.value / totalSeconds;

    // 计算扇形角度（从12点钟方向开始，顺时针）
    const startAngle = -Math.PI / 2; // 12点钟方向
    const endAngle = startAngle + (ratio * 2 * Math.PI);

    const cx = 12, cy = 12, r = 10;

    // 计算起点和终点
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    // 如果是完整圆，使用圆弧命令
    if (ratio >= 1) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;

    // 绘制扇形：从圆心到起点，圆弧到终点，回到圆心
    const largeArcFlag = ratio > 0.5 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
});

// Parse @ mentions from decrypted content
const contentChunks = computed(() =>
{
    if (decryptedContent.value === '[Decrypting...]' || decryptedContent.value === '[Key Not Available]' || decryptedContent.value === '[Decryption Error]')
    {
        return [{ type: 'text' as const, content: decryptedContent.value }];
    }
    
    // Get current chat members for validation
    const chat = chatStore.chats.find(c => c.chatId === props.message.chatId);
    const chatMembers = chat?.parsedOtherNames || [];
    
    // Parse mentions and check if username is in current chat
    const chunks = parseAtMentions(decryptedContent.value);
    return chunks.map(chunk => {
        if (chunk.type === 'at' && chunk.username)
        {
            const isValidMember = chatMembers.includes(chunk.username);
            return {
                type: 'at' as const,
                content: chunk.content,
                username: chunk.username,
                isValidMember
            };
        }
        return {
            type: 'text' as const,
            content: chunk.content
        };
    });
});
 
// Context menu items - 可扩展，根据消息类型和所有者动态生成
const contextMenuItems = computed<ContextMenuItem[]>(() =>
{
    const items: ContextMenuItem[] = [];
    const msgType = props.message.type.toLowerCase();
 
    // Add reply option for all message types
    items.push({ id: 'reply', label: 'Reply', icon: ReplyIcon });
 
    if (msgType === 'text')
        items.push({ id: 'copy', label: 'Copy', icon: CopyIcon });
 
    if (msgType === 'image' || msgType === 'video' || msgType === 'file')
        items.push({ id: 'download', label: 'Download', icon: DownloadIcon });
 
    if (isMe.value && msgType === 'text')
        items.push({ id: 'edit', label: 'Edit', icon: EditIcon });
 
    if (isMe.value)
        items.push({ id: 'delete', label: 'Delete', icon: DeleteIcon });
 
    return items;
});
 
// 是否应该显示上下文菜单
const shouldShowContextMenu = computed(() => contextMenuItems.value.length > 0);
 
function handleContextMenu(event: MouseEvent)
{
    if (!shouldShowContextMenu.value) return;
 
    contextMenuX.value = event.clientX;
    contextMenuY.value = event.clientY;
    contextMenuVisible.value = true;
}
 
function handleTouchStart(event: TouchEvent)
{
    if (!shouldShowContextMenu.value) return;
 
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
 
    touchTimer = setTimeout(() =>
    {
        // 阻止文字选中
        event.preventDefault();
 
        contextMenuX.value = touchStartX;
        contextMenuY.value = touchStartY;
        contextMenuVisible.value = true;
 
        // 触发触觉反馈（如果支持）
        if ('vibrate' in navigator)
        {
            navigator.vibrate(50);
        }
    }, LONG_PRESS_DURATION);
}
 
function handleTouchEnd()
{
    if (touchTimer)
    {
        clearTimeout(touchTimer);
        touchTimer = null;
    }
}
 
function handleTouchMove(event: TouchEvent)
{
    if (!touchTimer) return;
 
    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
 
    // 如果移动超过阈值，取消长按
    if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD)
    {
        clearTimeout(touchTimer);
        touchTimer = null;
    }
}
 
async function handleMenuSelect(item: ContextMenuItem)
{
    const msgType = props.message.type.toLowerCase();
 
    switch (item.id)
    {
        case 'reply':
            chatStore.setReplyingTo(props.message);
            break;
        case 'copy':
            await copyMessage();
            break;
        case 'download':
            if (msgType === 'image')
                await downloadImage();
            else if (msgType === 'video')
                await downloadVideo();
            else if (msgType === 'file')
                await downloadFile();
            break;
        case 'edit':
            editModalVisible.value = true;
            break;
        case 'delete':
            deleteMessage();
            break;
    }
}
 
// Reaction handlers
function handleAddReactionClick(event: MouseEvent)
{
    // 如果当前用户已经点赞了，点击add-reaction-btn应该取消点赞
    if (currentUserReaction.value)
    {
        sendPacket('toggle_reaction', {
            messageId: props.message.id,
            emoji: currentUserReaction.value
        });
        return;
    }
 
    // 否则打开emoji picker
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    emojiPickerX.value = rect.left;
    emojiPickerY.value = rect.bottom + 4;
    emojiPickerVisible.value = true;
}
 
function handleReactionsClick(event: MouseEvent)
{
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    reactionsPopupX.value = rect.left;
    reactionsPopupY.value = rect.bottom + 4;
    reactionsPopupVisible.value = true;
}
 
function handleEmojiSelect(emoji: string)
{
    if (!userStore.currentUser) return;
 
    // 如果点击的是当前已点过的emoji，则取消点赞
    if (currentUserReaction.value === emoji)
    {
        sendPacket('toggle_reaction', {
            messageId: props.message.id,
            emoji: emoji
        });
        return;
    }
 
    // 否则发送新的reaction
    sendPacket('toggle_reaction', {
        messageId: props.message.id,
        emoji: emoji
    });
}
 
function getUserMap(): Map<number, string>
{
    const userMap = new Map<number, string>();
 
    if (!props.message.reactions) return userMap;
 
    for (const reaction of props.message.reactions)
    {
        for (const userId of reaction.userIds)
        {
            // 可以从消息中获取senderName，或者从其他地方缓存
            // 这里简单使用userId作为key
            if (!userMap.has(userId))
            {
                userMap.set(userId, `User ${userId}`);
            }
        }
    }
 
    return userMap;
}
 
async function copyMessage()
{
    try
    {
        const text = decryptedContent.value;
        if (text && text !== '[Decrypting...]' && text !== '[Key Not Available]' && text !== '[Decryption Error]')
        {
            await navigator.clipboard.writeText(text);
            chatStore.showToast('Copied to clipboard', 'success');
        }
    }
    catch (e)
    {
        console.error('Failed to copy message', e);
        chatStore.showToast('Failed to copy', 'error');
    }
}
 
function openUserProfile()
{
    if (isMe.value) return;
    uiStore.navigateToProfile(props.message.senderId);
}
 
function handleUserClick(userId: number)
{
    if (!userStore.currentUser) return;
    if (userId === getUserId(userStore.currentUser.id)) return;
    uiStore.navigateToProfile(userId);
}
 
function handleAtClick(username: string | undefined)
{
    if (!username) return;
    // Try to find user by username in current chat
    const chat = chatStore.currentChat;
    if (!chat || !chat.parsedOtherIds || !chat.parsedOtherNames) return;
 
    // Parse chat members to find user ID by username
    const members = chat.parsedOtherIds.map((id, index) => ({
        id,
        name: chat.parsedOtherNames![index]
    }));
 
    const user = members.find(m => m.name === username);
    if (user)
    {
        uiStore.navigateToProfile(user.id);
    }
}
 
function deleteMessage()
{
    chatStore.editMessage(props.message.id, null);
}
 
async function detectImageExtension(blob: Blob): Promise<string>
{
    const buffer = await blob.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif';
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
    if (bytes[0] === 0x42 && bytes[1] === 0x4D) return 'bmp';
    return 'png'; // 默认
}
 
async function downloadImage()
{
    if (!imageUrl.value)
    {
        chatStore.showToast('Image not loaded', 'error');
        return;
    }
 
    try
    {
        // 从 blob URL 获取 blob
        const response = await fetch(imageUrl.value);
        const blob = await response.blob();
 
        // 检测图片格式
        const ext = await detectImageExtension(blob);
        const filename = `image_${props.message.id}.${ext}`;
 
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
 
        chatStore.showToast('Image downloaded', 'success');
    }
    catch (e)
    {
        console.error('Failed to download image', e);
        chatStore.showToast('Failed to download', 'error');
    }
}
 
function createPlaceholder(width: number, height: number): string
{
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.toDataURL('image/png');
}
 
async function decryptMessage()
{
    const key = chatKey.value;
    if (!key)
    {
        decryptedContent.value = '[Key Not Available]';
        return;
    }
 
    try
    {
        const msgType = props.message.type.toLowerCase();
 
        if (msgType === 'text')
        {
            decryptedContent.value = await decryptMessageString(props.message.content, key);
        }
        else if (msgType === 'image')
        {
            // 先解密元数据获取图片尺寸
            try
            {
                const metadata = JSON.parse(await decryptMessageString(props.message.content, key));
                if (typeof metadata.width === 'number' && typeof metadata.height === 'number')
                {
                    imageMetadata.value = { width: metadata.width, height: metadata.height };
                    imagePlaceholder.value = createPlaceholder(metadata.width, metadata.height);
                }
            }
            catch (e)
            {
                // 元数据解析失败，继续加载图片
            }
 
            // 加载实际图片
            const base64 = await fetchMessageFile(props.message.id);
            const imageData = await decryptMessageBytes(base64, key);
            const blob = new Blob([imageData]);
            imageUrl.value = URL.createObjectURL(blob);
        }
        else if (msgType === 'video')
        {
            // 解密视频元数据
            try
            {
                const metadata = JSON.parse(await decryptMessageString(props.message.content, key)) as VideoMetadata;
                videoMetadata.value = metadata;
 
                // 创建占位图
                if (metadata.width && metadata.height)
                {
                    videoPlaceholder.value = createPlaceholder(metadata.width, metadata.height);
                }
 
                // 解密并显示缩略图
                if (metadata.thumbnailBase64)
                {
                    const thumbnailBytes = Uint8Array.from(atob(metadata.thumbnailBase64), c => c.charCodeAt(0));
                    const blob = new Blob([thumbnailBytes], { type: 'image/jpeg' });
                    videoThumbnailUrl.value = URL.createObjectURL(blob);
                }
            }
            catch (e)
            {
                console.error('Failed to parse video metadata', e);
            }
        }
        else if (msgType === 'file')
        {
            // 解密文件元数据
            try
            {
                const metadata = JSON.parse(await decryptMessageString(props.message.content, key)) as FileMetadata;
                fileMetadata.value = metadata;
            }
            catch (e)
            {
                console.error('Failed to parse file metadata', e);
            }
        }
 
        // 同时解密引用消息内容
        if (props.message.replyTo)
        {
            decryptedReplyContent.value = await decryptReplyContent(props.message.replyTo);
        }
    }
    catch (e)
    {
        console.error('Message decryption error', e);
        decryptedContent.value = '[Decryption Error]';
    }
}
 
// 更新倒计时
function updateCountdown()
{
    if (!showBurnCountdown.value) return;
    const currentTime = Date.now() + uiStore.serverTimeOffset;
    const remaining = props.message.burn! - currentTime;
    if (remaining <= 0) remainingBurnSeconds.value = 0;
    else remainingBurnSeconds.value = Math.ceil(remaining / 1000);
}

// 启动倒计时定时器
function startCountdown()
{
    if (countdownTimer) clearInterval(countdownTimer);
    updateCountdown();
    
    if (showBurnCountdown.value && remainingBurnSeconds.value > 0)
        countdownTimer = setInterval(updateCountdown, 1000);
}

// 清理倒计时定时器
function stopCountdown()
{
    if (countdownTimer)
    {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

onMounted(() =>
{
    decryptMessage();
    startCountdown();
});

watch(() => ({ content: props.message.content, type: props.message.type, replyTo: props.message.replyTo }), decryptMessage);
watch(() => ({ chatId: props.message.chatId, readAt: props.message.readAt, burn: props.message.burn }), startCountdown);

onUnmounted(stopCountdown);

async function decryptReplyContent(replyTo: { content: string; type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE'; senderId: number; senderName: string; }): Promise<string>
{
    if (!chatKey.value)
    {
        return '[Key Not Available]';
    }
 
    try
    {
        // 引用消息的内容是加密的，需要先解密
        const decrypted = await decryptMessageString(replyTo.content, chatKey.value);
 
        // 如果有 type 字段，根据类型返回对应的显示文本
        if (replyTo.type)
        {
            const msgType = replyTo.type.toLowerCase();
            if (msgType === 'image') return '📷 Image';
            if (msgType === 'video') return '🎬 Video';
            if (msgType === 'file')
            {
                try
                {
                    const metadata = JSON.parse(decrypted);
                    return `📎 ${metadata.fileName || 'File'}`;
                }
                catch
                {
                    return '📎 File';
                }
            }
        }
 
        // 如果没有 type 字段（旧数据），尝试通过解密后的内容判断
        try
        {
            const metadata = JSON.parse(decrypted);
            if (typeof metadata.width === 'number' && typeof metadata.height === 'number')
            {
                if (metadata.duration !== undefined) return '🎬 Video';
                return '📷 Image';
            }
            if (metadata.fileName) return `📎 ${metadata.fileName}`;
        }
        catch
        {
            // 解析失败，说明是文本消息，直接返回解密后的内容
        }
 
        return decrypted;
    }
    catch (e)
    {
        console.error('Reply message decryption error', e);
        return '[Decryption Error]';
    }
}
 
function truncateReplyContent(content: string): string
{
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
}
 
async function openImageViewer()
{
    if (imageUrl.value)
    {
        viewingImageUrl.value = imageUrl.value;
        imageViewerVisible.value = true;
    }
}
 
async function handleReplyContentClick()
{
    if (!props.message.replyTo) return;
 
    // 先检查是否是图片
    const isImage = props.message.replyTo.type
        ? props.message.replyTo.type.toLowerCase() === 'image'
        : await isReplyContentImage();
 
    if (!isImage) return; // 不是图片，不做任何操作
 
    // 是图片，加载并显示
    try
    {
        const base64 = await fetchMessageFile(props.message.replyTo.messageId);
        const key = chatKey.value;
        if (key)
        {
            const imageData = await decryptMessageBytes(base64, key);
            const blob = new Blob([imageData]);
            const url = URL.createObjectURL(blob);
            viewingImageUrl.value = url;
            imageViewerVisible.value = true;
        }
    }
    catch (e)
    {
        console.error('Failed to load reply image', e);
        chatStore.showToast('Failed to load image', 'error');
    }
}
 
// 辅助函数：判断引用内容是否是图片（用于旧数据）
async function isReplyContentImage(): Promise<boolean>
{
    if (!chatKey.value) return false;
 
    try
    {
        const decrypted = await decryptMessageString(props.message.replyTo!.content, chatKey.value);
        const metadata = JSON.parse(decrypted);
        return typeof metadata.width === 'number' && typeof metadata.height === 'number';
    }
    catch
    {
        return false;
    }
}
 
// Video methods
function formatVideoDuration(seconds: number): string
{
    return formatDuration(seconds);
}
 
async function playVideo()
{
    if (videoUrl.value)
    {
        showVideoPlayer.value = true;
        return;
    }
 
    // Prevent duplicate downloads
    if (isDownloading.value)
    {
        return;
    }
 
    const key = chatKey.value;
    if (!key)
    {
        chatStore.showToast('Key not available', 'error');
        return;
    }
 
    try
    {
        isDownloading.value = true;
        downloadProgress.value = 1;
 
        // 下载并解密视频
        const base64 = await downloadFileApi(props.message.id, (loaded, total) =>
        {
            downloadProgress.value = Math.round((loaded / total) * 100);
        });
 
        const videoData = await decryptMessageBytes(base64, key);
        const blob = new Blob([videoData], { type: 'video/mp4' });
        videoUrl.value = URL.createObjectURL(blob);
        showVideoPlayer.value = true;
        downloadProgress.value = 0;
    }
    catch (e)
    {
        console.error('Failed to load video', e);
        chatStore.showToast('Failed to load video', 'error');
        downloadProgress.value = 0;
    }
    finally
    {
        isDownloading.value = false;
    }
}
 
function closeVideoPlayer()
{
    if (videoPlayer.value)
    {
        videoPlayer.value.pause();
    }
    showVideoPlayer.value = false;
}
 
function videoEnded()
{
    // Optional: auto close or loop
}
 
async function downloadVideo()
{
    if (!videoUrl.value)
    {
        await playVideo();
    }
 
    if (videoUrl.value)
    {
        const a = document.createElement('a');
        a.href = videoUrl.value;
        a.download = videoMetadata.value?.fileName || `video_${props.message.id}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        chatStore.showToast('Video downloaded', 'success');
    }
}
 
async function downloadFile()
{
    // Prevent duplicate downloads
    if (isDownloading.value)
    {
        return;
    }
 
    const key = chatKey.value;
    if (!key)
    {
        chatStore.showToast('Key not available', 'error');
        return;
    }
 
    try
    {
        isDownloading.value = true;
        downloadProgress.value = 1;
 
        // 下载并解密文件
        const base64 = await downloadFileApi(props.message.id, (loaded, total) =>
        {
            downloadProgress.value = Math.round((loaded / total) * 100);
        });
 
        const fileData = await decryptMessageBytes(base64, key);
        const mimeType = fileMetadata.value?.mimeType || 'application/octet-stream';
        const blob = new Blob([fileData], { type: mimeType });
        const url = URL.createObjectURL(blob);
 
        const a = document.createElement('a');
        a.href = url;
        a.download = fileMetadata.value?.fileName || `file_${props.message.id}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
 
        downloadProgress.value = 0;
        chatStore.showToast('File downloaded', 'success');
    }
    catch (e)
    {
        console.error('Failed to download file', e);
        chatStore.showToast('Failed to download file', 'error');
        downloadProgress.value = 0;
    }
    finally
    {
        isDownloading.value = false;
    }
}
</script>
 
<style scoped>
@font-face {
    font-family: 'Noto Color Emoji';
    src: url('@/assets/fonts/NotoColorEmoji.ttf') format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
}
 
.message {
    max-width: 70%;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    word-wrap: break-word;
    position: relative;
    animation: fadeIn 0.3s ease;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
}
 
.message.sent {
    align-self: flex-end;
    background-color: var(--primary-color);
    color: white;
}
 
.message.received {
    align-self: flex-start;
    background-color: var(--panel-bg);
    border: 1px solid var(--border-color);
}
 
.message-sender {
    font-size: 0.75em;
    font-weight: bold;
    color: var(--primary-color);
    margin-bottom: 2px;
    opacity: 0.9;
    cursor: pointer;
}
 
.sender-avatar-wrapper {
    position: absolute;
    top: 0;
    left: -40px;
    width: 32px;
    height: 32px;
}
 
.sender-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    cursor: pointer;
}
 
.donor-badge {
    position: absolute;
    bottom: -3px;
    right: -3px;
    width: 15px;
    height: 15px;
}
 
.content {
    word-break: break-word;
    white-space: pre-wrap;
}
 
.reply-info {
    padding: 6px 10px;
    margin-bottom: 6px;
    border-left: 3px solid var(--primary-color);
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
}
 
.message.sent .reply-info {
    border-left-color: rgba(255, 255, 255, 0.7);
    background-color: rgba(255, 255, 255, 0.15);
}
 
.reply-sender {
    font-weight: bold;
    font-size: 0.85em;
    margin-right: 6px;
}
 
.reply-content {
    font-size: 0.9em;
    opacity: 0.8;
    font-style: italic;
}
 
.reply-content.clickable {
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-decoration-color: rgba(0, 0, 0, 0.3);
}
 
.at-mention {
    color: var(--primary-color);
    font-weight: bold;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-decoration-color: rgba(0, 0, 0, 0.3);
}
 
.message.sent .at-mention {
    color: white;
    text-decoration-color: rgba(255, 255, 255, 0.3);
}
 
.message.sent .reply-content.clickable {
    text-decoration-color: rgba(255, 255, 255, 0.3);
}
 
.image-container {
    position: relative;
}
 
.image-wrapper {
    position: relative;
    cursor: pointer;
    display: inline-block;
}
 
.image-hint {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 4px 8px;
    font-size: 12px;
    text-align: center;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
}
 
.image-wrapper:hover .image-hint {
    opacity: 1;
}
 
.message-image {
    max-width: 100%;
    max-height: 300px;
    border-radius: 4px;
    display: block;
}
 
.placeholder-image {
    opacity: 0;
}
 
.image-wrapper.overlay-image {
    position: absolute;
    top: 0;
    left: 0;
}
 
.loading-image {
    padding: 20px;
    text-align: center;
    color: var(--secondary-color);
}
 
/* Video styles */
.video-container {
    position: relative;
}
 
.video-thumbnail-wrapper {
    position: relative;
    cursor: pointer;
    display: inline-block;
}
 
.video-thumbnail {
    max-width: 100%;
    max-height: 300px;
    border-radius: 4px;
    display: block;
}
 
.video-play-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: background-color 0.2s;
}
 
.video-thumbnail-wrapper:hover .video-play-overlay {
    background-color: rgba(0, 0, 0, 0.8);
}
 
.video-play-overlay svg {
    width: 30px;
    height: 30px;
    margin-left: 4px;
}
 
.video-duration {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
}
 
.video-player-wrapper {
    position: relative;
}
 
.video-player {
    max-width: 100%;
    max-height: 400px;
    border-radius: 4px;
}
 
.video-close-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: var(--panel-bg);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    line-height: 1;
}
 
.video-close-btn:hover {
    background-color: var(--hover-color);
}
 
.loading-video {
    padding: 20px;
    text-align: center;
    color: var(--secondary-color);
}
 
.download-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 0 0 4px 4px;
    overflow: hidden;
}
 
.download-progress-bar {
    height: 100%;
    background-color: var(--primary-color);
    transition: width 0.2s;
}
 
.message.sent .download-progress-bar {
    background-color: rgba(255, 255, 255, 0.8);
}
 
.message.sent .download-progress {
    background-color: rgba(255, 255, 255, 0.3);
}
 
.download-progress-text {
    position: absolute;
    top: -20px;
    right: 8px;
    font-size: 12px;
    color: white;
    background-color: rgba(0, 0, 0, 0.6);
    padding: 2px 6px;
    border-radius: 4px;
}
 
/* File styles */
.file-container {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    position: relative;
    min-width: 200px;
}
 
.message.sent .file-container {
    background-color: rgba(255, 255, 255, 0.15);
}
 
.file-container:hover {
    background-color: rgba(0, 0, 0, 0.15);
}
 
.message.sent .file-container:hover {
    background-color: rgba(255, 255, 255, 0.25);
}
 
.file-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--primary-color);
    border-radius: 8px;
    color: white;
}
 
.file-icon svg {
    width: 24px;
    height: 24px;
}
 
.file-info {
    flex: 1;
    overflow: hidden;
}
 
.file-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}
 
.file-size {
    font-size: 0.85em;
    opacity: 0.7;
    margin-top: 2px;
}
 
.file-download-icon {
    opacity: 0.6;
}
 
.file-download-icon svg {
    width: 20px;
    height: 20px;
}
 
.file-download-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 0 0 8px 8px;
    overflow: hidden;
}
 
.file-download-bar {
    height: 100%;
    background-color: var(--primary-color);
    transition: width 0.2s;
}
 
.message.sent .file-download-bar {
    background-color: rgba(255, 255, 255, 0.8);
}
 
.message.sent .file-download-progress {
    background-color: rgba(255, 255, 255, 0.3);
}
 
.meta {
    font-size: 0.7em;
    margin-top: 4px;
    opacity: 0.7;
}
 
.meta-section {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
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
 
.message.sent .reactions-summary {
    background: rgba(255, 255, 255, 0.2);
}
 
.reactions-summary:hover {
    background: rgba(0, 0, 0, 0.1);
}
 
.message.sent .reactions-summary:hover {
    background: rgba(255, 255, 255, 0.3);
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
 
.message.sent .add-reaction-btn:hover {
    background: rgba(255, 255, 255, 0.2);
}
 
.add-reaction-btn svg {
    width: 16px;
    height: 16px;
}
 
.current-reaction-emoji {
    font-size: 16px;
    line-height: 1;
    font-family: 'Noto Color Emoji';
}

.message-status-icon {
    width: 16px;
    height: 16px;
    opacity: 0.5;
    transition: opacity 0.15s ease;
    margin-left: -5px;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
 
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
