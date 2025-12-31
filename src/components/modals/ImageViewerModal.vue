<template>
    <div v-if="visible" class="image-viewer-overlay" @click.self="close" @wheel.prevent="handleWheel" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
        <div class="image-container" :style="{ transform: `scale(${scale}) translate(${imageOffsetX}px, ${imageOffsetY}px)` }">
            <img v-if="imageUrl" :src="imageUrl" class="viewing-image" alt="Zoomed image" @mousedown="startDrag" />
        </div>
        <button class="close-button" @click="close">✕</button>
        <div class="zoom-controls">
            <button class="zoom-button" @click.stop="zoomOut">−</button>
            <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
            <button class="zoom-button" @click.stop="zoomIn">+</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
    visible: boolean;
    imageUrl: string | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const scale = ref(1);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const imageOffsetX = ref(0);
const imageOffsetY = ref(0);

// Touch handling for pinch zoom
const initialDistance = ref(0);
const initialScale = ref(1);
const touchStartX = ref(0);
const touchStartY = ref(0);
const wasPinchZooming = ref(false);

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

function close()
{
    emit('close');
}

function resetView()
{
    scale.value = 1;
    imageOffsetX.value = 0;
    imageOffsetY.value = 0;
    isDragging.value = false;
}

watch(() => props.visible, (newVisible) =>
{
    if (newVisible)
    {
        resetView();
    }
});

// Mouse wheel zoom
function handleWheel(event: WheelEvent)
{
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(scale.value + delta, MIN_SCALE), MAX_SCALE);
    scale.value = newScale;
}

// Button zoom
function zoomIn()
{
    scale.value = Math.min(scale.value + 0.25, MAX_SCALE);
}

function zoomOut()
{
    scale.value = Math.max(scale.value - 0.25, MIN_SCALE);
}

// Drag handling
function startDrag(event: MouseEvent)
{
    event.preventDefault();
    isDragging.value = true;
    dragStartX.value = event.clientX;
    dragStartY.value = event.clientY;
}

function onDrag(event: MouseEvent)
{
    if (!isDragging.value) return;
    event.preventDefault();
    
    const deltaX = event.clientX - dragStartX.value;
    const deltaY = event.clientY - dragStartY.value;
    
    imageOffsetX.value += deltaX;
    imageOffsetY.value += deltaY;
    
    dragStartX.value = event.clientX;
    dragStartY.value = event.clientY;
}

function endDrag()
{
    isDragging.value = false;
}

function handleGlobalMouseMove(event: MouseEvent)
{
    onDrag(event);
}

function handleGlobalMouseUp()
{
    if (isDragging.value)
    {
        endDrag();
    }
}

// Touch handling for pinch zoom
function handleTouchStart(event: TouchEvent)
{
    if (event.touches.length === 2)
    {
        initialDistance.value = getDistance(event.touches);
        initialScale.value = scale.value;
        wasPinchZooming.value = true;
        isDragging.value = false;
    }
    else if (event.touches.length === 1)
    {
        // Single touch - start drag
        // Only start drag if we weren't just doing pinch zoom
        if (!wasPinchZooming.value)
        {
            touchStartX.value = event.touches[0].clientX;
            touchStartY.value = event.touches[0].clientY;
            isDragging.value = true;
        }
    }
}

function handleTouchMove(event: TouchEvent)
{
    if (event.touches.length === 2)
    {
        event.preventDefault();
        const currentDistance = getDistance(event.touches);
        const newScale = initialScale.value * (currentDistance / initialDistance.value);
        scale.value = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    }
    else if (event.touches.length === 1 && isDragging.value)
    {
        event.preventDefault();
        const touch = event.touches[0];
        const deltaX = touch.clientX - touchStartX.value;
        const deltaY = touch.clientY - touchStartY.value;
        
        imageOffsetX.value += deltaX;
        imageOffsetY.value += deltaY;
        
        touchStartX.value = touch.clientX;
        touchStartY.value = touch.clientY;
    }
}

function handleTouchEnd(event: TouchEvent)
{
    if (event.touches.length === 0)
    {
        // All fingers lifted
        isDragging.value = false;
        wasPinchZooming.value = false;
    }
    else if (event.touches.length === 1)
    {
        // One finger left, but we were just doing pinch zoom
        // Don't start dragging until a new touch starts
        if (wasPinchZooming.value)
        {
            wasPinchZooming.value = false;
            isDragging.value = false;
        }
    }
}

function getDistance(touches: TouchList): number
{
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Keyboard shortcuts
function handleKeyDown(event: KeyboardEvent)
{
    if (!props.visible) return;

    if (event.key === 'Escape')
    {
        close();
    }
    else if (event.key === '+' || event.key === '=')
    {
        zoomIn();
    }
    else if (event.key === '-' || event.key === '_')
    {
        zoomOut();
    }
}

onMounted(() =>
{
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
});

onUnmounted(() =>
{
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
});
</script>

<style scoped>
.image-viewer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    cursor: zoom-out;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

.image-container {
    max-width: 90vw;
    max-height: 90vh;
    overflow: visible;
    transition: transform 0.1s ease-out;
    transform-origin: center center;
}

.viewing-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
}

.viewing-image:active {
    cursor: grabbing;
}

.close-button {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    z-index: 10000;
}

.close-button:hover {
    background-color: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
}

.zoom-controls {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: rgba(0, 0, 0, 0.7);
    padding: 10px 20px;
    border-radius: 25px;
    z-index: 10000;
}

.zoom-button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.zoom-button:hover {
    background-color: rgba(255, 255, 255, 0.2);
}

.zoom-button:active {
    transform: scale(0.95);
}

.zoom-level {
    color: white;
    font-size: 14px;
    min-width: 60px;
    text-align: center;
}
</style>
