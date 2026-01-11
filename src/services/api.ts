/**
 * API service for HTTP requests
 */

import type { ProjectInfo } from '@/types';
import { wsService } from './websocket';

let authKey: string | null = null;

// Send packet via WebSocket
export function sendPacket(type: string, payload: object): void
{
    wsService.sendPacket(type, payload);
}

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

export async function uploadGroupAvatar(file: File, chatId: number, username: string, authToken: string): Promise<Response>
{
    if (file.size > 2 * 1024 * 1024)
    {
        throw new Error('Image too large (max 2MB)');
    }

    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(`/api/group/${chatId}/avatar`, {
        method: 'POST',
        headers: {
            'X-Auth-User': username,
            'X-Auth-Token': authToken
        },
        body: formData
    });

    if (!response.ok)
    {
        throw new Error('Failed to upload group avatar');
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
    authToken: string,
    messageType: 'IMAGE' | 'VIDEO' | 'FILE' = 'IMAGE'
): Promise<Response>
{
    return fetch('/api/send_file', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
            'X-Auth-Token': authToken,
            'X-Chat-Id': String(chatId),
            'X-Message-Type': messageType,
            'X-Auth-User': username,
            'X-Message-Metadata': metadata
        },
        body: encrypted
    });
}

// === 分片上传 API ===

export interface InitUploadResponse
{
    uploadId: string;
    chunkSize: number;
}

/**
 * 初始化分片上传任务
 */
export async function initChunkedUpload(
    chatId: number,
    messageType: 'IMAGE' | 'VIDEO' | 'FILE',
    metadata: string,
    totalChunks: number,
    totalSize: number,
    username: string,
    authToken: string
): Promise<InitUploadResponse>
{
    const res = await fetch('/api/upload/init', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-User': username,
            'X-Auth-Token': authToken
        },
        body: JSON.stringify({
            chatId,
            messageType,
            metadata,
            totalChunks,
            totalSize
        })
    });

    if (!res.ok)
    {
        const text = await res.text();
        throw new Error(`Failed to init upload: ${res.status} ${text}`);
    }

    return res.json();
}

/**
 * 上传单个分片
 */
export async function uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkData: ArrayBuffer,
    username: string,
    authToken: string,
    onProgress?: (loaded: number, total: number) => void
): Promise<{ chunkIndex: number; uploadedCount: number; }>
{
    return new Promise((resolve, reject) =>
    {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/upload/${uploadId}/chunk/${chunkIndex}`);
        xhr.setRequestHeader('X-Auth-User', username);
        xhr.setRequestHeader('X-Auth-Token', authToken);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

        if (onProgress)
        {
            xhr.upload.onprogress = (e) =>
            {
                if (e.lengthComputable)
                {
                    onProgress(e.loaded, e.total);
                }
            };
        }

        xhr.onload = () =>
        {
            if (xhr.status >= 200 && xhr.status < 300)
            {
                resolve(JSON.parse(xhr.responseText));
            }
            else
            {
                reject(new Error(`Upload chunk failed: ${xhr.status} ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during chunk upload'));
        xhr.onabort = () => reject(new Error('Upload aborted'));

        xhr.send(chunkData);
    });
}

/**
 * 获取上传状态
 */
export async function getUploadStatus(
    uploadId: string,
    username: string,
    authToken: string
): Promise<{ uploadId: string; totalChunks: number; uploadedChunks: number[]; isComplete: boolean; }>
{
    const res = await fetch(`/api/upload/${uploadId}/status`, {
        method: 'GET',
        headers: {
            'X-Auth-User': username,
            'X-Auth-Token': authToken
        }
    });

    if (!res.ok)
    {
        throw new Error(`Failed to get upload status: ${res.status}`);
    }

    return res.json();
}

/**
 * 完成上传
 */
export async function completeUpload(
    uploadId: string,
    username: string,
    authToken: string
): Promise<{ messageId: number; }>
{
    const res = await fetch(`/api/upload/${uploadId}/complete`, {
        method: 'POST',
        headers: {
            'X-Auth-User': username,
            'X-Auth-Token': authToken
        }
    });

    if (!res.ok)
    {
        const text = await res.text();
        throw new Error(`Failed to complete upload: ${res.status} ${text}`);
    }

    return res.json();
}

/**
 * 取消上传
 */
export async function cancelUpload(
    uploadId: string,
    username: string,
    authToken: string
): Promise<void>
{
    await fetch(`/api/upload/${uploadId}`, {
        method: 'DELETE',
        headers: {
            'X-Auth-User': username,
            'X-Auth-Token': authToken
        }
    });
}

/**
 * 获取文件大小（用于下载进度）
 */
export async function getFileSize(messageId: number): Promise<number>
{
    const res = await fetch(`/api/file/${messageId}`, { method: 'HEAD' });
    const contentLength = res.headers.get('Content-Length');
    return contentLength ? parseInt(contentLength, 10) : 0;
}

/**
 * 下载文件（带进度回调）
 */
export async function downloadFile(
    messageId: number,
    onProgress?: (loaded: number, total: number) => void
): Promise<string>
{
    return new Promise((resolve, reject) =>
    {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/api/file/${messageId}`);
        xhr.responseType = 'text';

        if (onProgress)
        {
            xhr.onprogress = (e) =>
            {
                if (e.lengthComputable)
                {
                    onProgress(e.loaded, e.total);
                }
            };
        }

        xhr.onload = () =>
        {
            if (xhr.status >= 200 && xhr.status < 300)
            {
                resolve(xhr.responseText);
            }
            else
            {
                reject(new Error(`Download failed: ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during download'));
        xhr.send();
    });
}

export async function fetchMessageFile(messageId: number): Promise<string>
{
    const res = await fetch(`/api/file/${messageId}`);
    return res.text();
}

export async function fetchUserInfo(userId: number): Promise<{ id: number; username: string; signature: string | null; isDonor: boolean; } | null>
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

export async function fetchUserInfoByUsername(username: string): Promise<{ id: number; username: string; signature: string | null; isDonor: boolean; } | null>
{
    try
    {
        const res = await fetch(`/api/user/info?username=${encodeURIComponent(username)}`, {
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
        console.error('Failed to fetch user info by username:', e);
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
