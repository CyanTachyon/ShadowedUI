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

/**
 * 从视频文件生成缩略图
 * @param file 视频文件
 * @param seekTime 截取帧的时间点（秒），默认1秒
 * @param maxWidth 缩略图最大宽度，默认320px
 * @returns 缩略图 Blob 及视频信息
 */
export async function generateVideoThumbnail(
    file: File,
    seekTime: number = 1,
    maxWidth: number = 320
): Promise<{ thumbnail: Blob; width: number; height: number; duration: number; }>
{

    return new Promise((resolve, reject) =>
    {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;

        const cleanup = () =>
        {
            URL.revokeObjectURL(objectUrl);
            video.remove();
        };

        video.onerror = () =>
        {
            console.error('[generateVideoThumbnail] Video error event triggered');
            console.error('[generateVideoThumbnail] Video error details:', {
                error: video.error,
                errorCode: video.error?.code,
                errorMessage: video.error?.message,
                networkState: video.networkState,
                readyState: video.readyState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                duration: video.duration,
                currentSrc: video.currentSrc,
                src: video.src
            });
            cleanup();
            reject(new Error('Failed to load video'));
        };

        video.onloadedmetadata = () =>
        {

            const duration = video.duration;

            // 跳转到指定时间点（确保不超过视频长度）
            video.currentTime = Math.min(seekTime, duration * 0.1);
        };

        video.onseeked = () =>
        {

            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            const duration = video.duration;


            // 计算缩略图尺寸
            const scale = Math.min(1, maxWidth / videoWidth);
            const thumbWidth = Math.round(videoWidth * scale);
            const thumbHeight = Math.round(videoHeight * scale);


            // 创建 Canvas 绘制缩略图
            const canvas = document.createElement('canvas');
            canvas.width = thumbWidth;
            canvas.height = thumbHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx)
            {
                console.error('[generateVideoThumbnail] Failed to get canvas context');
                cleanup();
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);

            canvas.toBlob(
                (blob) =>
                {
                    cleanup();
                    if (blob)
                    {
                        resolve({
                            thumbnail: blob,
                            width: videoWidth,
                            height: videoHeight,
                            duration
                        });
                    }
                    else
                    {
                        console.error('[generateVideoThumbnail] Failed to create thumbnail blob');
                        reject(new Error('Failed to create thumbnail blob'));
                    }
                },
                'image/jpeg',
                0.7
            );
        };

        // Add timeout to detect hanging video load
        const timeout = setTimeout(() => {
            console.error('[generateVideoThumbnail] Timeout waiting for video to load');
            cleanup();
            reject(new Error('Timeout loading video'));
        }, 30000); // 30 second timeout

        video.onloadeddata = () => {
            clearTimeout(timeout);
        };
    });
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string
{
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * 格式化视频时长
 */
export function formatDuration(seconds: number): string
{
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(fileName: string): string
{
    const lastDot = fileName.lastIndexOf('.');
    return lastDot >= 0 ? fileName.substring(lastDot + 1).toLowerCase() : '';
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

/**
 * Parse @ mentions from message content
 * Matches pattern: (start of line OR space) + @ + username (a-zA-Z0-9_) + (space OR end of line)
 * @param content - The message content to parse
 * @returns Array of chunks (text or at mention)
 */
export function parseAtMentions(content: string): Array<{ type: 'text' | 'at'; content: string; username?: string; }>
{
    const chunks: Array<{ type: 'text' | 'at'; content: string; username?: string; }> = [];
    const regex = /(?:^|\s)@([a-zA-Z0-9_]+)(?:\s|$)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null)
    {
        // Add text before @ mention
        if (match.index > lastIndex)
        {
            chunks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
        }

        // Add @ mention (including the leading space/end marker and trailing space/end marker)
        chunks.push({ type: 'at', content: match[0], username: match[1] });

        lastIndex = regex.lastIndex;
    }

    // Add remaining text after last @ mention
    if (lastIndex < content.length)
    {
        chunks.push({ type: 'text', content: content.slice(lastIndex) });
    }

    return chunks;
}