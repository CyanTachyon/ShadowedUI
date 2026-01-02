<template>
    <div v-if="visible" class="modal-overlay" @click.self="cancel">
        <div class="modal">
            <h3>{{ comment ? 'Edit Comment' : 'Edit Moment' }}</h3>
            <textarea ref="textareaRef" v-model="editedContent" class="edit-textarea" placeholder="Enter content..." @keydown="handleKeyDown"></textarea>
            <div class="modal-buttons">
                <button class="button secondary" @click="cancel">Cancel</button>
                <button class="button primary" :disabled="!canSave" @click="save">Save</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { Moment, MomentComment } from '@/types';
import { useChatStore, useUserStore } from '@/stores';
import { wsService } from '@/services/websocket';
import { encryptMessageString, decryptMessageString, decryptSymmetricKey } from '@/utils/crypto';

const props = defineProps<{
    visible: boolean;
    moment: Moment | null;
    comment?: MomentComment | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'comment-edited', data: { momentId: number; commentId: number; content: string }): void;
}>();

const chatStore = useChatStore();
const userStore = useUserStore();
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const editedContent = ref('');
const originalContent = ref('');
const isDecrypting = ref(false);

const canSave = computed(() => 
{
    return editedContent.value.trim() !== '' &&
        editedContent.value !== originalContent.value &&
        !isDecrypting.value;
});

watch(() => [props.visible, props.moment, props.comment] as const, async ([visible, moment, comment]) =>
{
    if (visible)
    {
        isDecrypting.value = true;

        if (comment)
        {
            // 编辑评论 - comment.content 已经是解密后的内容
            editedContent.value = comment.content;
            originalContent.value = comment.content;
        }
        else if (moment)
        {
            // 编辑动态
            const key = await getDecryptedKey(moment.key);
            if (key && moment.type === 'TEXT')
            {
                try
                {
                    const decrypted = await decryptMessageString(moment.content, key);
                    editedContent.value = decrypted;
                    originalContent.value = decrypted;
                }
                catch (e)
                {
                    console.error('Failed to decrypt moment for editing', e);
                    editedContent.value = '';
                    originalContent.value = '';
                }
            }
        }

        isDecrypting.value = false;

        await nextTick();
        textareaRef.value?.focus();
    }
    else
    {
        editedContent.value = '';
        originalContent.value = '';
    }
}, { immediate: true });

async function getDecryptedKey(encryptedKey: string): Promise<CryptoKey | null>
{
    if (!userStore.privateKey) return null;

    try
    {
        return await decryptSymmetricKey(encryptedKey, userStore.privateKey);
    }
    catch (e)
    {
        console.error('Failed to decrypt moment key', e);
        return null;
    }
}

function handleKeyDown(e: KeyboardEvent)
{
    if (e.key === 'Escape')
    {
        cancel();
    }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
    {
        if (canSave.value) save();
    }
}

function cancel()
{
    emit('close');
}

async function save()
{
    if (!canSave.value) return;

    if (props.comment && props.moment)
    {
        // 编辑评论
        const key = await getDecryptedKey(props.moment.key);
        if (!key)
        {
            chatStore.showToast('Failed to get encryption key', 'error');
            return;
        }

        try
        {
            const encrypted = await encryptMessageString(editedContent.value.trim(), key);

            // 发送编辑请求
            wsService.sendPacket('edit_moment', {
                messageId: props.comment.id,
                content: encrypted
            });

            emit('close');
        }
        catch (e: any)
        {
            console.error('Failed to encrypt edited comment', e);
            chatStore.showToast('Failed to save', 'error');
        }
    }
    else if (props.moment)
    {
        // 编辑动态
        const key = await getDecryptedKey(props.moment.key);
        if (!key)
        {
            chatStore.showToast('Failed to get encryption key', 'error');
            return;
        }

        try
        {
            const encrypted = await encryptMessageString(editedContent.value.trim(), key);

            // 发送编辑请求
            wsService.sendPacket('edit_moment', {
                messageId: props.moment.messageId,
                content: encrypted
            });

            emit('close');
        }
        catch (e: any)
        {
            console.error('Failed to encrypt edited moment', e);
            chatStore.showToast('Failed to save', 'error');
        }
    }
}
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 1rem;
}

.modal {
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    width: 100%;
    max-width: 400px;
    animation: modalIn 0.2s ease;
}

.modal h3 {
    margin: 0 0 1rem 0;
    color: var(--text-color);
}

.edit-textarea {
    width: 100%;
    min-height: 100px;
    max-height: 120px;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-color);
    color: var(--text-color);
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
    margin-bottom: 1rem;
    box-sizing: border-box;
}

.edit-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
}

.modal-buttons {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
}

.button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.button.primary {
    background: var(--primary-color);
    color: white;
}

.button.primary:hover:not(:disabled) {
    background: var(--primary-hover);
}

.button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.button.secondary {
    background: var(--border-color);
    color: var(--text-color);
}

.button.secondary:hover {
    background: var(--hover-bg);
}

@keyframes modalIn {
    from {
        opacity: 0;
        transform: scale(0.95);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}
</style>
