<template>
    <Teleport to="body">
        <div v-if="visible" class="emoji-picker-overlay" @click="close">
            <div ref="pickerRef" class="emoji-picker" :style="pickerStyle" @click.stop>
                <div class="emoji-categories">
                    <button v-for="category in categories" :key="category.id" :class="['category-btn', { active: selectedCategory === category.id }]" @click="selectedCategory = category.id; adjustPickerPosition()">
                        {{ category.icon }}
                    </button>
                </div>
                <div ref="pickerContentRef" class="emoji-grid">
                    <button v-for="emoji in currentEmojis" :key="emoji" class="emoji-btn" @click="selectEmoji(emoji)">
                        {{ emoji }}
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';

const props = defineProps<{
    visible: boolean;
    x: number;
    y: number;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'select', emoji: string): void;
}>();

const pickerRef = ref<HTMLElement | null>(null);
const adjustedX = ref(props.x);
const adjustedY = ref(props.y);
const selectedCategory = ref('frequent');

// Emoji分类
const categories = [
    { id: 'frequent', icon: '⏰', label: 'Frequent' },
    { id: 'smileys', icon: '😊', label: 'Smileys' },
    { id: 'gestures', icon: '👍', label: 'Gestures' },
    { id: 'hearts', icon: '❤️', label: 'Hearts' },
    { id: 'animals', icon: '🐶', label: 'Animals' },
    { id: 'food', icon: '🍕', label: 'Food' },
    { id: 'activities', icon: '⚽', label: 'Activities' },
    { id: 'objects', icon: '💡', label: 'Objects' },
    { id: 'symbols', icon: '🔥', label: 'Symbols' },
];

// 常用表情
const frequentEmojis = ['❤️', '👍', '💯', '🈴', '🈶', '🉑', '❓', '👎'];

// 常用emoji列表
const emojiLists: Record<string, string[]> = {
    smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝'],
    gestures: ['👍', '👎', '👏', '🙌', '🤝', '👋', '🤙', '✌️', '🤞', '👌', '🤏', '👆', '👇', '👉', '👈', '☝️', '✋', '🤚', '🖐', '🖖', '👏', '🙏', '💪', '🦵', '🦶', '👂', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋', '👶', '🧒', '👦', '👧', '👨', '👱'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜'],
    food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🧄', '🧅', '🧊', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🪀', '🏓', '🏸', '🏒', '🥍', '🥎', '🥏', '🎳', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '⛸', '🥌', '🛷', '⛷', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾'],
    objects: ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱', '🖲', '🕹', '🗜', '💾', '💿', '📀', '📱', '📷', '📹', '📼', '🔍', '🎬', '📽', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌'],
    symbols: ['🔥', '💧', '💨', '💥', '💫', '💦', '💨', '🌊', '⭐', '🌟', '✨', '⚡', '🌈', '🌂', '☔', '⚡', '❄️', '☃️', '⛄', '☄️', '🔮', '💎', '⚽', '💣', '📨', '📧', '📩', '📤', '📥', '📦', '🏷', '💲', '💵', '💴', '💶', '💷', '💸', '💳', '🧾', '💹'],
};

const currentEmojis = computed(() =>
{
    if (selectedCategory.value === 'frequent')
    {
        return frequentEmojis;
    }
    return emojiLists[selectedCategory.value] || [];
});

const pickerStyle = computed(() => ({
    left: `${adjustedX.value}px`,
    top: `${adjustedY.value}px`
}));

// 调整picker位置确保在屏幕内
function adjustPickerPosition()
{
    if (pickerRef.value)
    {
        const rect = pickerRef.value.getBoundingClientRect();
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

// 初始化位置
function initPosition()
{
    adjustedX.value = props.x;
    adjustedY.value = props.y;
    nextTick(() =>
    {
        adjustPickerPosition();
    });
}

// 当弹窗显示时初始化位置
watch(() => props.visible, (newVisible) =>
{
    if (newVisible)
    {
        initPosition();
    }
});

// 当切换分类时，重新调整位置
watch(selectedCategory, () =>
{
    if (props.visible)
    {
        nextTick(() =>
        {
            adjustPickerPosition();
        });
    }
});

// 组件挂载时如果弹窗可见，初始化位置
onMounted(() =>
{
    if (props.visible)
    {
        initPosition();
    }
});

function close()
{
    emit('close');
}

function selectEmoji(emoji: string)
{
    emit('select', emoji);
    close();
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

.emoji-picker {
    font-family: 'Noto Color Emoji';
}

.emoji-picker-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
}

.emoji-picker {
    position: fixed;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    width: 320px;
    overflow: hidden;
    z-index: 1001;
    animation: fadeIn 0.15s ease;
}

.emoji-categories {
    display: flex;
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;
}

.category-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    font-size: 18px;
    transition: background-color 0.15s ease;
    font-family: 'Noto Color Emoji';
}

.category-btn:hover {
    background: var(--hover-bg);
}

.category-btn.active {
    background: var(--primary-color);
}

.emoji-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    padding: 12px;
}

.emoji-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    font-family: 'Noto Color Emoji';
    font-size: 20px;
    transition: background-color 0.15s ease;
}

.emoji-btn:hover {
    background: var(--hover-bg);
    transform: scale(1.1);
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
