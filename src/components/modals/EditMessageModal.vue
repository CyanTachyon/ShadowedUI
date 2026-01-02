<template>
    <div v-if="visible" class="modal-overlay" @click.self="cancel">
        <div class="modal">
            <h3>Edit Message</h3>
            <textarea ref="textareaRef" v-model="editedContent" class="edit-textarea" placeholder="Enter message..." @keydown="handleKeyDown"></textarea>
            <div class="modal-buttons">
                <button class="button secondary" @click="cancel">Cancel</button>
                <button class="button primary" :disabled="!canSave" @click="save">Save</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { Message } from '@/types';
import { useChatStore } from '@/stores';
import { encryptMessageString, decryptMessageString } from '@/utils/crypto';

const props = defineProps<{
    visible: boolean;
    message: Message | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const chatStore = useChatStore();
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

watch(() => [props.visible, props.message] as const, async ([visible, message]) =>
{
    if (visible && message)
    {
        isDecrypting.value = true;

        // 解密消息内容
        const chatKey = chatStore.getChatKey(message.chatId);
        if (chatKey && message.type.toLowerCase() === 'text')
        {
            try
            {
                const decrypted = await decryptMessageString(message.content, chatKey);
                editedContent.value = decrypted;
                originalContent.value = decrypted;
            }
            catch (e)
            {
                console.error('Failed to decrypt message for editing', e);
                editedContent.value = '';
                originalContent.value = '';
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
    if (!canSave.value || !props.message) return;

    const chatKey = chatStore.getChatKey(props.message.chatId);
    if (!chatKey)
    {
        chatStore.showToast('Chat key not available', 'error');
        return;
    }

    try
    {
        const encrypted = await encryptMessageString(editedContent.value.trim(), chatKey);

        chatStore.editMessage(props.message.id, encrypted);

        emit('close');
    }
    catch (e: any)
    {
        console.error('Failed to encrypt edited message', e);
        chatStore.showToast('Failed to save message', 'error');
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
    max-height: 300px;
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
