import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import { CallsService } from './calls.service';
import {JwtService} from "@nestjs/jwt";
import {RedisService} from "../redis/redis.service";
import {PrismaService} from "../prisma/prisma.service";
import {WebsocketGateway} from "../websocket/websocket.gateway";

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true
  },
  namespace: '/calls',
})
export class CallsGateway {
  @WebSocketServer()
  server: Server;

  private readonly ACTIVE_CALL_CONNECTIONS = 'active_call_connections';

  constructor(
      private readonly callsService: CallsService,
      private readonly jwtService: JwtService,
      private readonly redisService: RedisService,
      private readonly prismaService: PrismaService,
      private readonly websocketGateway: WebsocketGateway
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const userId = this.getUserIdFromSocket(socket);
      if (!userId) {
        throw new Error('Invalid token');
      }

      // Сохраняем соединение в Redis
      await this.redisService.setWithExpire(
          `${this.ACTIVE_CALL_CONNECTIONS}:${userId}`,
          socket.id,
          86400
      );

      console.log(`User ${userId} connected to call gateway`);
    } catch (e) {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = this.getUserIdFromSocket(socket);
    console.log("DISCONNECT")
    if (userId) {
      await this.redisService.del(`${this.ACTIVE_CALL_CONNECTIONS}:${userId}`);
    }
  }

  @SubscribeMessage('initiateCall')
  async handleInitiateCall(socket: Socket, payload: { calleeId: string, callerName: string, callerAvatar: string, callType: 'audio' | 'video' }) {
    const userId = this.getUserIdFromSocket(socket);
    const call = await this.callsService.initiateCall(userId, payload.calleeId, payload.callType);

    const socketId = await this.redisService.get(`${this.ACTIVE_CALL_CONNECTIONS}:${payload.calleeId}`);
    // Уведомляем вызываемого пользователя
    this.server.to(socketId).emit('incomingCall', {
      callId: call.id,
      userId,
      callerName: payload.callerName,
      callerAvatar: payload.callerAvatar,
      callType: payload.callType
    });

    return { callId: call.id };
  }

  @SubscribeMessage('answerCall')
  async handleAnswerCall(socket: Socket, payload: { callId: string }) {
    await this.callsService.answerCall(payload.callId);

    // Уведомляем вызывающего о принятии звонка
    const call = await this.callsService.getCall(payload.callId);
    const socketId = await this.redisService.get(`${this.ACTIVE_CALL_CONNECTIONS}:${call.callerId}`);
    console.log('CALL', call, socketId)
    this.server.to(socketId).emit('callAnswered', {
      callId: payload.callId,
    });
  }

  @SubscribeMessage('endCall')
  async handleEndCall(socket: Socket, payload: { callId: string }) {
    const userId = this.getUserIdFromSocket(socket);

    // Уведомляем другого участника о завершении
    const call = await this.callsService.getCall(payload.callId);
    const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
    const socketId = await this.redisService.get(`${this.ACTIVE_CALL_CONNECTIONS}:${otherUserId}`);
    const message = await this.callsService.endCall(call.id);
    this.server.to(socketId).emit('callEnded', {
      callId: payload.callId,
    });
    await this.websocketGateway.sendChatMessage(message.chatId, message);
  }

  @SubscribeMessage('callStatusUpdate')
  async handleStatusUpdate(
      socket: Socket,
      payload
  ) {
    const call = await this.callsService.getCall(payload.callId);
    if (!call) return;

    const userId = this.getUserIdFromSocket(socket);

    const otherUserId = call.callerId === userId
        ? call.calleeId
        : call.callerId;

    const socketId = await this.redisService.get(`${this.ACTIVE_CALL_CONNECTIONS}:${otherUserId}`);

    this.server.to(socketId).emit('callStatusUpdate', {
      callId: payload.callId,
      isMuted: payload.isMuted,
      isVideoOn: payload.isVideoOn,
      isScreenSharing: payload.isScreenSharing,
    });
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