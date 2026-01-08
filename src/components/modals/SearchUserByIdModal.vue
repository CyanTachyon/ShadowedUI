<template>
    <Teleport to="body">
        <div v-if="uiStore.showSearchUserByIdModal" class="modal" @click.self="close">
            <div class="modal-content">
                <h3>Search User by ID</h3>
                <input v-model.number="userIdInput" type="number" placeholder="Enter User ID" @keyup.enter="searchUser" />
                <button class="button" @click="searchUser">Search</button>
                <button class="button cancel" @click="close">Cancel</button>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUIStore, useChatStore } from '@/stores';
import { fetchUserInfo } from '@/services/api';

const uiStore = useUIStore();
const chatStore = useChatStore();

const userIdInput = ref(undefined as number | undefined);

async function searchUser()
{
    const id = userIdInput.value;

    if (!id || id <= 0)
    {
        chatStore.showToast('Please enter a valid user ID', 'error');
        return;
    }

    const userInfo = await fetchUserInfo(id);
    if (userInfo)
    {
        uiStore.navigateToProfile(id);
        userIdInput.value = 0;
        close();
    }
    else
    {
        chatStore.showToast('User not found', 'error');
    }
}

function close()
{
    uiStore.showSearchUserByIdModal = false;
    userIdInput.value = 0;
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
}

.modal-content h3 {
    margin-top: 0;
    color: var(--primary-color);
}

.modal-content input {
    width: 100%;
    padding: 10px;
    margin-bottom: 15px;
    background-color: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-color);
    box-sizing: border-box;
}

.modal-content input:focus {
    border-color: var(--primary-color);
    outline: none;
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

.button.cancel {
    background-color: transparent;
    color: var(--text-color);
    border: 1px solid var(--border-color);
}
</style>
