<template>
    <div v-if="visible" ref="pickerElement" class="at-mention-picker" :style="{ left: x + 'px', top: y + 'px' }">
        <div
            v-for="(user, index) in filteredUsers"
            :key="user.id"
            :class="['user-item', { selected: selectedIndex === index }]"
            :ref="el => { if (el) userItemElements[index] = el as HTMLElement }"
            @mousedown="handleUserMouseDown(index, $event)"
            @mouseenter="selectedIndex = index"
        >
            <img :src="getAvatarUrl(user.id)" class="user-avatar" alt="avatar" loading="lazy" />
            <span class="user-name">{{ user.name }}</span>
        </div>
        <div v-if="filteredUsers.length === 0" class="no-results">No users found</div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { getAvatarUrl } from '@/utils/helpers';

interface User {
    id: number;
    name: string;
}

const props = defineProps<{
    visible: boolean;
    x: number;
    y: number;
    users: User[];
    filter: string;
}>();

const emit = defineEmits<{
    select: [user: User];
    close: [];
    updatePosition: [];
}>();

const selectedIndex = ref(0);
const userItemElements = ref<HTMLElement[]>([]);
const pickerElement = ref<HTMLElement | null>(null);

const filteredUsers = computed(() =>
{
    if (!props.filter)
    {
        return props.users;
    }
    const filterLower = props.filter.toLowerCase();
    return props.users
        .filter(user => user.name.toLowerCase().includes(filterLower))
        .sort((a, b) =>
        {
            const aIndex = a.name.toLowerCase().indexOf(filterLower);
            const bIndex = b.name.toLowerCase().indexOf(filterLower);
            return aIndex - bIndex;
        });
});

// Reset selected index when filter changes
watch(() => props.filter, () =>
{
    selectedIndex.value = 0;
    // Use double nextTick to ensure DOM is fully updated before notifying parent
    nextTick(() =>
    {
        nextTick(() =>
        {
            emit('updatePosition');
        });
    });
});

// Reset selected index when users list changes
watch(() => props.users, () =>
{
    selectedIndex.value = 0;
    // Use double nextTick to ensure DOM is fully updated before notifying parent
    nextTick(() =>
    {
        nextTick(() =>
        {
            emit('updatePosition');
        });
    });
});

// Scroll to selected item when selectedIndex changes
watch(selectedIndex, (newIndex) =>
{
    nextTick(() =>
    {
        const element = userItemElements.value[newIndex];
        if (element)
        {
            element.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
    });
});

function handleUserMouseDown(index: number, event: MouseEvent)
{
    // Prevent default to avoid losing focus from the input
    event.preventDefault();
    selectUser(index);
}

function selectUser(index: number)
{
    const user = filteredUsers.value[index];
    if (user)
    {
        emit('select', user);
    }
}

function handleKeyDown(event: KeyboardEvent)
{
    if (!props.visible) return;

    switch (event.key)
    {
        case 'ArrowDown':
            event.preventDefault();
            selectedIndex.value = (selectedIndex.value + 1) % filteredUsers.value.length;
            break;
        case 'ArrowUp':
            event.preventDefault();
            selectedIndex.value = (selectedIndex.value - 1 + filteredUsers.value.length) % filteredUsers.value.length;
            break;
        case 'Enter':
        case 'Tab':
            event.preventDefault();
            selectUser(selectedIndex.value);
            break;
        case 'Escape':
            event.preventDefault();
            emit('close');
            break;
    }
}

onMounted(() =>
{
    document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() =>
{
    document.removeEventListener('keydown', handleKeyDown);
});

// Expose pickerElement to parent component
defineExpose({
    pickerElement
});
</script>

<style scoped>
.at-mention-picker {
    position: fixed;
    background-color: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    min-width: 150px;
}

.user-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.15s;
}

.user-item:hover,
.user-item.selected {
    background-color: var(--hover-color);
}

.user-item.selected {
    background-color: var(--primary-color);
    color: white;
}

.user-item.selected .user-name {
    color: white;
}

.user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    background-color: var(--border-color);
}

.user-name {
    font-size: 14px;
    color: var(--text-color);
}

.no-results {
    padding: 12px;
    font-size: 14px;
    color: var(--secondary-color);
    text-align: center;
}
</style>
