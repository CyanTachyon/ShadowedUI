<template>
    <div class="image-cropper-overlay" @mousedown.self="handleOverlayClick">
        <div class="image-cropper-container">
            <div class="cropper-header">
                <span>{{ props.title }}</span>
                <button class="close-btn" @click="cancel">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="cropper-content" ref="cropperContent">
                <img ref="imageRef" :src="props.imageUrl" class="crop-image" :style="imageStyle" @mousedown.prevent="startImageDrag" @touchstart.prevent="startImageDrag" />
                <div class="crop-box" :class="{ 'circle': props.cropType === 'circle' }" :style="cropBoxStyle" @mousedown.stop.prevent="startCropDrag" @touchstart.stop.prevent="startCropDrag">
                    <div class="crop-overlay"></div>
                    <div class="crop-grid">
                        <div class="grid-line horizontal-1"></div>
                        <div class="grid-line horizontal-2"></div>
                        <div class="grid-line vertical-1"></div>
                        <div class="grid-line vertical-2"></div>
                    </div>
                    <!-- 调整手柄 -->
                    <div class="resize-handle nw" @mousedown.stop.prevent="startResize('nw', $event)" @touchstart.stop.prevent="startResize('nw', $event)"></div>
                    <div class="resize-handle ne" @mousedown.stop.prevent="startResize('ne', $event)" @touchstart.stop.prevent="startResize('ne', $event)"></div>
                    <div class="resize-handle sw" @mousedown.stop.prevent="startResize('sw', $event)" @touchstart.stop.prevent="startResize('sw', $event)"></div>
                    <div class="resize-handle se" @mousedown.stop.prevent="startResize('se', $event)" @touchstart.stop.prevent="startResize('se', $event)"></div>
                </div>
            </div>
            <div class="cropper-footer">
                <button class="btn btn-cancel" @click="cancel">Cancel</button>
                <button class="btn btn-confirm" @click="confirm">Confirm</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

interface Props
{
    imageUrl: string;
    cropType?: 'circle' | 'square';
    title?: string;
}

interface Emits
{
    (e: 'confirm', blob: Blob): void;
    (e: 'cancel'): void;
}

const props = withDefaults(defineProps<Props>(), {
    cropType: 'circle',
    title: 'Crop Image'
});

const emit = defineEmits<Emits>();

const cropperContent = ref<HTMLElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);

// 图片状态
const imageScale = ref(1);
const imageX = ref(0);
const imageY = ref(0);
const imageWidth = ref(0);
const imageHeight = ref(0);

// 裁剪框状态
const cropBox = ref({ x: 0, y: 0, width: 200, height: 200 });

// 拖拽状态 - 使用单一状态机
type DragMode = 'none' | 'image' | 'crop' | 'resize';
const dragMode = ref<DragMode>('none');
const resizeHandle = ref<'nw' | 'ne' | 'sw' | 'se' | null>(null);
// 拖拽起始点
const dragStartPos = ref({ x: 0, y: 0 });
const dragStartState = ref({ x: 0, y: 0, width: 0, height: 0 });

const imageStyle = computed(() => ({
    transform: `translate(${imageX.value}px, ${imageY.value}px) scale(${imageScale.value})`,
    transformOrigin: 'top left'
}));

const cropBoxStyle = computed(() => ({
    left: `${cropBox.value.x}px`,
    top: `${cropBox.value.y}px`,
    width: `${cropBox.value.width}px`,
    height: `${cropBox.value.height}px`
}));

// 获取事件坐标
function getEventPos(e: MouseEvent | TouchEvent)
{
    if ('touches' in e && e.touches.length > 0)
    {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
}

// 初始化图片
function initImage()
{
    if (!imageRef.value || !cropperContent.value) return;

    const img = imageRef.value;
    if (img.complete && img.naturalWidth > 0)
    {
        onImageLoad();
    }
    else
    {
        img.onload = onImageLoad;
    }
}

// 图片加载完成
function onImageLoad()
{
    if (!imageRef.value || !cropperContent.value) return;

    const img = imageRef.value;
    const container = cropperContent.value;
    const containerRect = container.getBoundingClientRect();

    // 计算缩放使图片适应容器
    const scaleX = (containerRect.width - 40) / img.naturalWidth;
    const scaleY = (containerRect.height - 40) / img.naturalHeight;
    imageScale.value = Math.min(scaleX, scaleY, 1);

    // 保存缩放后尺寸
    imageWidth.value = img.naturalWidth * imageScale.value;
    imageHeight.value = img.naturalHeight * imageScale.value;

    // 居中图片
    imageX.value = (containerRect.width - imageWidth.value) / 2;
    imageY.value = (containerRect.height - imageHeight.value) / 2;

    // 初始化裁剪框（居中，1:1比例）
    const minSide = Math.min(imageWidth.value, imageHeight.value);
    cropBox.value = {
        x: imageX.value + (imageWidth.value - minSide) / 2,
        y: imageY.value + (imageHeight.value - minSide) / 2,
        width: minSide,
        height: minSide
    };
}

// 开始拖拽图片
function startImageDrag(e: MouseEvent | TouchEvent)
{
    dragMode.value = 'image';
    const pos = getEventPos(e);
    dragStartPos.value = { x: pos.x - imageX.value, y: pos.y - imageY.value };
    // 保存裁剪框相对于图片的位置
    dragStartState.value = {
        x: cropBox.value.x - imageX.value,
        y: cropBox.value.y - imageY.value,
        width: 0, height: 0
    };
}

// 开始拖拽裁剪框
function startCropDrag(e: MouseEvent | TouchEvent)
{
    dragMode.value = 'crop';
    const pos = getEventPos(e);
    dragStartPos.value = { x: pos.x - cropBox.value.x, y: pos.y - cropBox.value.y };
}

// 开始调整大小
function startResize(handle: 'nw' | 'ne' | 'sw' | 'se', e: MouseEvent | TouchEvent)
{
    e.stopPropagation();
    dragMode.value = 'resize';
    resizeHandle.value = handle;
    const pos = getEventPos(e);
    dragStartPos.value = { x: pos.x, y: pos.y };
    dragStartState.value = {
        x: cropBox.value.x,
        y: cropBox.value.y,
        width: cropBox.value.width,
        height: cropBox.value.height
    };
}

// 限制裁剪框在图片范围内
function constrainCropBox(x: number, y: number, width: number, height: number)
{
    const minX = imageX.value;
    const minY = imageY.value;
    const maxX = imageX.value + imageWidth.value - width;
    const maxY = imageY.value + imageHeight.value - height;
    return {
        x: Math.max(minX, Math.min(x, maxX)),
        y: Math.max(minY, Math.min(y, maxY)),
        width,
        height
    };
}

// 处理移动
function handleMove(e: MouseEvent | TouchEvent)
{
    if (dragMode.value === 'none') return;
    e.preventDefault();

    const pos = getEventPos(e);

    if (dragMode.value === 'image')
    {
        // 移动图片时，裁剪框跟随
        const newImageX = pos.x - dragStartPos.value.x;
        const newImageY = pos.y - dragStartPos.value.y;
        imageX.value = newImageX;
        imageY.value = newImageY;
        // 保持裁剪框相对于图片的位置
        cropBox.value.x = newImageX + dragStartState.value.x;
        cropBox.value.y = newImageY + dragStartState.value.y;
    }
    else if (dragMode.value === 'crop')
    {
        const newX = pos.x - dragStartPos.value.x;
        const newY = pos.y - dragStartPos.value.y;
        const constrained = constrainCropBox(newX, newY, cropBox.value.width, cropBox.value.height);
        cropBox.value.x = constrained.x;
        cropBox.value.y = constrained.y;
    }
    else if (dragMode.value === 'resize' && resizeHandle.value)
    {
        const dx = pos.x - dragStartPos.value.x;
        const minSize = 50;
        const maxSize = Math.min(imageWidth.value, imageHeight.value);

        let newWidth = dragStartState.value.width;
        let newX = dragStartState.value.x;
        let newY = dragStartState.value.y;

        // 根据手柄计算新尺寸（保持1:1比例）
        if (resizeHandle.value === 'se' || resizeHandle.value === 'ne')
        {
            newWidth = Math.min(maxSize, Math.max(minSize, dragStartState.value.width + dx));
        }
        else
        {
            newWidth = Math.min(maxSize, Math.max(minSize, dragStartState.value.width - dx));
            newX = dragStartState.value.x + dragStartState.value.width - newWidth;
        }

        if (resizeHandle.value === 'ne' || resizeHandle.value === 'nw')
        {
            newY = dragStartState.value.y + dragStartState.value.height - newWidth;
        }

        const constrained = constrainCropBox(newX, newY, newWidth, newWidth);
        cropBox.value = constrained;
    }
}

// 结束拖拽
function endDrag()
{
    dragMode.value = 'none';
    resizeHandle.value = null;
}

// 确认裁剪
function confirm()
{
    if (!imageRef.value) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.value;

    // 计算裁剪区域在原图中的坐标
    const scale = img.naturalWidth / imageWidth.value;
    const cropX = (cropBox.value.x - imageX.value) * scale;
    const cropY = (cropBox.value.y - imageY.value) * scale;
    const cropSize = cropBox.value.width * scale;

    canvas.width = cropSize;
    canvas.height = cropSize;

    ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

    canvas.toBlob((blob) =>
    {
        if (blob) emit('confirm', blob);
    }, 'image/png', 0.9);
}

// 取消
function cancel()
{
    emit('cancel');
}

// 处理遮罩点击
function handleOverlayClick(e: MouseEvent)
{
    if (e.target === e.currentTarget)
        cancel();
}

onMounted(() =>
{
    nextTick(initImage);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);
});

onUnmounted(() =>
{
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('touchmove', handleMove);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchend', endDrag);
});
</script>

<style scoped>
.image-cropper-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.image-cropper-container {
    background: var(--panel-bg);
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.cropper-header {
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
}

.close-btn {
    background: none;
    border: none;
    color: var(--text-color);
    cursor: pointer;
    padding: 5px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
}

.cropper-content {
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #1a1a1a;
    min-height: 400px;
}

.crop-image {
    position: absolute;
    user-select: none;
    -webkit-user-select: none;
    cursor: move;
    max-width: none;
}

.crop-box {
    position: absolute;
    border: 2px solid #fff;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    cursor: move;
}

.crop-box.circle {
    border-radius: 50%;
}

.crop-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
}

.crop-grid {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
}

.grid-line {
    position: absolute;
    background: rgba(255, 255, 255, 0.3);
}

.grid-line.horizontal-1 {
    top: 33.33%;
    left: 0;
    right: 0;
    height: 1px;
}

.grid-line.horizontal-2 {
    top: 66.67%;
    left: 0;
    right: 0;
    height: 1px;
}

.grid-line.vertical-1 {
    left: 33.33%;
    top: 0;
    bottom: 0;
    width: 1px;
}

.grid-line.vertical-2 {
    left: 66.67%;
    top: 0;
    bottom: 0;
    width: 1px;
}

.resize-handle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: #fff;
    border: 2px solid var(--primary-color);
    border-radius: 50%;
}

.resize-handle.nw {
    top: -6px;
    left: -6px;
    cursor: nw-resize;
}

.resize-handle.ne {
    top: -6px;
    right: -6px;
    cursor: ne-resize;
}

.resize-handle.sw {
    bottom: -6px;
    left: -6px;
    cursor: sw-resize;
}

.resize-handle.se {
    bottom: -6px;
    right: -6px;
    cursor: se-resize;
}

.cropper-footer {
    padding: 15px 20px;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.btn {
    padding: 8px 20px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
}

.btn-cancel {
    background: var(--input-bg);
    color: var(--text-color);
    border: 1px solid var(--border-color);
}

.btn-cancel:hover {
    background: var(--border-color);
}

.btn-confirm {
    background: var(--primary-color);
    color: white;
}

.btn-confirm:hover {
    background: var(--primary-hover);
}

@media (max-width: 768px) {
    .image-cropper-container {
        width: 95%;
        max-height: 90vh;
    }

    .resize-handle {
        width: 16px;
        height: 16px;
    }

    .resize-handle.nw {
        top: -8px;
        left: -8px;
    }

    .resize-handle.ne {
        top: -8px;
        right: -8px;
    }

    .resize-handle.sw {
        bottom: -8px;
        left: -8px;
    }

    .resize-handle.se {
        bottom: -8px;
        right: -8px;
    }
}
</style>
