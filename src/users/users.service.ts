import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import {UploaderService} from "../uploader/uploader.service";
import {FollowersService} from "../followers/followers.service";
import {ChatService} from "../chat/chat.service";
import {NotificationsGateway} from "../notifications/notifications.gateway";

@Injectable()
export class UsersService {
  constructor(
      private prisma: PrismaService,
      private uploader: UploaderService,
      private followers: FollowersService,
      private chatService: ChatService,
      private notificationsService: NotificationsGateway
  ) {}

  async findById(id: string, currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastseen: true,
        lastName: true,
        bio: true,
        avatar: true,
        createdAt: true,
        updatedAt: true
      },
    });

    if(!user) {
        throw new NotFoundException('Пользователь не найден')
    }

    // Используем FollowersService для проверки подписок
    const { isFollowing, followsYou } = await this.followers.getFollowStatus(
        currentUserId,
        id
    );
    const { followersCount, followingCount } = await this.followers.getFollowCounts(id);

    const chat = await this.chatService.findChatByParticipants([id, currentUserId])

    return {
      ...user,
      isFollowing,
      followsYou,
      followersCount,
      followingCount,
      chatId: chat?.id,
      online: await this.notificationsService.isUserOnline(user.id)
    };
  }

  async updateUser(userId: string, dto: UpdateUserDto, file?: Express.Multer.File): Promise<UserDto> {
    const filePath = file ? this.uploader.uploadImage('avatars', file) : undefined

    return this.prisma.user.update({
      where: {id: userId},
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        bio: dto.bio,
        avatar: filePath
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastseen: true,
        lastName: true,
        bio: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        online: await this.notificationsService.isUserOnline(userId)
      },
    });
  }

  async searchUsers(userId: string, dto: SearchUsersDto) {
    const { query, limit, offset } = dto;

    const [users, totalCount] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: +limit,
        skip: +offset,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          bio: true,
          avatar: true,
          lastseen: true,
        },
      }),
      this.prisma.user.count({
        where: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        }
      }),
    ])

    const data = await Promise.all(users.map(async user => {
      const online = await this.notificationsService.isUserOnline(user.id)
      const chat = await this.chatService.findChatByParticipants([user.id, userId])
      return {...user, online, chatId: chat ? chat.id : null}
    }))

    return {
      data,
      total: totalCount,
      hasMore: offset + limit < totalCount,
    };
  }
}