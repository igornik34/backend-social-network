import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';
import {MessagesService} from "../messages/messages.service";

@Injectable()
export class CallsService {

    // Ключи для Redis
    private readonly ACTIVE_CALLS_KEY = 'active_peer_calls';

    constructor(
        private redisService: RedisService,
        private messageService: MessagesService
    ) {}

    async initiateCall(callerId: string, calleeId: string, type: 'audio' | 'video') {
        const callId = uuidv4();
        const call = {
            id: callId,
            callerId,
            calleeId,
            status: 'initiating',
            startTime: new Date(),
            type
        }
        //
        // await this.callsRepository.save(call);

        // Сохраняем звонок в Redis
        await this.redisService.hSet(
            this.ACTIVE_CALLS_KEY,
            callId,
            JSON.stringify(call)
        );

        return call;
    }

    async answerCall(callId: string): Promise<void> {
        const callStr = await this.redisService.hGet(this.ACTIVE_CALLS_KEY, callId);
        if (!callStr) {
            throw new Error('Call not found');
        }

        const call = JSON.parse(callStr);

        call.status = 'active';
        // await this.callsRepository.save(call);

        // Обновляем статус в Redis
        await this.redisService.hSet(
            this.ACTIVE_CALLS_KEY,
            callId,
            JSON.stringify(call)
        );
    }

    async endCall(callId: string) {
        const callStr = await this.redisService.hGet(this.ACTIVE_CALLS_KEY, callId);
        if (!callStr) {
            throw new Error('Call not found');
        }

        const call = JSON.parse(callStr);
        call.status = 'ended';
        call.endTime = new Date().toISOString();
        const message = await this.messageService.createMessage(call.callerId, call.calleeId, `CALL ${call.startTime} ${call.endTime} ${call.type}`)

        // Удаляем из Redis
        await this.redisService.hDel(this.ACTIVE_CALLS_KEY, callId);

        return message
    }

    private handleIncomingStream(mediaConnection: any, remoteStream: MediaStream) {
        console.log(`Received stream from ${mediaConnection.peer}`);
        // Логика обработки входящего потока
    }

    async getCall(callId: string): Promise<any> {
        const callStr = await this.redisService.hGet(this.ACTIVE_CALLS_KEY, callId);
        if (!callStr) {
            throw new Error('Call not found');
        }
        return JSON.parse(callStr);
    }

    async getActiveCalls() {
        const calls = await this.redisService.hGetAll(this.ACTIVE_CALLS_KEY);
        return Object.values(calls).map(callStr => JSON.parse(callStr));
    }
}