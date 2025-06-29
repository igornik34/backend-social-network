import {User} from "@prisma/client";

type Author = Pick<User, 'id' | 'firstName' | 'lastName' | 'avatar'> & {online: boolean}

export class PostDto {
    id: string;
    content: string;
    images: string[];
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    author: Author
    likesCount: number
    commentsCount: number
    likedByUser: boolean
}