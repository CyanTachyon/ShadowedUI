<template>
    <Teleport to="body">
        <div v-if="uiStore.showResetPasswordModal" class="modal" @click.self="close">
            <div class="modal-content">
                <h3>Reset Password</h3>
                <input v-model="newPassword" type="password" placeholder="New Password" />
                <input v-model="confirmPassword" type="password" placeholder="Confirm New Password" @keyup.enter="resetPassword" />
                <button class="button" @click="resetPassword">Reset Password</button>
                <button class="button cancel" @click="close">Cancel</button>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUIStore, useUserStore, useChatStore } from '@/stores';
import { fetchAuthParams, resetPassword as resetPasswordApi } from '@/services/api';
import { hashPasswordWithServerKey, encryptPrivateKey, deriveKeyFromPassword } from '@/utils/crypto';

const uiStore = useUIStore();
const userStore = useUserStore();
const chatStore = useChatStore();

const newPassword = ref('');
const confirmPassword = ref('');

async function resetPassword()
{
    if (!newPassword.value || !confirmPassword.value)
    {
        chatStore.showToast('Please fill in all fields', 'error');
        return;
    }

    if (newPassword.value !== confirmPassword.value)
    {
        newPassword.value = '';
        confirmPassword.value = '';
        chatStore.showToast('Passwords do not match', 'error');
        return;
    }

    if (newPassword.value.length < 8)
    {
        chatStore.showToast('Password must be at least 8 characters', 'error');
        return;
    }

    try
    {
        const serverKey = await fetchAuthParams();
        const username = userStore.currentUser!.username;

        const newPasswordHash = await hashPasswordWithServerKey(newPassword.value, serverKey);
        // 使用已存储的 authToken 作为旧密码哈希
        const oldPasswordHash = userStore.authToken!;
        const newPrivateKey = await encryptPrivateKey(
            userStore.privateKey!,
            await deriveKeyFromPassword(newPassword.value, username)
        );

        const result = await resetPasswordApi({
            username,
            oldPassword: oldPasswordHash,
            newPassword: newPasswordHash,
            privateKey: newPrivateKey
        });

        if (result.success)
        {
            userStore.logout();
        }
        else
        {
            chatStore.showToast(result.message || 'Password reset failed', 'error');
        }
    }
    catch (e: any)
    {
        console.error(e);
        chatStore.showToast('Error during password reset', 'error');
    }
}

function close()
{
    uiStore.showResetPasswordModal = false;
    newPassword.value = '';
    confirmPassword.value = '';
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
    padding: 8px;
    margin-bottom: 10px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    color: var(--text-color);
    border-radius: 4px;
    box-sizing: border-box;
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
