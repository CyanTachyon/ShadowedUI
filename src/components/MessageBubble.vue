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
                    <img v-if="imageUrl" :src="imageUrl" class="message-image" :class="{ 'overlay-image': imageMetadata }" alt="Image" />
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

const props = defineProps<{
    message: Message;
}>();

const chatStore = useChatStore();
const userStore = useUserStore();

const decryptedContent = ref<string>('[Decrypting...]');
const imageUrl = ref<string | null>(null);
const imagePlaceholder = ref<string | null>(null);
const imageMetadata = ref<{ width: number; height: number; } | null>(null);

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

// Context menu items - 可扩展，根据消息类型和所有者动态生成
const contextMenuItems = computed<ContextMenuItem[]>(() =>
{
    const items: ContextMenuItem[] = [];
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
    }
    catch (e)
    {
        console.error('Message decryption error', e);
        decryptedContent.value = '[Decryption Error]';
    }
}

onMounted(decryptMessage);
watch(() => ({ content: props.message.content, type: props.message.type }), decryptMessage);
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

.image-container {
    position: relative;
}

.message-image {
    max-width: 100%;
    max-height: 300px;
    border-radius: 4px;
}

.placeholder-image {
    opacity: 0;
}

.overlay-image {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
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
