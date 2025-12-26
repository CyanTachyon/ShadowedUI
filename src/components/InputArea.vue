<template>
    <div class="input-area">

        <textarea id="message-in" v-model="messageText" :placeholder="placeholder" :disabled="!canSend" @keydown="handleKeyDown"></textarea>

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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useChatStore, useUserStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { sendFileMessage } from '@/services/api';
import { encryptMessageString, encryptMessageBytes } from '@/utils/crypto';
import { isMobileDevice, getImageSizeFromArrayBuffer } from '@/utils/helpers';

const chatStore = useChatStore();
const userStore = useUserStore();

const messageText = ref('');
const isAnonymous = ref(false);

const canSend = computed(() => chatStore.isBroadcastView || chatStore.currentChatId !== null);

const placeholder = computed(() =>
{
    return chatStore.isBroadcastView ? 'Send broadcast...' : 'Type a message...';
});

function handleKeyDown(e: KeyboardEvent)
{
    if (e.key === 'Enter')
    {
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
        wsService.sendPacket('send_message', {
            chatId: chatStore.currentChatId,
            message: encrypted,
            type: 'text'
        });
        messageText.value = '';
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
</script>

<style scoped>
.input-area {
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    background-color: var(--panel-bg);
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
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
