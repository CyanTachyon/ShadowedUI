<template>
    <div class="toast-container">
        <TransitionGroup name="toast">
            <div v-for="toast in toasts" :key="toast.id" :class="['toast', toast.type]" :style="{ cursor: toast.onClick ? 'pointer' : 'default' }" @click="toast.onClick?.()">
                {{ toast.message }}
            </div>
        </TransitionGroup>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useChatStore } from '@/stores';

const chatStore = useChatStore();
const toasts = computed(() => chatStore.toasts);
</script>

<style scoped>
.toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.toast {
    background-color: var(--panel-bg);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    padding: 10px 20px;
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    min-width: 250px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.toast.info {
    border-left: 4px solid var(--primary-color);
}

.toast.error {
    border-left: 4px solid #f85149;
}

.toast.success {
    border-left: 4px solid #2ea043;
}

.toast-enter-active {
    animation: slideIn 0.3s ease;
}

.toast-leave-active {
    animation: fadeOut 0.3s ease forwards;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }

    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes fadeOut {
    from {
        opacity: 1;
    }

    to {
        opacity: 0;
    }
}
</style>
