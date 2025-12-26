/**
 * Type definitions for the application
 */

export interface User
{
    id: number | { value: number; };
    username: string;
    publicKey?: string;
    privateKey?: string;
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
}

export interface Message
{
    id: number;
    chatId: number;
    senderId: number;
    senderName?: string;
    content: string;
    type: 'text' | 'image';
    time: string;
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

export type ToastType = 'info' | 'error' | 'success';

export interface Toast
{
    id: number;
    message: string;
    type: ToastType;
    onClick?: () => void;
}
