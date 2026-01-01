<template>
    <div class="comment-input">
        <img :src="getAvatarUrl()" class="avatar" alt="avatar" />
        <div class="input-wrapper">
            <textarea 
                v-model="commentText" 
                class="comment-textarea" 
                placeholder="写评论..." 
                rows="2"
                @keydown="handleKeyDown"
            ></textarea>
            <button 
                class="send-button" 
                :disabled="!canSend" 
                @click="sendComment"
            >
                发送
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Moment } from '@/types';
import { useChatStore, useUserStore } from '@/stores';
import { getAvatarUrl as getAvatarUrlHelper, getUserId } from '@/utils/helpers';
import { encryptMessageString } from '@/utils/crypto';

const props = defineProps<{
    moment: Moment;
}>();

const emit = defineEmits<{
    (e: 'commentSent'): void;
}>();

const chatStore = useChatStore();
const userStore = useUserStore();
const commentText = ref('');

const canSend = computed(() => 
{
    return commentText.value.trim() !== '';
});

function getAvatarUrl(): string
{
    if (!userStore.currentUser) return '';
    return getAvatarUrlHelper(getUserId(userStore.currentUser.id));
}

function handleKeyDown(e: KeyboardEvent)
{
    if (e.key === 'Enter' && !e.shiftKey)
    {
        e.preventDefault();
        if (canSend.value) sendComment();
    }
}

async function sendComment()
{
    if (!canSend.value) return;

    try
    {
        // 获取 moment 的加密密钥
        const key = await getDecryptedKey(props.moment.key);
        if (!key)
        {
            chatStore.showToast('无法获取加密密钥', 'error');
            return;
        }

        // 加密评论内容
        const encryptedContent = await encryptMessageString(commentText.value.trim(), key);

        // 发送评论请求
        const { wsService } = await import('@/services/websocket');
        wsService.sendPacket('comment_moment', {
            momentMessageId: props.moment.messageId,
            content: encryptedContent,
            type: 'TEXT'
        });

        // 清空输入框
        commentText.value = '';
        
        // 通知父组件
        emit('commentSent');
    }
    catch (e: any)
    {
        console.error('Failed to send comment', e);
        chatStore.showToast('发送评论失败', 'error');
    }
}

async function getDecryptedKey(encryptedKey: string): Promise<CryptoKey | null>
{
    if (!userStore.privateKey) return null;

    try
    {
        const { decryptSymmetricKey } = await import('@/utils/crypto');
        return await decryptSymmetricKey(encryptedKey, userStore.privateKey);
    }
    catch (e)
    {
        console.error('Failed to decrypt moment key', e);
        return null;
    }
}
</script>

<style scoped>
.comment-input {
    display: flex;
    gap: 10px;
    padding: 12px;
    background: var(--hover-bg);
    border-radius: 8px;
    margin-top: 12px;
}

.avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.input-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.comment-textarea {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-color);
    color: var(--text-color);
    font-size: 0.9rem;
    font-family: inherit;
    resize: none;
    line-height: 1.4;
}

.comment-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
}

.comment-textarea::placeholder {
    color: var(--secondary-color);
}

.send-button {
    align-self: flex-end;
    padding: 6px 16px;
    background: var(--primary-color);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.send-button:hover:not(:disabled) {
    background: var(--primary-hover);
}

.send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
