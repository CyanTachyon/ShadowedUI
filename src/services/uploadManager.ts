/**
 * 上传任务管理器 - 使用 IndexedDB 持久化上传状态以支持断点续传
 */

import type { UploadTask, UploadStatus } from '../types';

const DB_NAME = 'ShadowedChatUploadDB';
const DB_VERSION = 1;
const STORE_NAME = 'uploadTasks';
const CHUNKS_STORE_NAME = 'uploadChunks';

let dbInstance: IDBDatabase | null = null;

/**
 * 打开或创建 IndexedDB 数据库
 */
async function openDB(): Promise<IDBDatabase>
{
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) =>
    {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onsuccess = () =>
        {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) =>
        {
            const db = (event.target as IDBOpenDBRequest).result;

            // 上传任务存储
            if (!db.objectStoreNames.contains(STORE_NAME))
            {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('chatId', 'chatId', { unique: false });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }

            // 加密后的分片数据存储
            if (!db.objectStoreNames.contains(CHUNKS_STORE_NAME))
            {
                const chunksStore = db.createObjectStore(CHUNKS_STORE_NAME, { keyPath: ['taskId', 'index'] });
                chunksStore.createIndex('taskId', 'taskId', { unique: false });
            }
        };
    });
}

/**
 * 保存上传任务
 */
export async function saveUploadTask(task: UploadTask): Promise<void>
{
    const db = await openDB();
    return new Promise((resolve, reject) =>
    {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(task);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * 获取上传任务
 */
export async function getUploadTask(taskId: string): Promise<UploadTask | null>
{
    const db = await openDB();
    return new Promise((resolve, reject) =>
    {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(taskId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 删除上传任务及其分片
 */
export async function deleteUploadTask(taskId: string): Promise<void>
{
    const db = await openDB();

    // 删除任务
    await new Promise<void>((resolve, reject) =>
    {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(taskId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });

    // 删除所有相关分片
    await deleteTaskChunks(taskId);
}

/**
 * 获取所有未完成的上传任务
 */
export async function getIncompleteTasks(): Promise<UploadTask[]>
{
    const db = await openDB();
    return new Promise((resolve, reject) =>
    {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () =>
        {
            const tasks = request.result as UploadTask[];
            // 过滤出未完成的任务
            const incomplete = tasks.filter(
                t => t.status === 'pending' || t.status === 'uploading' || t.status === 'paused'
            );
            resolve(incomplete);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * 更新任务状态
 */
export async function updateTaskStatus(taskId: string, status: UploadStatus): Promise<void>
{
    const db = await openDB();
    return new Promise((resolve, reject) =>
    {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Get task first, then update
        const getRequest = store.get(taskId);
        getRequest.onsuccess = () =>
        {
            const task = getRequest.result as UploadTask | undefined;
            if (task)
            {
                task.status = status;
                // Create a clean copy to avoid DataCloneError
                const cleanTask = {
                    ...task
                };
                const putRequest = store.put(cleanTask);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            }
            else
            {
                resolve();
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * 更新已上传的分片列表
 */
export async function updateUploadedChunks(taskId: string, uploadedChunks: number[]): Promise<void>
{
    const db = await openDB();
    return new Promise((resolve, reject) =>
    {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Get task first, then update
        const getRequest = store.get(taskId);
        getRequest.onsuccess = () =>
        {
            const task = getRequest.result as UploadTask | undefined;
            if (task)
            {
                task.uploadedChunks = uploadedChunks;
                // Create a clean copy to avoid DataCloneError
                const cleanTask = {
                    ...task
                };
                const putRequest = store.put(cleanTask);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            }
            else
            {
                resolve();
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * 保存加密后的分片数据
 */
export async function saveChunkData(taskId: string, index: number, data: ArrayBuffer): Promise<void>
{
    const db = await openDB();
    return new Promise((resolve, reject) =>
    {
        const transaction = db.transaction(CHUNKS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CHUNKS_STORE_NAME);
        const request = store.put({ taskId, index, data });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * 获取分片数据
 */
export async function getChunkData(taskId: string, index: number): Promise<ArrayBuffer | null>
{
    const db = await openDB();
    return new Promise((resolve, reject) =>
    {
        const transaction = db.transaction(CHUNKS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(CHUNKS_STORE_NAME);
        const request = store.get([taskId, index]);

        request.onsuccess = () =>
        {
            const result = request.result;
            resolve(result ? result.data : null);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * 删除任务的所有分片
 */
export async function deleteTaskChunks(taskId: string): Promise<void>
{
    const db = await openDB();
    return new Promise((resolve, reject) =>
    {
        const transaction = db.transaction(CHUNKS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CHUNKS_STORE_NAME);
        const index = store.index('taskId');
        const request = index.openCursor(IDBKeyRange.only(taskId));

        request.onsuccess = (event) =>
        {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor)
            {
                cursor.delete();
                cursor.continue();
            }
            else
            {
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * 获取任务所有已存储的分片索引
 */
export async function getStoredChunkIndexes(taskId: string): Promise<number[]>
{
    const db = await openDB();
    return new Promise((resolve, reject) =>
    {
        const transaction = db.transaction(CHUNKS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(CHUNKS_STORE_NAME);
        const index = store.index('taskId');
        const request = index.getAllKeys(IDBKeyRange.only(taskId));

        request.onsuccess = () =>
        {
            const keys = request.result as [string, number][];
            const indexes = keys.map(k => k[1]).sort((a, b) => a - b);
            resolve(indexes);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * 清理过期任务（超过24小时的失败或已完成任务）
 */
export async function cleanupExpiredTasks(): Promise<void>
{
    const db = await openDB();
    const expireTime = Date.now() - 24 * 60 * 60 * 1000;

    const tasks = await new Promise<UploadTask[]>((resolve, reject) =>
    {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    for (const task of tasks)
    {
        if (task.createdAt < expireTime &&
            (task.status === 'completed' || task.status === 'failed'))
        {
            await deleteUploadTask(task.id);
        }
    }
}

/**
 * 生成唯一任务 ID
 */
export function generateTaskId(): string
{
    return crypto.randomUUID();
}
