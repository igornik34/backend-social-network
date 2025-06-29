import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationParams, FollowersResponse, SuggestedUserDto } from './dto/followers.dto';
import {NotificationsGateway} from "../notifications/notifications.gateway";

@Injectable()
export class FollowersService {
  constructor(private prisma: PrismaService, private notificationsGateway: NotificationsGateway) {}

  async getFollowStatus(
      currentUserId: string,
      targetUserId: string
  ): Promise<{ isFollowing: boolean; followsYou: boolean }> {
    if (currentUserId === targetUserId) {
      return { isFollowing: false, followsYou: false };
    }

    const [isFollowing, followsYou] = await this.prisma.$transaction([
      this.prisma.follow.findFirst({
        where: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
        select: { id: true },
      }),
      this.prisma.follow.findFirst({
        where: {
          followerId: targetUserId,
          followingId: currentUserId,
        },
        select: { id: true },
      }),
    ]);

    return {
      isFollowing: !!isFollowing,
      followsYou: !!followsYou,
    };
  }

  async getFollowCounts(userId: string,): Promise<{ followersCount: number; followingCount: number }> {
    const [followersCount, followingCount] = await this.prisma.$transaction([
      this.prisma.follow.count({
        where: {
          followingId: userId,
        },
      }),
      this.prisma.follow.count({
        where: {
          followerId: userId,
        },
      }),
    ]);

    return {
      followersCount,
      followingCount,
    };
  }

  async getFollowers(userId: string, params: PaginationParams & { query: string }): Promise<FollowersResponse> {

    const [followers, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where: {
          followingId: userId,
          OR: [
            { follower: { firstName: { contains: params.query, mode: 'insensitive' } } },
            { follower: { lastName: { contains: params.query, mode: 'insensitive' } } },
          ],
        },
        include: {
          follower: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              lastseen: true,
              avatar: true,
            },
          },
        },
        skip: +params.offset,
        take: +params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({
        where: {
          followingId: userId,
          OR: [
            { follower: { firstName: { contains: params.query, mode: 'insensitive' } } },
            { follower: { lastName: { contains: params.query, mode: 'insensitive' } } },
          ],
        },
      }),
    ]);

    // Проверяем взаимные подписки
    const followerIds = followers.map(f => f.followerId);
    const followingBack = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        followingId: { in: followerIds },
      },
    });

    const followingBackSet = new Set(followingBack.map(f => f.followingId));

    const data = await Promise.all(
        followers.map(async (follower) => {
          const online = await this.notificationsGateway.isUserOnline(follower.follower.id);
          const isFollowing = followingBackSet.has(follower.follower.id);
          return { ...follower.follower, online, isFollowing };
        }),
    );

    return {
      data,
      total,
      hasMore: params.offset + params.limit < total,
    };
  }

  async getFollowing(userId: string, params: PaginationParams & { query: string }): Promise<FollowersResponse> {

    const [following, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where: {
          followerId: userId,
          OR: [
            { following: { firstName: { contains: params.query, mode: 'insensitive' } } },
            { following: { lastName: { contains: params.query, mode: 'insensitive' } } },
          ]
        },
        include: {
          following: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              lastseen: true,
              avatar: true,
              email: true,
            },
          },
        },
        skip: +params.offset,
        take: +params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.follow.count({
        where: {
          followerId: userId,
          OR: [
            { following: { firstName: { contains: params.query, mode: 'insensitive' } } },
            { following: { lastName: { contains: params.query, mode: 'insensitive' } } },
          ]
        },
      }),
    ]);

    // Проверяем взаимные подписки
    const followingIds = following.map(f => f.followingId);
    const followersBack = await this.prisma.follow.findMany({
      where: {
        followerId: { in: followingIds },
        followingId: userId,
      },
    });

    const followersBackSet = new Set(followersBack.map(f => f.followerId));

    const data = await Promise.all(
        following.map(async (following) => {
          const online = await this.notificationsGateway.isUserOnline(following.following.id);
          const followsYou = followersBackSet.has(following.following.id);
          return { ...following.following, online, followsYou };
        }),
    );

    return {
      data,
      total,
      hasMore: params.offset + params.limit < total,
    };
  }

  async followUser(currentUserId: string, userId: string): Promise<boolean> {
    // Нельзя подписаться на самого себя
    if (currentUserId === userId) {
      throw new Error('Нельзя подписаться на самого себя');
    }

    // Проверяем существует ли пользователь
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Проверяем не подписаны ли уже
    const existingFollow = await this.prisma.follow.findFirst({
      where: {
        followerId: currentUserId,
        followingId: userId,
      },
    });

    if (existingFollow) {
      return false;
    }

    // Создаем подписку
    await this.prisma.follow.create({
      data: {
        followerId: currentUserId,
        followingId: userId,
      },
    });

    await this.notificationsGateway.sendNewFollowerNotification(userId, currentUserId, '')

    return true;
  }

  async unfollowUser(currentUserId: string, userId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findFirst({
      where: {
        followerId: currentUserId,
        followingId: userId,
      },
    });

    if (!follow) {
      return false;
    }

    await this.prisma.follow.delete({
      where: { id: follow.id },
    });

    return true;
  }

  async getSuggestedUsers(
    userId: string,
    params: PaginationParams
  ): Promise<FollowersResponse> {
    // 1. Получаем подписчиков текущего пользователя
    const userFollowers = await this.prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    });
  
    if (userFollowers.length === 0) {
      // Если нет подписчиков, возвращаем популярных пользователей
      return this.getPopularUsers(userId, params);
    }
  
    const followerIds = userFollowers.map(f => f.followerId);
  
    // 2. Находим пользователей, на которых подписаны наши подписчики (но не мы)
    const [suggestedUsers, total]: [SuggestedUserDto[], number] = await this.prisma.$transaction([
      this.prisma.$queryRaw`
        SELECT 
          u.id, 
          u."firstName", 
          u."lastName", 
          u.avatar, 
          u.email,
          COUNT(f.id) as "mutualFollowersCount"
        FROM "User" u
        JOIN "Follow" f ON f."followingId" = u.id
        WHERE 
          f."followerId" IN (${followerIds.join(', ')})
          AND u.id != ${userId}
          AND u.id NOT IN (
            SELECT "followingId" 
            FROM "Follow" 
            WHERE "followerId" = ${userId}
          )
        GROUP BY u.id
        ORDER BY "mutualFollowersCount" DESC
        LIMIT ${+params.limit}
        OFFSET ${+params.offset}
      `,
      this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT u.id)
        FROM "User" u
        JOIN "Follow" f ON f."followingId" = u.id
        WHERE 
          f."followerId" IN (${followerIds.join(', ')})
          AND u.id != ${userId}
          AND u.id NOT IN (
            SELECT "followingId" 
            FROM "Follow" 
            WHERE "followerId" = ${userId}
          )
      `,
    ]);
  
    // 3. Форматируем результат
    return {
      data: suggestedUsers.map(user => ({
        ...user,
        isFollowing: false,
        followsYou: false,
        mutualFollowersCount: Number(user.mutualFollowersCount),
      })),
      total: Number(total) || 0,
      hasMore: params.offset + params.limit < Number(total),
    };
  }
  
  private async getPopularUsers(
    userId: string,
    params: PaginationParams
  ): Promise<FollowersResponse> {
    const [popularUsers, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: {
          id: { not: userId },
          NOT: {
            followers: {
              some: { followerId: userId },
            },
          },
        },
        orderBy: {
          followers: {
            _count: 'desc',
          },
        },
        take: +params.limit,
        skip: +params.offset,
        select: {
          id: true,
          firstName: true,
          lastseen: true,
          lastName: true,
          avatar: true,
          email: true,
          _count: {
            select: { followers: true },
          },
        },
      }),
      this.prisma.user.count({
        where: {
          id: { not: userId },
          NOT: {
            followers: {
              some: { followerId: userId },
            },
          },
        },
      }),
    ]);
  
    return {
      data: popularUsers.map(user => ({
        ...user,
        isFollowing: false,
        followsYou: false,
        mutualFollowersCount: user._count.followers,
      })),
      total,
      hasMore: params.offset + params.limit < total,
    };
  }
}