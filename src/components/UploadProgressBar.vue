<template>
    <div v-if="task" class="upload-progress">
        <div class="upload-header">
            <span class="upload-title">{{ statusText }}</span>
        </div>
        <div class="upload-info">
            <span class="file-name">{{ task.fileName }}</span>
            <span class="progress-text">{{ progressPercent }}%</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="upload-actions">
            <button v-if="task.status === 'uploading'" class="action-btn" @click="emit('pause')">
                Pause
            </button>
            <button v-if="task.status === 'paused' || task.status === 'pending' || task.status === 'failed'" class="action-btn primary" @click="emit('resume')">
                {{ task.status === 'failed' ? 'Retry' : 'Resume' }}
            </button>
            <button class="action-btn danger" @click="emit('cancel')">
                Cancel
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { UploadTask } from '@/types';

const props = defineProps<{
    task: UploadTask | null;
}>();

const emit = defineEmits<{
    (e: 'pause'): void;
    (e: 'resume'): void;
    (e: 'cancel'): void;
}>();

const progressPercent = computed(() =>
{
    if (!props.task) return 0;
    return Math.round((props.task.uploadedChunks.length / props.task.totalChunks) * 100);
});

const statusText = computed(() =>
{
    if (!props.task) return '';
    switch (props.task.status)
    {
        case 'uploading': return 'Uploading...';
        case 'paused': return 'Upload Paused';
        case 'pending': return 'Pending Upload';
        case 'failed': return 'Upload Failed';
        case 'completed': return 'Upload Complete';
        default: return 'Incomplete Upload';
    }
});
</script>

<style scoped>
.upload-progress {
    background-color: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    animation: slideDown 0.2s ease;
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

.upload-header {
    margin-bottom: 8px;
}

.upload-title {
    font-size: 0.85em;
    color: var(--primary-color);
    font-weight: 600;
}

.upload-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.file-name {
    font-size: 0.9em;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
}

.progress-text {
    font-size: 0.85em;
    color: var(--primary-color);
    font-weight: bold;
}

.progress-bar {
    height: 6px;
    background-color: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
}

.progress-fill {
    height: 100%;
    background-color: var(--primary-color);
    border-radius: 3px;
    transition: width 0.3s ease;
}

.upload-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.action-btn {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.8em;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid var(--border-color);
    background-color: var(--panel-bg);
    color: var(--text-color);
}

.action-btn:hover {
    border-color: var(--primary-color);
}

.action-btn.primary {
    background-color: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
}

.action-btn.danger {
    color: #f85149;
    border-color: #f85149;
}

.action-btn.danger:hover {
    background-color: #f85149;
    color: white;
}
</style>
