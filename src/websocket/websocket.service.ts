import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebsocketService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createNewConversation(user1Id: string, user2Id: string) {
    const conversation = await this.prisma.chat.create({
      data: {
        participants: {
          connect: [{ id: user1Id }, { id: user2Id }],
        },
      },
      include: {
        participants: true,
      },
    });

    this.eventEmitter.emit('conversation.created', conversation);
    return conversation;
  }

  async notifyNewMessage(conversationId: string, message: any) {
    this.eventEmitter.emit('message.created', { conversationId, message });
  }
}