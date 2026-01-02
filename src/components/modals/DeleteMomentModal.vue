<template>
    <div v-if="visible" class="modal-overlay" @click.self="cancel">
        <div class="modal">
            <h3>{{ comment ? 'Delete Comment' : 'Delete Moment' }}</h3>
            <p class="confirm-text">Are you sure you want to delete this {{ comment ? 'comment' : 'moment' }}? This action cannot be undone.</p>
            <div class="modal-buttons">
                <button class="button secondary" @click="cancel">Cancel</button>
                <button class="button danger" @click="confirm">Delete</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { Moment, MomentComment } from '@/types';
import { wsService } from '@/services/websocket';

const props = defineProps<{
    visible: boolean;
    moment: Moment | null;
    comment?: MomentComment | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'confirm'): void;
}>();

function cancel()
{
    emit('close');
}

function confirm()
{
    if (props.comment)
    {
        // 删除评论
        wsService.sendPacket('delete_moment', {
            messageId: props.comment.id
        });
    }
    else if (props.moment)
    {
        // 删除动态
        wsService.sendPacket('delete_moment', {
            messageId: props.moment.messageId
        });
    }

    emit('confirm');
    emit('close');
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

.confirm-text {
    margin: 0 0 1.5rem 0;
    color: var(--text-color);
    line-height: 1.5;
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

.button.primary:hover {
    background: var(--primary-hover);
}

.button.danger {
    background: #e74c3c;
    color: white;
}

.button.danger:hover {
    background: #c0392b;
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
