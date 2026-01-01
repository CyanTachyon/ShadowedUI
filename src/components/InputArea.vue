<template>
    <div class="input-area">
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
            <textarea id="message-in" v-model="messageText" :placeholder="placeholder" :disabled="!canSend" @keydown="handleKeyDown" @compositionstart="isComposing = true" @compositionend="isComposing = false"></textarea>

            <button v-if="chatStore.isBroadcastView" :class="['anon-btn', { active: isAnonymous }]" @click="isAnonymous = !isAnonymous">
                anon
            </button>

            <button v-if="!chatStore.isBroadcastView" class="button media-btn" :disabled="!canSend" @click="sendImage">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                </svg>
            </button>

            <button class="button send-btn" :disabled="!canSend" @click="send">Send</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useChatStore, useUserStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { sendFileMessage } from '@/services/api';
import { encryptMessageString, encryptMessageBytes, decryptMessageString } from '@/utils/crypto';
import { isMobileDevice, getImageSizeFromArrayBuffer } from '@/utils/helpers';
import CloseIcon from './icons/CloseIcon.vue';

const chatStore = useChatStore();
const userStore = useUserStore();

const messageText = ref('');
const decryptedReplyContent = ref<string>('');
const isAnonymous = ref(false);
const isComposing = ref(false); // 用于检测输入法组合输入状态

const canSend = computed(() => chatStore.isBroadcastView || chatStore.currentChatId !== null);

const placeholder = computed(() =>
{
    return chatStore.isBroadcastView ? 'Send broadcast...' : 'Type a message...';
});

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

async function decryptReplyContent(replyTo: { content: string; type: 'TEXT' | 'IMAGE'; senderId: number; senderName?: string; }, chatKey: CryptoKey): Promise<string>
{
    try
    {
        // 如果被引用的是图片消息，显示"[Image]"
        if (replyTo.type && replyTo.type.toLowerCase() === 'image')
        {
            return '📷 Image';
        }

        // 引用消息的内容是加密的，需要先解密
        const decrypted = await decryptMessageString(replyTo.content, chatKey);

        return decrypted;
    }
    catch (e)
    {
        console.error('Reply message decryption error', e);
        return '[Decryption Error]';
    }
}

function handleKeyDown(e: KeyboardEvent)
{
    if (e.key === 'Enter')
    {
        // 如果正在进行输入法组合输入，不发送消息
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

async function sendImage()
{
    if (!chatStore.currentChatId) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = async () =>
    {
        const file = fileInput.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) =>
        {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const { width, height } = await getImageSizeFromArrayBuffer(arrayBuffer);

            const chatKey = chatStore.getChatKey(chatStore.currentChatId!);
            if (!chatKey)
            {
                chatStore.showToast('Chat key not loaded!', 'error');
                return;
            }

            try
            {
                const encrypted = await encryptMessageBytes(arrayBuffer, chatKey);
                const metadata = await encryptMessageString(
                    JSON.stringify({ width, height, size: file.size }),
                    chatKey
                );

                if (encrypted.length > 10 * 1024 * 1024)
                {
                    chatStore.showToast('Image too large! Max size is 10MB after encryption.', 'error');
                    return;
                }

                chatStore.showToast('Uploading image...', 'info');

                await sendFileMessage(
                    encrypted,
                    metadata,
                    chatStore.currentChatId!,
                    userStore.currentUser!.username,
                    userStore.authToken!
                );
            }
            catch (e: any)
            {
                console.error('Image upload failed', e);
                chatStore.showToast('Failed to upload image: ' + e.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    fileInput.click();
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

.media-btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
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
