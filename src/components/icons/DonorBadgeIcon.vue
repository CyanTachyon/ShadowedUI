<template>
    <div class="donor-badge-wrapper" @mouseenter="showTooltip = true" @mouseleave="showTooltip = false" @click="showTooltip = !showTooltip">
        <svg class="donor-badge-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs v-if="gradientId">
                <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
                </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="10" :fill="gradientId ? `url(#${gradientId})` : 'url(#donor-gradient)'" stroke="#DAA520" stroke-width="1.5"/>
            <path d="M12 6L13.8 10H18L14.5 12.5L15.8 17L12 14.5L8.2 17L9.5 12.5L6 10H10.2L12 6Z"
                  fill="#FFFFFF"/>
        </svg>
        <div v-if="showTooltip" class="tooltip">Donor</div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const showTooltip = ref(false);
const gradientId = ref('');

onMounted(() => {
    gradientId.value = `donor-gradient-${Math.random().toString(36).slice(2, 11)}`;
});
</script>

<style scoped>
.donor-badge-wrapper {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
}

.donor-badge-icon {
    width: 100%;
    height: 100%;
}

.donor-badge-icon circle {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 5px;
    padding: 4px 8px;
    background-color: #333;
    color: white;
    font-size: 12px;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: #333;
}
</style>
