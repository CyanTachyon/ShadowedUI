<template>
    <Teleport to="body">
        <div v-if="uiStore.showDeleteChatModal && target" class="modal" @click.self="close">
            <div class="modal-content">
                <h3>Delete Chat</h3>
                <img :src="getAvatarUrl(target.userId)" class="member-avatar" alt="Avatar" loading="lazy" />
                <div class="member-name">{{ target.name }}</div>
                <div class="message" v-if="!target.isGroup">
                    Are you sure you want to delete this chat with {{ target.name }}?
                    <br /><br />
                    This will remove the chat history and friendship for both you and {{ target.name }}.
                </div>
                <div class="message" v-else>
                    Are you sure you want to delete the group "{{ target.name }}"?
                    <br /><br />
                    This will remove the chat and all its history for all members.
                </div>
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

const target = computed(() => uiStore.deleteChatTarget);

function confirm()
{
    if (!target.value || !userStore.currentUser) return;
    chatStore.kickMember(target.value.chatId, userStore.currentUser.username);
    close();
}

function close()
{
    uiStore.closeDeleteChatModal();
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
    width: 80px;
    height: 80px;
    border-radius: 50%;
    margin: 10px auto;
    display: block;
    object-fit: cover;
}

.member-name {
    font-size: 1.2em;
    font-weight: bold;
    margin-bottom: 15px;
    color: var(--primary-color);
}

.message {
    margin-bottom: 20px;
    line-height: 1.5;
    color: var(--secondary-color);
}

.button {
    margin: 5px;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
}

.button.danger {
    background: #e74c3c;
    color: white;
}

.button.danger:hover {
    background: #c0392b;
}

.button.cancel {
    background: var(--border-color);
    color: var(--primary-color);
}

.button.cancel:hover {
    background: var(--secondary-color);
}
</style>
