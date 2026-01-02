<template>
    <div class="input-area">
        <!-- Upload progress -->
        <UploadProgressBar v-if="currentUploadTask" :task="currentUploadTask" @pause="pauseUpload" @resume="resumeUpload" @cancel="cancelCurrentUpload" />

        <!-- Reply preview -->
        <div v-if="chatStore.replyingToMessage" class="reply-preview">
            <div class="reply-preview-header">
                <span class="reply-preview-label">Replying to {{ chatStore.replyingToMessage.senderName }}:</span>
                <button class="reply-cancel-btn" @click="chatStore.clearReplyingTo()">
                    <CloseIcon />
                </button>
            </div>
            <div class="reply-preview-content">{{ decryptedReplyContent ? truncateReplyContent(decryptedReplyContent) : '[Decrypting...]' }}</div>
        </div>

        <div class="input-area-inner">
            <textarea id="message-in" v-model="messageText" :placeholder="placeholder" :disabled="!canSend" @keydown="handleKeyDown" @paste="handlePaste" @compositionstart="isComposing = true" @compositionend="isComposing = false"></textarea>

            <button v-if="chatStore.isBroadcastView" :class="['anon-btn', { active: isAnonymous }]" @click="isAnonymous = !isAnonymous">
                anon
            </button>

            <!-- Media menu button -->
            <div v-if="!chatStore.isBroadcastView" class="media-menu-container">
                <button class="button media-btn" :disabled="!canSend || isUploading" @click="toggleMediaMenu">
                    <PlusIcon />
                </button>
                <!-- Media selection menu -->
                <div v-if="showMediaMenu" class="media-menu" @click.stop>
                    <button class="media-menu-item" @click="selectMedia('image')">
                        <ImageIcon />
                        <span>Image</span>
                    </button>
                    <button class="media-menu-item" @click="selectMedia('video')">
                        <VideoIcon />
                        <span>Video</span>
                    </button>
                    <button class="media-menu-item" @click="selectMedia('file')">
                        <FileIcon />
                        <span>File</span>
                    </button>
                </div>
            </div>

            <button class="button send-btn" :disabled="!canSend" @click="send">Send</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRaw } from 'vue';
import { useChatStore, useUserStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { sendFileMessage, initChunkedUpload, uploadChunk, completeUpload, cancelUpload } from '@/services/api';
import { encryptMessageString, encryptMessageBytes, decryptMessageString, exportSymmetricKey, importSymmetricKey, encryptLargeFile } from '@/utils/crypto';
import { isMobileDevice, getImageSizeFromArrayBuffer, generateVideoThumbnail, formatFileSize } from '@/utils/helpers';
import CloseIcon from './icons/CloseIcon.vue';
import PlusIcon from './icons/PlusIcon.vue';
import ImageIcon from './icons/ImageIcon.vue';
import VideoIcon from './icons/VideoIcon.vue';
import FileIcon from './icons/FileIcon.vue';
import UploadProgressBar from './UploadProgressBar.vue';
import type { UploadTask } from '@/types';
import {
    saveUploadTask,
    deleteUploadTask,
    getIncompleteTasks,
    updateTaskStatus,
    updateUploadedChunks,
    saveChunkData,
    getChunkData,
    generateTaskId,
    deleteTaskChunks
} from '@/services/uploadManager';

const chatStore = useChatStore();
const userStore = useUserStore();

const messageText = ref('');
const decryptedReplyContent = ref<string>('');
const isAnonymous = ref(false);
const isComposing = ref(false);
const showMediaMenu = ref(false);
const isUploading = ref(false);
const isPaused = ref(false);
const currentUploadTask = ref<UploadTask | null>(null);

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 1024 * 1024 * 1024; // 1GB
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

const canSend = computed(() => chatStore.isBroadcastView || chatStore.currentChatId !== null);

const placeholder = computed(() =>
{
    return chatStore.isBroadcastView ? 'Send broadcast...' : 'Type a message...';
});

// Close media menu when clicking outside
function handleClickOutside(e: MouseEvent)
{
    const target = e.target as HTMLElement;
    if (!target.closest('.media-menu-container'))
    {
        showMediaMenu.value = false;
    }
}

onMounted(() =>
{
    document.addEventListener('click', handleClickOutside);
    checkPendingUploads();
});

onUnmounted(() =>
{
    document.removeEventListener('click', handleClickOutside);
});

// Check for pending uploads on mount
async function checkPendingUploads()
{
    try
    {
        const pendingTasks = await getIncompleteTasks();
        if (pendingTasks.length > 0)
        {
            const task = pendingTasks[0];
            // Load the task into currentUploadTask so UploadProgressBar shows it
            currentUploadTask.value = task;
            chatStore.showToast(
                `${pendingTasks.length} incomplete upload(s) found. Click to resume.`,
                'info',
                () => resumeUploadTask(task)
            );
        }
    }
    catch (e)
    {
        console.error('Failed to check pending uploads:', e);
    }
}

// Watch for reply message changes and decrypt content
watch(() => chatStore.replyingToMessage, async (newMessage) =>
{
    if (newMessage && chatStore.currentChatId)
    {
        const chatKey = chatStore.getChatKey(chatStore.currentChatId);
        if (chatKey)
        {
            try
            {
                decryptedReplyContent.value = await decryptReplyContent(newMessage, chatKey);
            }
            catch (e)
            {
                console.error('Failed to decrypt reply content', e);
                decryptedReplyContent.value = '[Decryption Error]';
            }
        }
        else
        {
            decryptedReplyContent.value = '[Key Not Available]';
        }
    }
    else
    {
        decryptedReplyContent.value = '';
    }
}, { immediate: true });

async function decryptReplyContent(replyTo: { content: string; type: string; senderId: number; senderName?: string; }, chatKey: CryptoKey): Promise<string>
{
    try
    {
        const msgType = replyTo.type.toLowerCase();
        if (msgType === 'image') return '📷 Image';
        if (msgType === 'video') return '🎬 Video';
        if (msgType === 'file') return '📎 File';

        const decrypted = await decryptMessageString(replyTo.content, chatKey);
        return decrypted;
    }
    catch (e)
    {
        console.error('Reply message decryption error', e);
        return '[Decryption Error]';
    }
}

function toggleMediaMenu()
{
    showMediaMenu.value = !showMediaMenu.value;
}

function selectMedia(type: 'image' | 'video' | 'file')
{
    showMediaMenu.value = false;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';

    switch (type)
    {
        case 'image':
            fileInput.accept = 'image/*';
            break;
        case 'video':
            fileInput.accept = 'video/*';
            break;
        case 'file':
            fileInput.accept = '*/*';
            break;
    }

    fileInput.onchange = async () =>
    {
        const file = fileInput.files?.[0];
        if (!file) return;

        // Check file size
        const maxSize = type === 'image' ? MAX_IMAGE_SIZE : (type === 'video' ? MAX_VIDEO_SIZE : MAX_FILE_SIZE);
        if (file.size > maxSize)
        {
            chatStore.showToast(`File too large! Max size is ${formatFileSize(maxSize)}`, 'error');
            return;
        }

        if (type === 'image')
        {
            await sendImage(file);
        }
        else if (type === 'video')
        {
            await sendVideo(file);
        }
        else
        {
            await sendFile(file);
        }
    };

    fileInput.click();
}

async function sendImage(file: File)
{
    if (!chatStore.currentChatId) return;

    const chatKey = chatStore.getChatKey(chatStore.currentChatId);
    if (!chatKey)
    {
        chatStore.showToast('Chat key not loaded!', 'error');
        return;
    }

    try
    {
        chatStore.showToast('Processing image...', 'info');

        const arrayBuffer = await file.arrayBuffer();
        const { width, height } = await getImageSizeFromArrayBuffer(arrayBuffer);

        const encrypted = await encryptMessageBytes(arrayBuffer, chatKey);
        const metadata = await encryptMessageString(
            JSON.stringify({ width, height, size: file.size }),
            chatKey
        );

        if (encrypted.length > MAX_IMAGE_SIZE)
        {
            chatStore.showToast('Image too large after encryption!', 'error');
            return;
        }

        chatStore.showToast('Uploading image...', 'info');

        await sendFileMessage(
            encrypted,
            metadata,
            chatStore.currentChatId!,
            userStore.currentUser!.username,
            userStore.authToken!,
            'IMAGE'
        );

        chatStore.showToast('Image sent!', 'success');
    }
    catch (e: any)
    {
        console.error('Image upload failed', e);
        chatStore.showToast('Failed to upload image: ' + e.message, 'error');
    }
}

async function sendVideo(file: File)
{
    if (!chatStore.currentChatId) return;

    const chatKey = chatStore.getChatKey(chatStore.currentChatId);
    if (!chatKey)
    {
        chatStore.showToast('Chat key not loaded!', 'error');
        return;
    }

    try
    {
        chatStore.showToast('Processing video...', 'info');

        // Generate thumbnail
        const { thumbnail, width, height, duration } = await generateVideoThumbnail(file);
        const thumbnailArrayBuffer = await thumbnail.arrayBuffer();
        const thumbnailBase64 = btoa(String.fromCharCode(...new Uint8Array(thumbnailArrayBuffer)));

        // Create metadata
        const metadata = {
            width,
            height,
            duration,
            size: file.size,
            fileName: file.name,
            thumbnailBase64
        };

        // Encrypt metadata
        const encryptedMetadata = await encryptMessageString(JSON.stringify(metadata), chatKey);

        // Use chunked encryption to avoid UI freeze
        chatStore.showToast('Encrypting video...', 'info');
        const encrypted = await encryptLargeFile(file, chatKey);

        // Use chunked upload for large files
        await uploadLargeFile(encrypted, encryptedMetadata, 'VIDEO', file.name, chatKey);
    }
    catch (e: any)
    {
        console.error('Video upload failed', e);
        chatStore.showToast('Failed to upload video: ' + e.message, 'error');
    }
}

async function sendFile(file: File)
{
    if (!chatStore.currentChatId) return;

    const chatKey = chatStore.getChatKey(chatStore.currentChatId);
    if (!chatKey)
    {
        chatStore.showToast('Chat key not loaded!', 'error');
        return;
    }

    try
    {
        chatStore.showToast('Processing file...', 'info');

        // Create metadata
        const metadata = {
            fileName: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream'
        };

        // Encrypt metadata
        const encryptedMetadata = await encryptMessageString(JSON.stringify(metadata), chatKey);

        // Use chunked encryption to avoid UI freeze
        chatStore.showToast('Encrypting file...', 'info');
        const encrypted = await encryptLargeFile(file, chatKey);

        // Use chunked upload for large files
        await uploadLargeFile(encrypted, encryptedMetadata, 'FILE', file.name, chatKey);
    }
    catch (e: any)
    {
        console.error('File upload failed', e);
        chatStore.showToast('Failed to upload file: ' + e.message, 'error');
    }
}

async function uploadLargeFile(
    encryptedData: string,
    encryptedMetadata: string,
    messageType: 'VIDEO' | 'FILE',
    fileName: string,
    chatKey: CryptoKey
)
{
    if (!chatStore.currentChatId) return;

    const encryptedBytes = new TextEncoder().encode(encryptedData);
    const totalSize = encryptedBytes.length;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    // Export chat key for storage
    const chatKeyRaw = await exportSymmetricKey(chatKey);

    // Create upload task
    const task: UploadTask = {
        id: generateTaskId(),
        chatId: chatStore.currentChatId,
        fileName,
        fileType: messageType,
        totalSize: totalSize,
        encryptedSize: totalSize,
        chunkSize: CHUNK_SIZE,
        totalChunks,
        uploadedChunks: [],
        chatKeyJwk: chatKeyRaw,
        metadata: encryptedMetadata,
        createdAt: Date.now(),
        status: 'pending'
    };

    // Save task to IndexedDB
    await saveUploadTask(task);

    // Store encrypted chunks in IndexedDB
    chatStore.showToast('Preparing upload...', 'info');
    for (let i = 0; i < totalChunks; i++)
    {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunkData = encryptedBytes.slice(start, end).buffer;
        await saveChunkData(task.id, i, chunkData);
    }

    // Start upload
    await startUpload(task);
}

async function startUpload(task: UploadTask)
{
    if (!userStore.currentUser || !userStore.authToken) return;
    if (isPaused.value) return;

    isUploading.value = true;
    isPaused.value = false;
    currentUploadTask.value = task;
    task.status = 'uploading';
    await saveUploadTask(toRaw(task));

    try
    {
        // Initialize upload on server only if not already initialized
        if (!task.serverUploadId)
        {
            const initResponse = await initChunkedUpload(
                task.chatId,
                task.fileType,
                task.metadata,
                task.totalChunks,
                task.encryptedSize,
                userStore.currentUser.username,
                userStore.authToken
            );

            task.serverUploadId = initResponse.uploadId;
            await saveUploadTask(toRaw(task));
        }

        // Upload chunks
        for (let i = 0; i < task.totalChunks; i++)
        {
            // Skip already uploaded chunks
            if (task.uploadedChunks.includes(i)) continue;

            // Check if paused
            if (isPaused.value)
            {
                task.status = 'paused';
                await saveUploadTask(toRaw(task));
                // Force UI update
                currentUploadTask.value = { ...toRaw(task) };
                return;
            }

            // Get chunk data from IndexedDB
            const chunkData = await getChunkData(task.id, i);
            if (!chunkData)
            {
                throw new Error(`Chunk ${i} not found in storage`);
            }

            await uploadChunk(
                task.serverUploadId!,
                i,
                chunkData,
                userStore.currentUser!.username,
                userStore.authToken!
            );

            // Update progress
            task.uploadedChunks.push(i);
            await updateUploadedChunks(task.id, task.uploadedChunks);
            currentUploadTask.value = { ...task };
        }

        // Complete upload
        await completeUpload(
            task.serverUploadId!,
            userStore.currentUser!.username,
            userStore.authToken!
        );

        // Clean up
        task.status = 'completed';
        await deleteUploadTask(task.id);
        await deleteTaskChunks(task.id);

        chatStore.showToast('Upload complete!', 'success');
    }
    catch (e: any)
    {
        console.error('Upload failed:', e);
        task.status = 'failed';
        await updateTaskStatus(task.id, 'failed');
        chatStore.showToast('Upload failed: ' + e.message, 'error');
    }
    finally
    {
        // Only clear if completed or failed, not if paused
        if (task.status === 'completed' || task.status === 'failed')
        {
            isUploading.value = false;
            currentUploadTask.value = null;
        }
        else if (task.status === 'paused')
        {
            isUploading.value = false;
            // Keep currentUploadTask so UploadProgressBar shows resume button
        }
    }
}

async function resumeUploadTask(task: UploadTask)
{
    if (!userStore.currentUser || !userStore.authToken) return;

    // Restore chat key
    const chatKey = await importSymmetricKey(task.chatKeyJwk);
    if (!chatKey)
    {
        chatStore.showToast('Failed to restore encryption key', 'error');
        await deleteUploadTask(task.id);
        currentUploadTask.value = null;
        return;
    }

    // Start/resume upload
    await startUpload(task);
}

function pauseUpload()
{
    if (currentUploadTask.value)
    {
        isPaused.value = true;
        const task = toRaw(currentUploadTask.value);
        task.status = 'paused';
        // Force UI update by creating new ref
        currentUploadTask.value = { ...task };
        updateTaskStatus(task.id, 'paused');
        chatStore.showToast('Upload paused', 'info');
    }
}

async function resumeUpload()
{
    if (currentUploadTask.value)
    {
        isPaused.value = false;
        const task = toRaw(currentUploadTask.value);
        await resumeUploadTask(task);
    }
}

async function cancelCurrentUpload()
{
    if (currentUploadTask.value)
    {
        const task = currentUploadTask.value;

        // Cancel on server if upload was initialized
        if (task.serverUploadId && userStore.currentUser && userStore.authToken)
        {
            try
            {
                await cancelUpload(task.serverUploadId, userStore.currentUser.username, userStore.authToken);
            }
            catch (e)
            {
                console.error('Failed to cancel upload on server:', e);
            }
        }

        // Clean up local storage
        await deleteUploadTask(task.id);
        await deleteTaskChunks(task.id);

        currentUploadTask.value = null;
        isUploading.value = false;
        chatStore.showToast('Upload cancelled', 'info');
    }
}

function handlePaste(e: ClipboardEvent)
{
    if (!canSend.value || isUploading.value)
    {
        e.preventDefault();
        return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    // Check if any file is pasted
    const files: File[] = [];
    for (let i = 0; i < items.length; i++)
    {
        const item = items[i];
        if (item.kind === 'file')
        {
            const file = item.getAsFile();
            if (file)
            {
                files.push(file);
            }
        }
    }

    if (files.length === 0)
    {
        // Allow normal text paste
        return;
    }

    // Prevent default paste behavior for files
    e.preventDefault();

    // Process each pasted file
    files.forEach(file => {
        processPastedFile(file);
    });
}

function processPastedFile(file: File)
{
    // Determine file type based on MIME type
    const mimeType = file.type.toLowerCase();

    if (mimeType.startsWith('image/'))
    {
        // Handle image
        if (file.size > MAX_IMAGE_SIZE)
        {
            chatStore.showToast(`Image too large! Max size is ${formatFileSize(MAX_IMAGE_SIZE)}`, 'error');
            return;
        }
        sendImage(file);
    }
    else if (mimeType.startsWith('video/'))
    {
        // Handle video
        if (file.size > MAX_VIDEO_SIZE)
        {
            chatStore.showToast(`Video too large! Max size is ${formatFileSize(MAX_VIDEO_SIZE)}`, 'error');
            return;
        }
        sendVideo(file);
    }
    else
    {
        // Handle as general file
        if (file.size > MAX_FILE_SIZE)
        {
            chatStore.showToast(`File too large! Max size is ${formatFileSize(MAX_FILE_SIZE)}`, 'error');
            return;
        }
        sendFile(file);
    }
}

function handleKeyDown(e: KeyboardEvent)
{
    if (e.key === 'Enter')
    {
        if (isComposing.value) return;

        if (!!isMobileDevice() === !!e.shiftKey)
        {
            e.preventDefault();
            send();
        }
    }
}

async function send()
{
    const text = messageText.value.trim();
    if (!text) return;

    if (chatStore.isBroadcastView)
        sendBroadcast(text);
    else
        await sendMessage(text);
}

function sendBroadcast(text: string)
{
    wsService.sendPacket('send_broadcast', {
        message: text,
        anonymous: isAnonymous.value
    });
    messageText.value = '';
}

async function sendMessage(text: string)
{
    if (!chatStore.currentChatId) return;

    const chatKey = chatStore.getChatKey(chatStore.currentChatId);
    if (!chatKey)
    {
        chatStore.showToast('Chat key not loaded!', 'error');
        return;
    }

    try
    {
        const encrypted = await encryptMessageString(text, chatKey);
        const replyTo = chatStore.replyingToMessage?.id || null;

        wsService.sendPacket('send_message', {
            chatId: chatStore.currentChatId,
            message: encrypted,
            type: 'text',
            replyTo
        });
        messageText.value = '';
        chatStore.clearReplyingTo();
    }
    catch (e: any)
    {
        console.error('Encrypt failed', e);
        chatStore.showToast('Failed to encrypt message: ' + e.message, 'error');
    }
}

function truncateReplyContent(content: string): string
{
    return content.length > 60 ? content.substring(0, 60) + '...' : content;
}
</script>

<style scoped>
.input-area {
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    background-color: var(--panel-bg);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.input-area-inner {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
}

.reply-preview {
    background-color: var(--input-bg);
    border-left: 3px solid var(--primary-color);
    padding: 6px 10px;
    border-radius: 4px;
    animation: slideDown 0.2s ease;
}

.reply-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.reply-preview-label {
    font-size: 0.85em;
    font-weight: bold;
    color: var(--primary-color);
}

.reply-cancel-btn {
    background: none;
    border: none;
    color: var(--secondary-color);
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
}

.reply-cancel-btn:hover {
    background-color: var(--secondary-color);
    color: var(--input-bg);
}

.reply-preview-content {
    font-size: 0.9em;
    opacity: 0.8;
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

#message-in {
    flex: 1;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background-color: var(--input-bg);
    color: var(--text-color);
    resize: none;
    font-family: inherit;
    min-height: 30px;
    max-height: 100px;
}

.button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
}

.button:hover {
    filter: brightness(1.1);
}

.button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.media-menu-container {
    position: relative;
}

.media-btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}

.media-menu {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    background-color: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 120px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

.media-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(--text-color);
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.2s;
    font-size: 14px;
}

.media-menu-item:hover {
    background-color: var(--hover-color);
}

.media-menu-item svg {
    width: 18px;
    height: 18px;
    opacity: 0.8;
}

.send-btn {
    width: auto;
    height: 30px;
}

.anon-btn {
    background-color: var(--panel-bg);
    color: var(--secondary-color);
    border: 1px solid var(--border-color);
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: all 0.2s;
    height: 30px;
    display: flex;
    align-items: center;
}

.anon-btn:hover {
    border-color: var(--primary-color);
}

.anon-btn.active {
    background-color: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
}
</style>
