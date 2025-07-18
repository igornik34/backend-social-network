export class UserDto {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    bio?: string;
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
    online: boolean
}  