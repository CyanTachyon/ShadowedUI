/**
 * Type definitions for the application
 */

export interface User
{
    id: number | { value: number; };
    username: string;
    publicKey?: string;
    privateKey?: string;
    signature?: string;
}

export interface Chat
{
    chatId: number;
    name: string | null;
    isPrivate: boolean;
    key: string;
    unreadCount?: number;
    parsedOtherIds?: number[];
    parsedOtherNames?: string[];
    ownerId?: number;
    doNotDisturb: boolean;
    burnTime?: number | null; // 阅后即焚时间（毫秒），null或undefined表示关闭
}

export interface ReplyInfo
{
    messageId: number;
    content: string;
    senderId: number;
    senderName: string;
    type: 'TEXT' | 'IMAGE';
}

export interface Message
{
    id: number;
    chatId: number;
    senderId: number;
    senderName?: string;
    content: string;
    type: 'TEXT' | 'IMAGE';
    time: string;
    replyTo?: ReplyInfo;
    readAt?: number | null; // 已读时间戳，null或undefined表示未读
}

export interface Broadcast
{
    id: number;
    senderId: number | null;
    senderName?: string;
    content: string;
    time: string;
    system: boolean;
}

export interface ChatMember
{
    id: number;
    username: string;
    signature?: string;
}

export interface ChatDetails
{
    chat: {
        id: number;
        name: string | null;
        isPrivate: boolean;
        ownerId: number | null;
        members: ChatMember[];
    };
}

export interface Friend
{
    id: number;
    username: string;
}

export interface Moment
{
    messageId: number;
    content: string;
    type: 'TEXT' | 'IMAGE';
    ownerId: number;
    ownerName: string;
    time: number;
    key: string;
}

export interface MomentPermission
{
    friendId: number;
    canFriendViewMine: boolean;
    canIViewFriends: boolean;
}

export type ToastType = 'info' | 'error' | 'success';

export interface Toast
{
    id: number;
    message: string;
    type: ToastType;
    onClick?: () => void;
}
