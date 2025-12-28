<template>
    <Teleport to="body">
        <div v-if="visible" class="context-menu-overlay" @click="close" @contextmenu.prevent="close">
            <div ref="menuRef" class="context-menu" :style="menuStyle" @click.stop>
                <div v-for="item in items" :key="item.id" class="context-menu-item" @click="handleItemClick(item)">
                    <span v-if="item.icon" class="item-icon">{{ item.icon }}</span>
                    <span class="item-label">{{ item.label }}</span>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';

export interface ContextMenuItem
{
    id: string;
    label: string;
    icon?: string;
}

const props = defineProps<{
    visible: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'select', item: ContextMenuItem): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const adjustedX = ref(props.x);
const adjustedY = ref(props.y);

const menuStyle = computed(() => ({
    left: `${adjustedX.value}px`,
    top: `${adjustedY.value}px`
}));

watch(() => [props.visible, props.x, props.y], async () =>
{
    if (props.visible)
    {
        // 初始位置
        adjustedX.value = props.x;
        adjustedY.value = props.y;
        
        await nextTick();
        
        // 调整位置确保菜单在视口内
        if (menuRef.value)
        {
            const rect = menuRef.value.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            if (rect.right > viewportWidth)
            {
                adjustedX.value = viewportWidth - rect.width - 8;
            }
            if (rect.bottom > viewportHeight)
            {
                adjustedY.value = viewportHeight - rect.height - 8;
            }
        }
    }
}, { immediate: true });

function close()
{
    emit('close');
}

function handleItemClick(item: ContextMenuItem)
{
    emit('select', item);
    close();
}
</script>

<style scoped>
.context-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
}

.context-menu {
    position: fixed;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    min-width: 120px;
    padding: 4px 0;
    z-index: 1001;
    animation: fadeIn 0.15s ease;
}

.context-menu-item {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    color: var(--text-color);
    font-size: 14px;
}

.context-menu-item:hover {
    background-color: var(--hover-bg);
}

.item-icon {
    margin-right: 10px;
    font-size: 16px;
}

.item-label {
    flex: 1;
}

@keyframes fadeIn {
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
