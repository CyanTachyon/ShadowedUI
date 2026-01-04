/**
 * WebSocket service for real-time communication
 */

import { useChatStore } from "@/stores";

type PacketHandler = (data: any) => Promise<void> | void;

interface PendingMessage
{
    message: string;
    resolve: () => void;
}

class WebSocketService
{
    private socket: WebSocket | null = null;
    private handlers = new Map<string, Set<PacketHandler>>();
    private packetLock: Promise<void> | null = null;
    private onConnectCallback: (() => void) | null = null;

    // 待发送消息队列
    private pendingMessages: PendingMessage[] = [];
    private isLoggedIn = false;

    connect(): void
    {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.socket = new WebSocket(`${protocol}//${window.location.host}/api/socket`);

        this.socket.onopen = () =>
        {
            this.onConnectCallback?.();
        };

        this.socket.onmessage = async (event: MessageEvent) =>
        {
            const data = JSON.parse(event.data);
            await this.handlePacket(data);
        };

        this.socket.onerror = () => this.handleDisconnect();
        this.socket.onclose = () => this.handleDisconnect();
    }

    private handleDisconnect(): void
    {
        this.isLoggedIn = false;
        useChatStore().showToast('Connection lost. will reload the page...', 'error');
        setTimeout(() => window.location.reload(), 1500);
    }

    // 通知登录完成，发送待发送队列中的消息
    notifyLoggedIn(): void
    {
        this.isLoggedIn = true;
        this.flushPendingMessages();
    }

    private flushPendingMessages(): void
    {
        if (!this.isLoggedIn || !this.socket || this.socket.readyState !== WebSocket.OPEN)
        {
            return;
        }

        while (this.pendingMessages.length > 0)
        {
            const pending = this.pendingMessages.shift()!;
            this.socket.send(pending.message);
            pending.resolve();
        }
    }

    private async handlePacket(data: any): Promise<void>
    {
        while (this.packetLock) await this.packetLock;
        let resolve: () => void;
        this.packetLock = new Promise(r => (resolve = r));

        try
        {
            const handlers = this.handlers.get(data.packet);
            if (handlers)
            {
                for (const handler of handlers)
                {
                    await handler(data);
                }
            }
        }
        finally
        {
            resolve!();
            this.packetLock = null;
        }
    }

    on(packet: string, handler: PacketHandler): void
    {
        if (!this.handlers.has(packet))
        {
            this.handlers.set(packet, new Set());
        }
        this.handlers.get(packet)!.add(handler);
    }

    off(packet: string, handler?: PacketHandler): void
    {
        if (handler)
        {
            // Only remove if the specific handler matches
            const handlers = this.handlers.get(packet);
            if (handlers)
            {
                handlers.delete(handler);
                if (handlers.size === 0)
                {
                    this.handlers.delete(packet);
                }
            }
        } 
        else
        {
            // Remove all handlers for this packet
            this.handlers.delete(packet);
        }
    }

    onConnect(callback: () => void): void
    {
        this.onConnectCallback = callback;
    }

    send(message: string): void
    {
        if (this.isLoggedIn && this.socket && this.socket.readyState === WebSocket.OPEN)
        {
            this.socket.send(message);
        }
        else
        {
            // 连接断开或未登录，加入待发送队列
            this.pendingMessages.push({
                message,
                resolve: () => {}
            });
        }
    }

    // 直接发送，不经过队列（用于登录包）
    sendDirect(message: string): void
    {
        if (this.socket && this.socket.readyState === WebSocket.OPEN)
        {
            this.socket.send(message);
        }
    }

    sendPacket(type: string, payload: object): void
    {
        this.send(`${type}\n${JSON.stringify(payload)}`);
    }

    // 直接发送包，不经过队列（用于登录包）
    sendPacketDirect(type: string, payload: object): void
    {
        this.sendDirect(`${type}\n${JSON.stringify(payload)}`);
    }

    isConnected(): boolean
    {
        return this.socket?.readyState === WebSocket.OPEN;
    }
}

export const wsService = new WebSocketService();
