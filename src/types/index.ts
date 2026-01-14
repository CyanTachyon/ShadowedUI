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
    isDonor?: boolean;
}

export interface ChatMember
{
    id: number;
    name: string;
}

export interface Chat
{
    chatId: number;
    name: string | null;
    isPrivate: boolean;
    key: string;
    unreadCount?: number;
    members?: ChatMember[];
    ownerId?: number;
    doNotDisturb: boolean;
    burnTime?: number | null; // 阅后即焚时间（毫秒），null或undefined表示关闭
    otherUserIsDonor?: boolean; // 私聊对方是否是捐赠者（仅私聊有效）
}

export interface ReplyInfo
{
    messageId: number;
    content: string;
    senderId: number;
    senderName: string;
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE';
}

export interface Reaction
{
    emoji: string;
    userIds: number[];
}

export interface Message
{
    id: number;
    chatId: number;
    senderId: number | null;
    senderName: string | null;
    senderIsDonor: boolean;
    content: string;
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE';
    time: number;
    replyTo: ReplyInfo | null;
    readAt: number | null;
    burn: number | null;
    reactions?: Reaction[];
}

// 图片元数据
export interface ImageMetadata
{
    width: number;
    height: number;
    size: number;
}

// 视频元数据
export interface VideoMetadata
{
    width: number;
    height: number;
    duration: number;        // 视频时长（秒）
    size: number;            // 文件大小（字节）
    fileName?: string;       // 原始文件名
    thumbnailBase64: string; // 缩略图 Base64
}

// 文件元数据
export interface FileMetadata
{
    fileName: string;        // 原始文件名
    size: number;            // 文件大小（字节）
    mimeType?: string;       // MIME 类型
}

// 上传任务状态
export type UploadStatus = 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';

// 上传任务
export interface UploadTask
{
    id: string;                    // 唯一标识 (UUID)
    chatId: number;
    fileName: string;
    fileType: 'IMAGE' | 'VIDEO' | 'FILE';
    totalSize: number;
    encryptedSize: number;         // 加密后总大小
    chunkSize: number;
    totalChunks: number;
    uploadedChunks: number[];      // 已上传的分片索引
    chatKeyJwk: string;            // 导出的聊天密钥（raw格式base64）
    metadata: string;              // 加密后的元数据
    serverUploadId?: string;       // 服务器返回的上传ID
    createdAt: number;
    status: UploadStatus;
}

export interface Broadcast
{
    id: number;
    senderId: number | null;
    senderName?: string;
    content: string;
    time: string;
    system: boolean;
    senderIsDonor?: boolean;
}

export interface ChatMember
{
    id: number;
    username: string;
    signature?: string;
    isDonor?: boolean;
    isOnline?: boolean;
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
    canViewMoments?: boolean;
}

export interface Moment
{
    messageId: number;
    content: string;
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE';
    ownerId: number;
    ownerName: string;
    time: number;
    key: string;
    ownerIsDonor?: boolean;
    reactions: Reaction[];
    comments?: MomentComment[];
    commentCount?: number;
}

export interface MomentComment
{
    id: number;
    content: string;
    senderId: number;
    senderName: string;
    time: number;
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE';
    senderIsDonor?: boolean;
}

export interface MomentPermission
{
    friendId: number;
    canFriendViewMine: boolean;
    canIViewFriends: boolean;
}

export type ToastType = 'info' | 'error' | 'success' | 'warning';

export interface Toast
{
    id: number;
    message: string;
    type: ToastType;
    onClick?: () => void;
}

export interface DeveloperInfo
{
    name: string;
    website: string | null;
    github: string | null;
}

export interface DonorInfo
{
    id: number | { value: number; };
    username: string;
    isDonor: boolean;
    donationAmount: number; // 单位：分
}

export interface ProjectInfo
{
    name: string;
    website: string | null;
    version: string;
    developer: DeveloperInfo;
    donation: {
        wechatQrCode: string | null;
        alipayQrCode: string | null;
    };
    donors: DonorInfo[];
}
