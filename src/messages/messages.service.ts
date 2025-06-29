import {Injectable, NotFoundException, ForbiddenException, Inject, forwardRef} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import {UploaderService} from "../uploader/uploader.service";
import {NotificationsGateway} from "../notifications/notifications.gateway";

@Injectable()
export class MessagesService {
    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => ChatService))
        private chatService: ChatService,
        private uploaderService: UploaderService,
        private notificationGateway: NotificationsGateway
    ) {}

    // Получение последнего сообщения в чате
    async getLastMessageForChat(chatId: string) {
        return this.prisma.message.findFirst({
            where: { chatId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getCountUnreadMessageByChat(chatId: string, userId: string) {
        return this.prisma.message.count({
            where: { chatId, read: false, senderId: {not: userId} },
        });
    }

    // Получение сообщений с пагинацией
    async getMessages(
        chatId: string,
        userId: string,
        limit: number = 20,
        offset: number = 0,
    ) {
        // Проверяем, что пользователь является участником чата
        const isParticipant = await this.chatService.verifyChatParticipant(chatId, userId);
        if (!isParticipant) {
            throw new ForbiddenException('You are not a participant of this chat');
        }

        const [messages, count] = await this.prisma.$transaction([
            this.prisma.message.findMany({
                where: { chatId },
                orderBy: { createdAt: 'desc' },
                take: +limit,
                skip: +offset,
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastseen: true,
                            lastName: true,
                            avatar: true,
                        },
                    },
                },
            }),
            this.prisma.message.count({
                where: { chatId }
            }),
        ])

        return {
            data: messages,
            total: count,
            hasMore: +offset + +limit < count,
        }
    }

    // Отправка сообщения
    async createMessage(
        senderId: string,
        recipientId: string,
        content: string,
        attachments: Express.Multer.File[] = []
    ) {
        // Проверяем существование получателя
        const recipientExists = await this.prisma.user.findUnique({
            where: { id: recipientId },
        });
        if (!recipientExists) {
            throw new NotFoundException('Recipient not found');
        }

        // Ищем существующий чат между пользователями
        let chat = await this.chatService.findChatByParticipants([senderId, recipientId]);

        // Если чата нет - создаем новый
        if (!chat) {
            chat = await this.chatService.createChat({
                participantIds: [senderId, recipientId],
            });
            await this.notificationGateway.sendNewMessageNotification(recipientId, senderId, content)
        }

        const pathsImages = await this.uploaderService.uploadImages(`chats_${chat.id}`, attachments)

        console.log(pathsImages)

        // Создаем сообщение
        const message = await this.prisma.message.create({
            data: {
                content,
                senderId,
                recipientId,
                chatId: chat.id,
                attachments: pathsImages
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        firstName: true,
                        lastseen: true,
                        lastName: true,
                        avatar: true,
                    },
                },
            },
        });

        console.log(message)

        // Обновляем время последнего сообщения в чате
        await this.chatService.updateChatTimestamp(chat.id);

        return {
            ...message,
            chat, // Возвращаем информацию о чате (может быть полезно клиенту)
        };
    }

    // Редактирование сообщения
    async updateMessage(
        messageId: string,
        userId: string,
        content: string,
    ) {
        // Находим сообщение
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            throw new NotFoundException('Message not found');
        }

        // Проверяем, что пользователь является автором сообщения
        if (message.senderId !== userId) {
            throw new ForbiddenException('You can only edit your own messages');
        }

        // Обновляем сообщение
        return this.prisma.message.update({
            where: { id: messageId },
            data: {
                content,
                // editable: true
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        firstName: true,
                        lastseen: true,
                        lastName: true,
                        avatar: true,
                    },
                },
            },
        });
    }

    // Редактирование сообщения
    async createReactions(
        messageId: string,
        userId: string,
        reactions: string[],
    ) {
        // Находим сообщение
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            throw new NotFoundException('Message not found');
        }

        // Обновляем сообщение
        return this.prisma.message.update({
            where: { id: messageId },
            data: { reactions },
            include: {
                sender: {
                    select: {
                        id: true,
                        firstName: true,
                        lastseen: true,
                        lastName: true,
                        avatar: true,
                    },
                },
            },
        });
    }

    // Удаление сообщения
    async deleteMessage(
        messageId: string,
        userId: string,
    ) {
        // Находим сообщение
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            throw new NotFoundException('Message not found');
        }

        // Проверяем, что пользователь является автором сообщения
        if (message.senderId !== userId) {
            throw new ForbiddenException('You can only delete your own messages');
        }

        // Удаляем сообщение
        await this.prisma.message.delete({
            where: { id: messageId },
        });

        return message;
    }

    // Пометить сообщения как прочитанные
    async markMessagesAsRead(
        chatId: string,
        userId: string,
        messageIds: string[]
    ) {
        // Проверяем, что пользователь является участником чата
        const isParticipant = await this.chatService.verifyChatParticipant(chatId, userId);
        if (!isParticipant) {
            throw new ForbiddenException('You are not a participant of this chat');
        }

        await this.prisma.message.updateMany({
            where: {
                id: {in: messageIds},
                chatId,
                recipientId: userId,
                read: false,
            },
            data: {
                read: true,
            },
        });

        return { success: true };
    }
}