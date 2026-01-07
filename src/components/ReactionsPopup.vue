<template>
    <Teleport to="body">
        <div v-if="visible" class="reactions-popup-overlay" @click="close">
            <div ref="popupRef" class="reactions-popup" :style="popupStyle" @click.stop>
                <div v-if="reactions.length === 0" class="no-reactions">
                    No reactions yet
                </div>
                <div v-else class="reactions-list">
                    <div v-for="(reaction, index) in reactions" :key="reaction.emoji" class="reaction-row" :class="{ 'with-border': index < reactions.length - 1 }">
                        <div class="reaction-emoji">{{ reaction.emoji }}</div>
                        <div class="reaction-users">
                            <div v-for="userId in reaction.userIds" :key="userId" class="reaction-user">
                                <img :src="getAvatarUrl(userId)" :alt="`User ${userId}`" class="user-avatar" :title="getUserName(userId)" @click="handleUserClick(userId)" @click.stop />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { Reaction } from '../types';

const props = defineProps<{
    visible: boolean;
    x: number;
    y: number;
    reactions: Reaction[];
    users: Map<number, string>; // userId -> username
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'user-click', userId: number): void;
}>();

const popupRef = ref<HTMLElement | null>(null);
const adjustedX = ref(props.x);
const adjustedY = ref(props.y);

const popupStyle = computed(() => ({
    left: `${adjustedX.value}px`,
    top: `${adjustedY.value}px`
}));

// 动态调整位置确保弹窗在视口内
watch(() => [props.visible, props.x, props.y], async () =>
{
    if (props.visible)
    {
        adjustedX.value = props.x;
        adjustedY.value = props.y;

        await nextTick();

        if (popupRef.value)
        {
            const rect = popupRef.value.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // 如果超出右边，向左调整
            if (rect.right > viewportWidth)
            {
                adjustedX.value = viewportWidth - rect.width - 8;
            }
            // 如果超出底部，向上调整
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

function handleUserClick(userId: number)
{
    emit('user-click', userId);
}

function getAvatarUrl(userId: number): string
{
    return `/api/user/${userId}/avatar`;
}

function getUserName(userId: number): string
{
    return props.users.get(userId) || `User ${userId}`;
}
</script>

<style scoped>
@font-face {
    font-family: 'Noto Color Emoji';
    src: url('@/assets/fonts/NotoColorEmoji.ttf') format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
}

.reactions-popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
}

.reactions-popup {
    position: fixed;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    max-width: 350px;
    max-height: 300px;
    overflow-y: auto;
    padding: 4px;
    z-index: 1001;
    animation: fadeIn 0.15s ease;
}

.no-reactions {
    padding: 12px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
}

.reactions-list {
    display: flex;
    flex-direction: column;
}

.reaction-row {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border-color);
    transition: background-color 0.15s ease;
}

.reaction-row.with-border {
    border-bottom: 1px solid var(--border-color);
}

.reaction-row:last-child {
    border-bottom: none;
}

.reaction-row:hover {
    background-color: var(--hover-bg);
}

.reaction-emoji {
    font-size: 18px;
    min-width: 30px;
    text-align: center;
    flex-shrink: 0;
    font-family: 'Noto Color Emoji';
}

.reaction-users {
    flex: 1;
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 0;
    align-items: center;
}

.reaction-user {
    flex-shrink: 0;
}

.user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--border-color);
    transition: border-color 0.15s ease;
}

.user-avatar:hover {
    border-color: var(--accent-color);
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
