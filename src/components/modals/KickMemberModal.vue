<template>
    <Teleport to="body">
        <div v-if="uiStore.showKickMemberModal && target" class="modal" @click.self="close">
            <div class="modal-content">
                <h3>{{ isLeaving ? 'Leave Group' : 'Kick Member' }}</h3>
                <img :src="getAvatarUrl(target.userId)" class="member-avatar" alt="Avatar" loading="lazy" />
                <div class="member-name">{{ target.username }}</div>
                <div class="message">{{ message }}</div>
                <button class="button danger" @click="confirm">Confirm</button>
                <button class="button cancel" @click="close">Cancel</button>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useUIStore, useChatStore, useUserStore } from '@/stores';
import { getAvatarUrl } from '@/utils/helpers';

const uiStore = useUIStore();
const chatStore = useChatStore();
const userStore = useUserStore();

const target = computed(() => uiStore.kickMemberTarget);

const isLeaving = computed(() =>
{
    return target.value?.username === userStore.currentUser?.username;
});

const message = computed(() =>
{
    if (!target.value) return '';
    if (isLeaving.value)
    {
        return `Are you sure you want to leave "${target.value.chatName}"?`;
    }
    return `Are you sure you want to kick ${target.value.username} from "${target.value.chatName}"?`;
});

function confirm()
{
    if (!target.value) return;
    chatStore.kickMember(target.value.chatId, target.value.username);
    close();
}

function close()
{
    uiStore.closeKickMemberModal();
}
</script>

<style scoped>
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
    display: flex;
    justify-content: center;
    align-items: center;
}

.modal-content {
    background: var(--panel-bg);
    padding: 20px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    width: 300px;
    text-align: center;
}

.modal-content h3 {
    margin-top: 0;
    color: var(--primary-color);
}

.member-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    margin: 10px auto;
    object-fit: cover;
}

.member-name {
    font-weight: 500;
    margin-bottom: 10px;
}

.message {
    margin-bottom: 15px;
    color: var(--secondary-color);
}

.button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    width: 100%;
    margin-top: 0.5rem;
}

.button.danger {
    background-color: #f85149;
}

.button.cancel {
    background-color: transparent;
    color: var(--text-color);
    border: 1px solid var(--border-color);
}
</style>
