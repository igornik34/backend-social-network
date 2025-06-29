export class CreateMessageDto {
    recipientId: string
    content: string
    attachments: Express.Multer.File[]
}