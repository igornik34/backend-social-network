// chat.dto.ts
import { Chat, User } from '@prisma/client';

export type ChatWithParticipants = Chat & {
    participants: User[];
};

export interface CreateChatDto {
    participantIds: string[];
}