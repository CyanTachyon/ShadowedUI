<template>
    <div 
        :class="['message', isMe ? 'sent' : 'received']" 
        :style="{ marginLeft: showSender ? '40px' : '0' }"
        @contextmenu.prevent="handleContextMenu"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
        @touchmove="handleTouchMove"
    >
        <!-- Sender info for group chats -->
        <template v-if="showSender">
            <div class="message-sender">{{ message.senderName || `User ${message.senderId}` }}</div>
            <img :src="getAvatarUrl(message.senderId)" class="sender-avatar" alt="avatar" loading="lazy" />
        </template>

        <!-- Message content -->
        <div class="content">
            <!-- Reply info -->
            <div v-if="message.replyTo" class="reply-info" @click="handleReplyContentClick">
                <span class="reply-sender">{{ message.replyTo.senderName }}:</span>
                <span class="reply-content" :class="{ 'clickable': isReplyToImage }">{{ decryptedReplyContent ? truncateContent(decryptedReplyContent) : '[Decrypting...]' }}</span>
            </div>

            <template v-if="!chatKey">
                [Key Not Available]
            </template>
            <template v-else-if="message.type.toLowerCase() === 'text'">
                {{ decryptedContent }}
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
        </div>

        <!-- Metadata -->
        <div class="meta" :style="{ textAlign: isMe ? 'right' : 'left' }">
            {{ formatDate(message.time) }}
        </div>
    </div>

    <!-- Context Menu -->
    <ContextMenu
        :visible="contextMenuVisible"
        :x="contextMenuX"
        :y="contextMenuY"
        :items="contextMenuItems"
        @close="contextMenuVisible = false"
        @select="handleMenuSelect"
    />

    <!-- Edit Message Modal -->
    <EditMessageModal
        :visible="editModalVisible"
        :message="message"
        @close="editModalVisible = false"
    />

    <!-- Image Viewer Modal -->
    <ImageViewerModal
        :visible="imageViewerVisible"
        :imageUrl="viewingImageUrl"
        @close="imageViewerVisible = false"
    />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { Message } from '@/types';
import { useChatStore, useUserStore } from '@/stores';
import { decryptMessageString, decryptMessageBytes } from '@/utils/crypto';
import { getAvatarUrl, formatDate, getUserId } from '@/utils/helpers';
import { fetchMessageFile } from '@/services/api';
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue';
import EditMessageModal from './modals/EditMessageModal.vue';
import ImageViewerModal from './modals/ImageViewerModal.vue';

const props = defineProps<{
    message: Message;
}>();

const chatStore = useChatStore();
const userStore = useUserStore();

const decryptedContent = ref<string>('[Decrypting...]');
const decryptedReplyContent = ref<string>('');
const imageUrl = ref<string | null>(null);
const imagePlaceholder = ref<string | null>(null);
const imageMetadata = ref<{ width: number; height: number; } | null>(null);
const viewingImageUrl = ref<string | null>(null);
const imageViewerVisible = ref(false);

// Context menu state
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const editModalVisible = ref(false);

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

// Context menu items - 可扩展，根据消息类型和所有者动态生成
const contextMenuItems = computed<ContextMenuItem[]>(() =>
{
    const items: ContextMenuItem[] = [];
    // Add reply option for both text and image messages
    items.push({ id: 'reply', label: 'Reply', icon: '↩️' });
    if (props.message.type.toLowerCase() === 'text')
        items.push({ id: 'copy', label: 'Copy', icon: '📋' });
    if (props.message.type.toLowerCase() === 'image')
        items.push({ id: 'download', label: 'Download', icon: '💾' });
    if (isMe.value && props.message.type.toLowerCase() === 'text')
        items.push({ id: 'edit', label: 'Edit', icon: '✏️' });
    if (isMe.value)
        items.push({ id: 'delete', label: 'Delete', icon: '🗑️' });

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
    switch (item.id)
    {
        case 'reply':
            chatStore.setReplyingTo(props.message);
            break;
        case 'copy':
            await copyMessage();
            break;
        case 'download':
            await downloadImage();
            break;
        case 'edit':
            editModalVisible.value = true;
            break;
        case 'delete':
            deleteMessage();
            break;
    }
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
        if (props.message.type.toLowerCase() === 'text')
        {
            decryptedContent.value = await decryptMessageString(props.message.content, key);
        }
        else if (props.message.type.toLowerCase() === 'image')
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

onMounted(decryptMessage);
watch(() => ({ content: props.message.content, type: props.message.type, replyTo: props.message.replyTo }), decryptMessage);

async function decryptReplyContent(replyTo: { content: string; type?: 'TEXT' | 'IMAGE'; senderId: number; senderName: string; }): Promise<string>
{
    if (!chatKey.value)
    {
        return '[Key Not Available]';
    }

    try
    {
        // 引用消息的内容是加密的，需要先解密
        const decrypted = await decryptMessageString(replyTo.content, chatKey.value);

        // 如果有 type 字段且是图片，直接返回 "Image"
        if (replyTo.type && replyTo.type.toLowerCase() === 'image')
        {
            return '📷 Image';
        }

        // 如果没有 type 字段（旧数据），尝试通过解密后的内容判断
        try
        {
            const metadata = JSON.parse(decrypted);
            if (typeof metadata.width === 'number' && typeof metadata.height === 'number')
            {
                return '📷 Image';
            }
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

function truncateContent(content: string): string
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
</script>

<style scoped>
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
}

.sender-avatar {
    position: absolute;
    top: 0;
    left: -40px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
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

.meta {
    font-size: 0.7em;
    margin-top: 4px;
    opacity: 0.7;
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
