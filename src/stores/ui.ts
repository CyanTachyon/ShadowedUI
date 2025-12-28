import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ViewState = 'list' | 'chat' | 'settings';

export const useUIStore = defineStore('ui', () =>
{
    const theme = ref<'dark' | 'light'>(
        (localStorage.getItem('theme') as 'dark' | 'light') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );

    const chatBackground = ref<string | null>(localStorage.getItem('chatBackground'));

    const viewState = ref<ViewState>('list');
    const showAddFriendModal = ref(false);
    const showCreateGroupModal = ref(false);
    const showResetPasswordModal = ref(false);
    const showKickMemberModal = ref(false);
    const showDeleteChatModal = ref(false);
    const showUserMenu = ref(false);
    const showAddMenu = ref(false);

    // Kick member modal state
    const kickMemberTarget = ref<{ chatId: number; chatName: string; userId: number; username: string; } | null>(null);
    
    // Delete chat modal state
    const deleteChatTarget = ref<{ chatId: number; userId: number; name: string; isGroup: boolean } | null>(null);

    function toggleTheme(): void
    {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', theme.value);
        document.documentElement.setAttribute('data-theme', theme.value);
    }

    function initTheme(): void
    {
        document.documentElement.setAttribute('data-theme', theme.value);
    }

    function setViewState(state: ViewState): void
    {
        viewState.value = state;

        if (state === 'chat')
        {
            document.body.classList.add('view-chat');
            document.body.classList.remove('view-settings');
        }
        else if (state === 'settings')
        {
            document.body.classList.add('view-chat');
            document.body.classList.add('view-settings');
        }
        else
        {
            document.body.classList.remove('view-chat');
            document.body.classList.remove('view-settings');
        }
    }

    function closeAllMenus(): void
    {
        showUserMenu.value = false;
        showAddMenu.value = false;
    }

    function openKickMemberModal(chatId: number, chatName: string, userId: number, username: string): void
    {
        kickMemberTarget.value = { chatId, chatName, userId, username };
        showKickMemberModal.value = true;
    }

    function closeKickMemberModal(): void
    {
        showKickMemberModal.value = false;
        kickMemberTarget.value = null;
    }

    function openDeleteChatModal(chatId: number, userId: number, name: string, isGroup: boolean): void
    {
        deleteChatTarget.value = { chatId, userId, name, isGroup };
        showDeleteChatModal.value = true;
    }

    function closeDeleteChatModal(): void
    {
        showDeleteChatModal.value = false;
        deleteChatTarget.value = null;
    }

    function setChatBackground(imageData: string | null): void
    {
        chatBackground.value = imageData;
        if (imageData)
        {
            localStorage.setItem('chatBackground', imageData);
        }
        else
        {
            localStorage.removeItem('chatBackground');
        }
    }

    return {
        theme,
        viewState,
        showAddFriendModal,
        showCreateGroupModal,
        showResetPasswordModal,
        showKickMemberModal,
        showDeleteChatModal,
        showUserMenu,
        showAddMenu,
        kickMemberTarget,
        deleteChatTarget,
        toggleTheme,
        initTheme,
        setViewState,
        closeAllMenus,
        openKickMemberModal,
        closeKickMemberModal,
        openDeleteChatModal,
        closeDeleteChatModal,
        chatBackground,
        setChatBackground
    };
});
