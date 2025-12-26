/**
 * General utility functions
 */

export async function getImageSizeFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<{ width: number; height: number; }>
{
    const blob = new Blob([arrayBuffer]);
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
}

export function isMobileDevice(): boolean
{
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function formatDate(date: string | Date): string
{
    return new Date(date).toLocaleString();
}

export function getAvatarUrl(userId: number): string
{
    return `/api/user/${userId}/avatar`;
}

export function getUserId(id: number | { value: number; }): number
{
    return typeof id === 'object' && id.value ? id.value : id as number;
}

export function isPageInForeground()
{
    return document.visibilityState === 'visible' && document.hasFocus();
}