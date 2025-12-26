import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@/types';
import { wsService } from '@/services/websocket';
import { fetchAuthParams, register as apiRegister } from '@/services/api';
import
{
    deriveKeyFromPassword,
    decryptPrivateKey,
    generateKeyPair,
    exportPublicKey,
    encryptPrivateKey,
    hashPasswordWithServerKey,
    importPublicKey,
    exportPasswordKey,
    importPasswordKey
} from '@/utils/crypto';
import { useChatStore } from './chat';

export const useUserStore = defineStore('user', () =>
{
    const currentUser = ref<User | null>(null);
    const privateKey = ref<CryptoKey | null>(null);
    const authToken = ref<string | null>(null);
    const passwordKey = ref<CryptoKey | null>(null);
    const username = ref<string>('');
    const isAuthenticated = ref(false);

    const userId = computed(() =>
    {
        if (!currentUser.value) return null;
        const id = currentUser.value.id;
        return typeof id === 'object' && id.value ? id.value : id;
    });

    async function login(user: string, pass: string): Promise<void>
    {
        username.value = user;

        try
        {
            // 生成并存储 passwordKey（用于后续解密私钥）
            const derivedKey = await deriveKeyFromPassword(pass, user);
            passwordKey.value = derivedKey;

            const serverKey = await fetchAuthParams();
            const authHash = await hashPasswordWithServerKey(pass, serverKey);
            authToken.value = authHash;

            const packet = {
                username: user,
                password: authHash
            };
            wsService.sendPacketDirect('login', packet);
        }
        catch (e)
        {
            console.error('Login prep failed', e);
            const chatStore = useChatStore();
            chatStore.showToast('Login failed to initialize', 'error');
        }
    }

    // 重连时使用存储的 authToken 直接登录
    function relogin(): void
    {
        if (!username.value || !authToken.value) return;
        
        const packet = {
            username: username.value,
            password: authToken.value
        };
        wsService.sendPacketDirect('login', packet);
    }

    async function handleLoginSuccess(data: any): Promise<boolean>
    {
        try
        {
            const user = data.user;
            
            if (!passwordKey.value)
            {
                const chatStore = useChatStore();
                chatStore.showToast('Password key not available', 'error');
                return false;
            }

            const decryptedPrivateKey = await decryptPrivateKey(user.privateKey, passwordKey.value);

            if (!decryptedPrivateKey)
            {
                const chatStore = useChatStore();
                chatStore.showToast('Failed to decrypt private key. Wrong password?', 'error');
                return false;
            }

            privateKey.value = decryptedPrivateKey;
            currentUser.value = user;
            isAuthenticated.value = true;
            
            // 存储登录信息到 localStorage
            await saveLoginToStorage();
            
            wsService.notifyLoggedIn();
            console.log('Private key decrypted successfully');
            return true;
        }
        catch (e)
        {
            console.error('Login crypto error', e);
            const chatStore = useChatStore();
            chatStore.showToast('Crypto error during login', 'error');
            return false;
        }
    }

    async function register(user: string, pass: string, confirmPass: string): Promise<boolean>
    {
        const chatStore = useChatStore();

        if (!user || !pass || !confirmPass)
        {
            chatStore.showToast('Please fill all fields', 'error');
            return false;
        }

        if (pass !== confirmPass)
        {
            chatStore.showToast('Passwords do not match', 'error');
            return false;
        }

        if (pass.length < 8)
        {
            chatStore.showToast('Password must be at least 8 characters long', 'error');
            return false;
        }

        try
        {
            const serverKey = await fetchAuthParams();
            const keyPair = await generateKeyPair();
            const publicKeyStr = await exportPublicKey(keyPair.publicKey);
            const passwordKey = await deriveKeyFromPassword(pass, user);
            const encryptedPrivateKeyStr = await encryptPrivateKey(keyPair.privateKey, passwordKey);
            const authHash = await hashPasswordWithServerKey(pass, serverKey);

            const result = await apiRegister({
                username: user,
                password: authHash,
                publicKey: publicKeyStr,
                privateKey: encryptedPrivateKeyStr
            });

            if (result.success)
            {
                await login(user, pass);
                return true;
            }
            else
            {
                chatStore.showToast('Registration failed: ' + result.message, 'error');
                return false;
            }
        }
        catch (e: any)
        {
            console.error(e);
            chatStore.showToast('Error during registration: ' + e.message, 'error');
            return false;
        }
    }

    async function getMyPublicKey(): Promise<CryptoKey | null>
    {
        if (!currentUser.value?.publicKey) return null;
        return await importPublicKey(currentUser.value.publicKey);
    }

    function logout(): void
    {
        // 清空 localStorage 中的登录信息
        localStorage.removeItem('authToken');
        localStorage.removeItem('passwordKey');
        localStorage.removeItem('username');
        window.location.reload();
    }

    // 存储登录信息到 localStorage
    async function saveLoginToStorage(): Promise<void>
    {
        if (authToken.value && passwordKey.value && username.value)
        {
            localStorage.setItem('authToken', authToken.value);
            localStorage.setItem('passwordKey', await exportPasswordKey(passwordKey.value));
            localStorage.setItem('username', username.value);
        }
    }

    // 从 localStorage 加载登录信息并尝试自动登录
    async function tryAutoLogin(): Promise<boolean>
    {
        const storedAuthToken = localStorage.getItem('authToken');
        const storedPasswordKey = localStorage.getItem('passwordKey');
        const storedUsername = localStorage.getItem('username');

        if (storedAuthToken && storedPasswordKey && storedUsername)
        {
            useChatStore().showToast('Attempting auto login...', 'info');
            try
            {
                authToken.value = storedAuthToken;
                passwordKey.value = await importPasswordKey(storedPasswordKey);
                username.value = storedUsername;
                
                // 发送登录请求
                const packet = {
                    username: storedUsername,
                    password: storedAuthToken
                };
                wsService.sendPacketDirect('login', packet);
                return true;
            }
            catch (e)
            {
                console.error('Auto login failed', e);
                // 清空无效的存储
                localStorage.removeItem('authToken');
                localStorage.removeItem('passwordKey');
                localStorage.removeItem('username');
                return false;
            }
        }
        return false;
    }

    function getAvatarUrl(): string
    {
        if (!currentUser.value) return '';
        const id = userId.value;
        return `/api/user/${id}/avatar?t=${Date.now()}`;
    }

    return {
        currentUser,
        privateKey,
        authToken,
        passwordKey,
        username,
        isAuthenticated,
        userId,
        login,
        relogin,
        handleLoginSuccess,
        register,
        getMyPublicKey,
        logout,
        getAvatarUrl,
        tryAutoLogin
    };
});
