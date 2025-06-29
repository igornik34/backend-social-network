import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID()
  postId: string;

  @IsUUID()
  @IsOptional()
  parentId?: string; // Для ответов на комментарии
}

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}