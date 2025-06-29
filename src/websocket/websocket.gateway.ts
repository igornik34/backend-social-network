import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage, WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import {MessagesService} from "../messages/messages.service";
import {UpdateMessageDto} from "../messages/dto/update-message.dto";
import {CreateReactionDto} from "../messages/dto/create-reaction.dto";
import {NotificationsGateway} from "../notifications/notifications.gateway";

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true
  },
  namespace: '/chat',
  maxHttpBufferSize: 1e8
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly USER_CHAT_CONNECTIONS_KEY = 'user_chat_connections';

  constructor(
      private jwtService: JwtService,
      private redisService: RedisService,
      private messagesService: MessagesService,
      private notificationsGateway: NotificationsGateway
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const userId = this.getUserIdFromSocket(socket);
      console.log("CONV", userId, socket.handshake.query)
      if (!userId) {
        throw new Error('Invalid token');
      }

      const conversationId = (socket.handshake.query?.conversationId ||
          socket.handshake.headers['conversation-id']) as string;

      if (!conversationId) {
        throw new Error('Conversation ID is required for chat connection');
      }


      await this.handleChatConnection(userId, conversationId, socket);

    } catch (e) {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = this.getUserIdFromSocket(socket);
    if (!userId) return;

    const conversationId = socket.handshake.query.conversationId as string;
    if (conversationId) {
      await this.removeChatConnection(userId, conversationId);
    }
  }

  private async handleChatConnection(userId: string, conversationId: string, socket: Socket) {
    // Сохраняем соединение чата в Redis
    await this.redisService.hSet(
        `${this.USER_CHAT_CONNECTIONS_KEY}:${userId}`,
        conversationId,
        socket.id
    );
    // Устанавливаем TTL для всего хэша
    await this.redisService.expire(`${this.USER_CHAT_CONNECTIONS_KEY}:${userId}`, 3600);

    socket.join(`conversation_${conversationId}`);
    console.log(`User ${userId} connected to chat ${conversationId}`);
  }

  private async removeChatConnection(userId: string, conversationId: string) {
    await this.redisService.hDel(`${this.USER_CHAT_CONNECTIONS_KEY}:${userId}`, conversationId);
  }

  // Отправка сообщений в чат
  async sendChatMessage(conversationId: string, message: any) {
    this.server.to(`conversation_${conversationId}`).emit('new-message', message);
  }

  // Отправка сообщений в чат
  async markAsReadMessages(conversationId: string, message: any) {
    this.server.to(`conversation_${conversationId}`).emit('marked-messages', message);
  }

  // Отправка сообщений в чат
  async sendChatReaction(conversationId: string, message: any) {
    this.server.to(`conversation_${conversationId}`).emit('new-reaction', message);
  }

  // Отправка сообщений в чат
  async sendChatTyping(conversationId: string, userId: string) {
    this.server.to(`conversation_${conversationId}`).emit('typing', userId);
  }

  // Редактирвоание сообщений в чат
  async editChatMessage(conversationId: string, message: any) {
    this.server.to(`conversation_${conversationId}`).emit('edit-message', message);
  }

  // Удаление сообщений в чат
  async deleteChatMessage(conversationId: string, message: any) {
    this.server.to(`conversation_${conversationId}`).emit('delete-message', message);
  }

  @SubscribeMessage('subscribe-chat')
  async handleSubscribeChat(socket: Socket, conversationId: string) {
    const userId = this.getUserIdFromSocket(socket);
    if (userId) {
      await this.handleChatConnection(userId, conversationId, socket);
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(socket: Socket, data: {
    chatId: string;
    recipientId: string;
    content?: string;
    attachments?: Array<{
      name: string;
      type: string;
      size: number;
      data: string; // base64
    }>;
  }) {
    const userId = this.getUserIdFromSocket(socket);
    if (!userId) throw new WsException('Unauthorized');

    try {
      // Преобразуем base64 обратно в файлы
      let attachments: Express.Multer.File[] = [];
      if (data.attachments?.length) {
        attachments = await Promise.all(
            data.attachments.map(async (attachment) => {
              const buffer = Buffer.from(attachment.data.split(',')[1], 'base64');
              return {
                originalname: attachment.name,
                mimetype: attachment.type,
                size: attachment.size,
                buffer,
                fieldname: 'attachments'
              } as Express.Multer.File;
            })
        );
      }

      const message = await this.messagesService.createMessage(
          userId,
          data.recipientId,
          data.content,
          attachments
      );

      await this.sendChatMessage(message.chatId, message);
      await this.notificationsGateway.sendMessageNotification(data.recipientId, message)
      return message;
    } catch (error) {
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('send-reaction')
  async handleSendReaction(socket: Socket, data: CreateReactionDto) {
    const userId = this.getUserIdFromSocket(socket);
    if (userId) {
      const message = await this.messagesService.createReactions(data.messageId, userId, data.reactions);
      await this.sendChatReaction(message.chatId, message)
      return message
    }
  }

  @SubscribeMessage('send-typing')
  async handleTyping(socket: Socket, payload: {chatId: string}) {
    const userId = this.getUserIdFromSocket(socket);
    if (userId) {
      await this.sendChatTyping(payload.chatId, userId)
    }
  }

  @SubscribeMessage('mark-as-read')
  async handleMarkAsReadMessages(socket: Socket, data: {messageIds: string[], chatId: string}) {
    const userId = this.getUserIdFromSocket(socket);
    if (userId) {
      await this.messagesService.markMessagesAsRead(data.chatId, userId, data.messageIds);
      await this.markAsReadMessages(data.chatId, data.messageIds)
      return data.messageIds
    }
  }

  @SubscribeMessage('edit-message')
  async handleEditMessage(socket: Socket, data: UpdateMessageDto) {
    const userId = this.getUserIdFromSocket(socket);
    if (userId) {
      const message = await this.messagesService.updateMessage(data.messageId, userId, data.content);
      await this.editChatMessage(message.chatId, message)
    }
  }

  @SubscribeMessage('delete-message')
  async handleDeleteMessage(socket: Socket, messageId: string) {
    const userId = this.getUserIdFromSocket(socket);
    if (userId) {
      const message = await this.messagesService.deleteMessage(messageId, userId);
      await this.deleteChatMessage(message.chatId, message)
    }
  }

  @SubscribeMessage('unsubscribe-chat')
  async handleUnsubscribeChat(socket: Socket, conversationId: string) {
    const userId = this.getUserIdFromSocket(socket);
    if (userId) {
      await this.removeChatConnection(userId, conversationId);
      socket.leave(`conversation_${conversationId}`);
    }
  }

  private getUserIdFromSocket(socket: Socket): string | null {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers?.token;
      console.log(token)
      const payload = this.jwtService.verify(token);
      return payload.id;
    } catch (e) {
      return null;
    }
  }
}