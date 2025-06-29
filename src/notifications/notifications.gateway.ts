import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import {PrismaService} from "../prisma/prisma.service";
import {NotificationType} from "@prisma/client";
import {ConfigService} from "@nestjs/config";

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly ONLINE_USERS_KEY = 'online_users';
  private readonly USER_CONNECTIONS_KEY = 'user_connections';
  private readonly USER_CHAT_CONNECTIONS_KEY = 'user_chat_connections';

  constructor(
      private readonly notificationsService: NotificationsService,
      private readonly jwtService: JwtService,
      private readonly redisService: RedisService,
      private readonly prismaService: PrismaService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const userId = this.getUserIdFromSocket(socket);
      if (!userId) {
        throw new Error('Invalid token');
      }

      // Сохраняем соединение в Redis
      await this.redisService.setWithExpire(
          `${this.USER_CONNECTIONS_KEY}:${userId}`,
          socket.id,
          86400
      );

      await this.setUserOnline(userId)

      console.log(`User ${userId} connected to main gateway`);
    } catch (e) {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = this.getUserIdFromSocket(socket);
    console.log("DISCONNECT")
    if (userId) {
      await this.checkUserOffline(userId)
    }
  }

  private async setUserOnline(userId: string) {
    // Добавляем пользователя в множество онлайн пользователей
    await this.redisService.sAdd(this.ONLINE_USERS_KEY, userId);
    // Устанавливаем TTL 1 день на случай если соединение не закроется корректно
    await this.redisService.expire(this.ONLINE_USERS_KEY, 86400);
  }

  private async setUserOffline(userId: string) {
    // Удаляем пользователя из множества онлайн пользователей
    await this.redisService.sRem(this.ONLINE_USERS_KEY, userId);
    // Очищаем все соединения пользователя
    await this.redisService.del(`${this.USER_CONNECTIONS_KEY}:${userId}`);

    await this.prismaService.user.update({
      where: {
        id: userId
      },
      data: {
        lastseen: new Date()
      }
    })
  }

  private async checkUserOffline(userId: string) {
    const chatConnections = await this.redisService.hKeys(`${this.USER_CHAT_CONNECTIONS_KEY}:${userId}`);

    if (chatConnections.length === 0) {
      await this.setUserOffline(userId);
    }
  }


  private getUserIdFromSocket(socket: Socket): string | null {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.token;
      const payload = this.jwtService.verify(token);
      return payload.id;
    } catch (e) {
      return null;
    }
  }

  // Методы для работы с онлайн статусом
  async isUserOnline(userId: string): Promise<boolean> {
    return await this.redisService.sIsMember(this.ONLINE_USERS_KEY, userId);
  }

  async getOnlineUsers(): Promise<string[]> {
    return await this.redisService.sMembers(this.ONLINE_USERS_KEY);
  }

  // Основной метод отправки уведомлений
  private async sendNotification(senderId: string, recipientId: string, type: NotificationType, metadata: string) {
    try {
      // Сохраняем уведомление в БД
      const savedNotification = await this.notificationsService.createNotification(
          recipientId,
          senderId,
          type,
          metadata
      );

      // Отправляем уведомление через WebSocket
      const socketId = await this.redisService.get(`${this.USER_CONNECTIONS_KEY}:${recipientId}`);
      console.log("NEW NOTIFICATION SOCKET", socketId)
      if (socketId) {
        this.server.to(socketId).emit('notification', savedNotification);
      }

      return savedNotification;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Основной метод отправки уведомлений
  async sendMessageNotification(recipientId: string, message) {
    try {
      // Отправляем уведомление через WebSocket
      const socketId = await this.redisService.get(`${this.USER_CONNECTIONS_KEY}:${recipientId}`);
      if (socketId) {
        this.server.to(socketId).emit('notification', {
          type: 'message',
          metadata: message
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Специфичные методы для разных типов уведомлений
  async sendNewMessageNotification(recipientId: string, senderId: string, metadata: string) {
    return this.sendNotification(senderId, recipientId, NotificationType.NEW_MESSAGE, metadata);
  }

  async sendPostLikeNotification(recipientId: string, senderId: string, metadata: string) {
    return this.sendNotification(senderId, recipientId, NotificationType.POST_LIKE, metadata);
  }

  async sendPostCommentNotification(recipientId: string, senderId: string, metadata: string) {
    return this.sendNotification(senderId, recipientId, NotificationType.NEW_COMMENT, metadata);
  }

  async sendReplyCommentNotification(recipientId: string, senderId: string, metadata: string) {
    return this.sendNotification(senderId, recipientId, NotificationType.COMMENT_REPLY, metadata);
  }

  async sendNewFollowerNotification(recipientId: string, followerId: string, metadata: string) {
    return this.sendNotification(followerId, recipientId, NotificationType.NEW_FOLLOWER, metadata);
  }
}