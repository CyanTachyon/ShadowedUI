/**
 * WebSocket service for real-time communication
 */

type PacketHandler = (data: any) => Promise<void> | void;

interface PendingMessage
{
    message: string;
    resolve: () => void;
}

class WebSocketService
{
    private socket: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private handlers = new Map<string, PacketHandler>();
    private packetLock: Promise<void> | null = null;
    private onConnectCallback: (() => void) | null = null;
    private onDisconnectCallback: (() => void) | null = null;
    
    // 待发送消息队列
    private pendingMessages: PendingMessage[] = [];
    private isLoggedIn = false;

    connect(): void
    {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.socket = new WebSocket(`${protocol}//${window.location.host}/api/socket`);

        this.socket.onopen = () =>
        {
            console.log('Connected to WebSocket');
            this.reconnectAttempts = 0;
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
        console.log('Disconnected');
        this.isLoggedIn = false;
        if (this.reconnectAttempts < this.maxReconnectAttempts)
        {
            this.reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
            setTimeout(() => this.connect(), 1000);
        }
        else
        {
            // 清空待发送队列
            this.pendingMessages = [];
            this.onDisconnectCallback?.();
        }
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
            const handler = this.handlers.get(data.packet);
            if (handler)
                await handler(data)
        } 
        finally
        {
            resolve!();
            this.packetLock = null;
        }
    }

    on(packet: string, handler: PacketHandler): void
    {
        this.handlers.set(packet, handler);
    }

    onConnect(callback: () => void): void
    {
        this.onConnectCallback = callback;
    }

    onDisconnect(callback: () => void): void
    {
        this.onDisconnectCallback = callback;
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
                resolve: () => { }
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
