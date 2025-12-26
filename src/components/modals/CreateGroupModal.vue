<template>
    <Teleport to="body">
        <div v-if="uiStore.showCreateGroupModal" class="modal" @click.self="close">
            <div class="modal-content">
                <h3>{{ isInviting ? 'Invite Member' : 'Create Group Chat' }}</h3>

                <input v-if="!isInviting" v-model="groupName" type="text" placeholder="Group Name (optional)" />

                <div class="section-title">Select Friends</div>
                <div class="group-members-list">
                    <div v-if="loading" class="loading">Loading friends...</div>
                    <div v-else-if="availableFriends.length === 0" class="empty">
                        {{ isInviting ? 'All friends are already members!' : 'No friends found. Add someone first!' }}
                    </div>
                    <div v-for="friend in availableFriends" :key="friend.id" class="friend-select-item" @click="toggleFriend(friend)">
                        <template v-if="isInviting">
                            <img :src="getAvatarUrl(friend.id)" class="avatar" alt="avatar" loading="lazy" />
                            <span>{{ friend.username }}</span>
                        </template>
                        <template v-else>
                            <input type="checkbox" :checked="selectedFriends.has(friend.username)" @click.stop />
                            <img :src="getAvatarUrl(friend.id)" class="avatar" alt="avatar" loading="lazy" />
                            <span>{{ friend.username }}</span>
                        </template>
                    </div>
                </div>

                <div class="actions">
                    <button v-if="!isInviting" class="button" @click="createGroup">Create</button>
                    <button class="button cancel" @click="close">Cancel</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useUIStore, useChatStore } from '@/stores';
import { getAvatarUrl } from '@/utils/helpers';
import type { Friend } from '@/types';

const uiStore = useUIStore();
const chatStore = useChatStore();

const groupName = ref('');
const selectedFriends = ref<Set<string>>(new Set());
const loading = ref(true);

const isInviting = computed(() => chatStore.invitingToChat);

const availableFriends = computed(() =>
{
    if (isInviting.value && chatStore.currentChatDetails)
    {
        const existingUsernames = chatStore.currentChatDetails.members.map(m => m.username);
        return chatStore.friends.filter(f => !existingUsernames.includes(f.username));
    }
    return chatStore.friends;
});

watch(
    () => chatStore.friends,
    () =>
    {
        loading.value = false;
    }
);

watch(
    () => uiStore.showCreateGroupModal,
    (show) =>
    {
        if (show)
        {
            loading.value = true;
            selectedFriends.value.clear();
        }
    }
);

function toggleFriend(friend: Friend)
{
    if (isInviting.value)
    {
        // Direct invite
        inviteFriend(friend);
    }
    else
    {
        // Toggle selection
        if (selectedFriends.value.has(friend.username))
        {
            selectedFriends.value.delete(friend.username);
        }
        else
        {
            selectedFriends.value.add(friend.username);
        }
    }
}

async function inviteFriend(friend: Friend)
{
    await chatStore.inviteMemberToChat(friend.username);
    close();
}

async function createGroup()
{
    const members = Array.from(selectedFriends.value);
    await chatStore.createGroup(groupName.value, members);
    close();
}

function close()
{
    uiStore.showCreateGroupModal = false;
    chatStore.invitingToChat = false;
    groupName.value = '';
    selectedFriends.value.clear();
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
    width: 400px;
    max-height: 80%;
    display: flex;
    flex-direction: column;
}

.modal-content h3 {
    margin-top: 0;
    color: var(--primary-color);
}

.modal-content input[type="text"] {
    width: 100%;
    padding: 8px;
    margin-bottom: 10px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    border-radius: 4px;
    box-sizing: border-box;
}

.section-title {
    font-size: 0.8em;
    color: var(--secondary-color);
    text-transform: uppercase;
    margin-bottom: 10px;
}

.group-members-list {
    flex: 1;
    overflow-y: auto;
    margin: 15px 0;
    padding: 10px;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    max-height: 200px;
}

.loading,
.empty {
    padding: 10px;
    text-align: center;
    color: var(--secondary-color);
}

.friend-select-item {
    display: flex;
    align-items: center;
    padding: 8px;
    gap: 10px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s;
}

.friend-select-item:hover {
    background: rgba(88, 166, 255, 0.1);
}

.friend-select-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--primary-color);
}

.avatar {
    width: 24px;
    height: 24px;
    background: var(--border-color);
    border-radius: 50%;
    object-fit: cover;
}

.actions {
    display: flex;
    gap: 10px;
}

.button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    flex: 1;
}

.button.cancel {
    background-color: transparent;
    color: var(--text-color);
    border: 1px solid var(--border-color);
}
</style>
