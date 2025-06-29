import {forwardRef, Inject, Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {ChatWithParticipants, CreateChatDto,} from './dto/chat.dto';
import {MessagesService} from "../messages/messages.service";
import {NotificationsGateway} from "../notifications/notifications.gateway";

@Injectable()
export class ChatService {
    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => MessagesService))
        private messageService: MessagesService,
        private notificationsGateway: NotificationsGateway
    ) {}

    // Create a new chat between users
    async createChat(createChatDto: CreateChatDto): Promise<ChatWithParticipants> {
        const { participantIds } = createChatDto;

        // Check if all participants exist
        const users = await this.prisma.user.findMany({
            where: {
                id: { in: participantIds },
            },
        });

        if (users.length !== participantIds.length) {
            throw new NotFoundException('One or more participants not found');
        }

        // Check if a chat already exists with these exact participants
        const existingChat = await this.findChatByParticipants(participantIds);
        if (existingChat) {
            return existingChat;
        }

        return this.prisma.chat.create({
            data: {
                participants: {
                    connect: participantIds.map((id) => ({ id })),
                },
            },
            include: {
                participants: true,
            },
        });
    }

    // Find chat by participant IDs
    async findChatByParticipants(participantIds: string[]): Promise<ChatWithParticipants | null> {
        const chats = await this.prisma.chat.findMany({
            where: {
                participants: {
                    every: {
                        id: { in: participantIds },
                    },
                },
            },
            include: {
                participants: true,
            },
        });

        // Filter for chats with exact participant match
        return chats.find(
            (chat) =>
                chat.participants.length === participantIds.length &&
                chat.participants.every((p) => participantIds.includes(p.id)),
        ) || null;
    }

    // Get all chats for a user with last message preview
    async getUserChats(userId: string, limit: number, offset: number, query?: string) {
        const searchQuery = query?.trim();

        // Базовые условия для чатов пользователя
        const baseWhere = {
            participants: {
                some: {
                    id: userId,
                },
            },
        };

        const [chats, count] = await this.prisma.$transaction([
            this.prisma.chat.findMany({
                where: {
                    ...baseWhere,
                    OR: [
                        // Поиск по имени участников чата (кроме текущего пользователя)
                        {
                            participants: {
                                some: {
                                    id: { not: userId }, // Исключаем текущего пользователя
                                    OR: [
                                        { firstName: { contains: searchQuery, mode: 'insensitive' } },
                                        { lastName: { contains: searchQuery, mode: 'insensitive' } },
                                    ],
                                },
                            },
                        },
                        // Поиск по сообщениям в чате
                        {
                            messages: {
                                some: {
                                    content: { contains: searchQuery, mode: 'insensitive' },
                                },
                            },
                        },
                    ]
                },
                take: +limit,
                skip: +offset,
                include: {
                    participants: {
                        where: {
                            id: { not: userId }, // Исключаем текущего пользователя
                        },
                        select: {
                            id: true,
                            firstName: true,
                            lastseen: true,
                            lastName: true,
                            avatar: true,
                        },
                    },
                },
                orderBy: {
                    updatedAt: 'desc',
                },
            }),
            this.prisma.chat.count({
                where: {
                    ...baseWhere,
                    OR: [
                        // Поиск по имени участников чата (кроме текущего пользователя)
                        {
                            participants: {
                                some: {
                                    id: { not: userId }, // Исключаем текущего пользователя
                                    OR: [
                                        { firstName: { contains: searchQuery, mode: 'insensitive' } },
                                        { lastName: { contains: searchQuery, mode: 'insensitive' } },
                                    ],
                                },
                            },
                        },
                        // Поиск по сообщениям в чате
                        {
                            messages: {
                                some: {
                                    content: { contains: searchQuery, mode: 'insensitive' },
                                },
                            },
                        },
                    ]
                },
            }),
        ]);

        const chatsWithLastMessage = await Promise.all(
            chats.map(async (chat) => {
                const lastMessage = await this.messageService.getLastMessageForChat(chat.id);
                const participants = await Promise.all(
                    chat.participants.map(async (p) => {
                        const online = await this.notificationsGateway.isUserOnline(p.id);
                        return { ...p, online };
                    }),
                );
                const unreadCount = await this.messageService.getCountUnreadMessageByChat(chat.id, userId)
                return { ...chat, lastMessage, participants, unreadCount };
            }),
        );

        return {
            data: chatsWithLastMessage,
            total: count,
            hasMore: offset + limit < count,
        };
    }

    // Get a specific chat by ID
    async getChatById(chatId: string, userId: string) {
        const chat = await this.prisma.chat.findUnique({
            where: {
                id: chatId,
                participants: {
                    some: {
                        id: userId,
                    },
                },
            },
            include: {
                participants: {
                    select: {
                        id: true,
                        firstName: true,
                        lastseen: true,
                        lastName: true,
                        avatar: true,
                    }
                },
            },
        });

        if (!chat) {
            throw new NotFoundException('Chat not found or access denied');
        }

        const participants = await Promise.all(
            chat.participants.map(async (p) => {
                const online = await this.notificationsGateway.isUserOnline(p.id);
                return { ...p, online };
            }),
        );

        return {...chat, participants};
    }

    // Verify user is a participant of the chat
    async verifyChatParticipant(chatId: string, userId: string): Promise<boolean> {
        const chat = await this.prisma.chat.findFirst({
            where: {
                id: chatId,
                participants: {
                    some: {
                        id: userId,
                    },
                },
            },
        });

        return !!chat;
    }

    // Update chat's updatedAt timestamp
    async updateChatTimestamp(chatId: string): Promise<void> {
        await this.prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
        });
    }

    // Get chat participants
    async getCountUnreadChats(userId: string): Promise<string[]> {
        const chats = await this.prisma.chat.findMany({
            where: {
                participants: {
                    some: {
                        id: userId,
                    },
                },
            }
        })

        const res = []

        await Promise.all(
            chats.map(async (chat) => {
                const lastMessage = await this.messageService.getLastMessageForChat(chat.id);
                if (!lastMessage.read && lastMessage.senderId !== userId) {
                    return res.push(lastMessage.chatId)
                }
            }),
        )

        return res
    }
}