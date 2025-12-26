<template>
    <div class="sidebar-header broadcast-header" @click="$emit('click')">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span class="broadcast-label">Broadcasts</span>
    </div>
</template>

<script setup lang="ts">
defineEmits<{
    click: [];
}>();
</script>

<style scoped>
.sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-start;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s;
}

.sidebar-header:hover {
    background-color: rgba(88, 166, 255, 0.1);
}

.broadcast-label {
    font-weight: 600;
    font-size: 14px;
}
</style>
