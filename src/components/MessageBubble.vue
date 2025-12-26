<template>
    <div :class="['message', isMe ? 'sent' : 'received']" :style="{ marginLeft: showSender ? '40px' : '0' }">
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { Message } from '@/types';
import { useChatStore, useUserStore } from '@/stores';
import { decryptMessageString, decryptMessageBytes } from '@/utils/crypto';
import { getAvatarUrl, formatDate, getUserId } from '@/utils/helpers';
import { fetchMessageFile } from '@/services/api';

const props = defineProps<{
    message: Message;
}>();

const chatStore = useChatStore();
const userStore = useUserStore();

const decryptedContent = ref<string>('[Decrypting...]');
const imageUrl = ref<string | null>(null);
const imagePlaceholder = ref<string | null>(null);
const imageMetadata = ref<{ width: number; height: number; } | null>(null);

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
watch(() => props.message.id, decryptMessage);
</script>

<style scoped>
.message {
    max-width: 70%;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    word-wrap: break-word;
    position: relative;
    animation: fadeIn 0.3s ease;
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
