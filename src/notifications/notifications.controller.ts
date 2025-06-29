import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Authorization } from 'src/auth/decorators/authorization.decorator';
import { Authorized } from 'src/auth/decorators/authorized.decorator';
import {NotificationsService} from "./notifications.service";
import {CreatePostDto} from "../posts/dto/create-post.dto";

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    @Authorization()
    async getNotifications(
        @Authorized('id') userId: string,
        @Query('limit') limit: number = 10,
        @Query('offset') offset: number = 0,
    ) {
        return this.notificationsService.getNotifications(userId, limit, offset);
    }

    @Post()
    @Authorization()
    async markAsView(
        @Authorized('id') userId: string,
        @Body() {ids}: { ids: string[] },
    ) {
        return this.notificationsService.markAsView(ids);
    }

    @Get('/count')
    @Authorization()
    async getCountUnreadNotifications(
        @Authorized('id') userId: string,
    ) {
        return this.notificationsService.getUnreadCount(userId);
    }
}
