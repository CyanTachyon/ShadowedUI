<template>
    <div class="select-dropdown" ref="dropdownRef">
        <div class="select-trigger" :class="{ open: isOpen, disabled: disabled }" @click="toggleDropdown">
            <span class="selected-text">{{ displayText }}</span>
            <span class="dropdown-arrow" :class="{ rotated: isOpen }">
                <PlusIcon style="transform: rotate(45deg); width: 16px; height: 16px;" />
            </span>
        </div>
        <div class="dropdown-menu" v-if="isOpen">
            <div
                v-for="option in options"
                :key="String(option.value)"
                class="dropdown-item"
                :class="{ selected: isSelected(option) }"
                @click="selectOption(option)"
            >
                {{ option.label }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import PlusIcon from '../icons/PlusIcon.vue';

interface DropdownOption {
    value: number | null;
    label: string;
}

const props = defineProps<{
    options: DropdownOption[];
    modelValue: number | null;
    placeholder?: string;
    disabled?: boolean;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: number | null];
}>();

const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const displayText = computed(() => {
    const selected = props.options.find(opt => opt.value === props.modelValue);
    return selected?.label ?? props.placeholder ?? 'Select...';
});

function isSelected(option: DropdownOption): boolean {
    return option.value === props.modelValue;
}

function toggleDropdown() {
    if (props.disabled) return;
    isOpen.value = !isOpen.value;
}

function selectOption(option: DropdownOption) {
    if (props.disabled) return;
    emit('update:modelValue', option.value);
    isOpen.value = false;
}

// 点击外部关闭下拉框
function handleClickOutside(event: MouseEvent) {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
        isOpen.value = false;
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});

// 监听 modelValue 变化，关闭下拉框
watch(() => props.modelValue, () => {
    isOpen.value = false;
});
</script>

<style scoped>
.select-dropdown {
    position: relative;
    width: 100%;
}

.select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
}

.select-trigger:hover:not(.disabled) {
    border-color: var(--primary-color);
    background: var(--bg-color);
}

.select-trigger.open {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.select-trigger.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.selected-text {
    flex: 1;
    font-size: 14px;
}

.dropdown-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
}

.dropdown-arrow.rotated {
    transform: rotate(135deg);
}

.dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
}

.dropdown-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s ease;
    font-size: 14px;
}

.dropdown-item:hover {
    background: var(--hover-color);
}

.dropdown-item.selected {
    background: var(--primary-color);
    color: white;
}

.dropdown-item.selected:hover {
    background: var(--primary-color);
    opacity: 0.9;
}
</style>
