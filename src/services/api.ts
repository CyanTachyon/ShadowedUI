/**
 * API service for HTTP requests
 */

import type { ProjectInfo } from '@/types';

let authKey: string | null = null;

export async function fetchAuthParams(): Promise<string>
{
    if (authKey) return authKey;
    const response = await fetch('/api/auth/params');
    const data = await response.json();
    authKey = data.authKey;
    return authKey!;
}

export interface RegisterPayload
{
    username: string;
    password: string;
    publicKey: string;
    privateKey: string;
}

export async function register(payload: RegisterPayload): Promise<{ success: boolean; message?: string; }>
{
    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function fetchPublicKeyByUsername(username: string): Promise<string | null>
{
    try
    {
        const res = await fetch('/api/user/publicKey?username=' + encodeURIComponent(username), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.status === 200)
        {
            const data = await res.json();
            return data.publicKey;
        }
        return null;
    }
    catch (e)
    {
        console.error(e);
        return null;
    }
}

export async function uploadAvatar(file: File, username: string, authToken: string): Promise<Response>
{
    if (file.size > 2 * 1024 * 1024)
    {
        throw new Error('Image too large (max 2MB)');
    }

    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: {
            'X-Auth-User': username,
            'X-Auth-Token': authToken
        },
        body: formData
    });

    if (!response.ok)
    {
        throw new Error('Failed to upload avatar');
    }

    return response;
}

export interface ResetPasswordPayload
{
    username: string;
    oldPassword: string;
    newPassword: string;
    privateKey: string;
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<{ success: boolean; message?: string; }>
{
    const response = await fetch('/api/resetPassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function sendFileMessage(
    encrypted: string,
    metadata: string,
    chatId: number,
    username: string,
    authToken: string
): Promise<Response>
{
    return fetch('/api/send_file', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
            'X-Auth-Token': authToken,
            'X-Chat-Id': String(chatId),
            'X-Message-Type': 'image',
            'X-Auth-User': username,
            'X-Message-Metadata': metadata
        },
        body: encrypted
    });
}

export async function fetchMessageFile(messageId: number): Promise<string>
{
    const res = await fetch(`/api/file/${messageId}`);
    return res.text();
}

export async function fetchUserInfo(userId: number): Promise<{ id: number; username: string; signature: string | null; } | null>
{
    try
    {
        const res = await fetch(`/api/user/info?id=${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.status === 200)
        {
            const data = await res.json();
            return data;
        }
        return null;
    }
    catch (e)
    {
        console.error('Failed to fetch user info:', e);
        return null;
    }
}

export async function fetchProjectInfo(): Promise<ProjectInfo | null>
{
    try
    {
        const res = await fetch('/api/project', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.status === 200)
        {
            const data = await res.json();
            return data;
        }
        return null;
    }
    catch (e)
    {
        console.error('Failed to fetch project info:', e);
        return null;
    }
}
