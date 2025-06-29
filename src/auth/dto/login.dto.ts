import { Injectable } from "@nestjs/common";
import { IsString, IsNotEmpty, IsEmail, MinLength, MaxLength } from "class-validator";

@Injectable()
export class LoginRequest {
    @IsString({message: 'Email должен быть строкой'})
    @IsNotEmpty({message: 'Email обязателен для заполнения'})
    @IsEmail({}, {message: 'Некорректный формат email'})
    email: string;

    @IsString({message: 'Пароль должен быть строкой'})
    @IsNotEmpty({message: 'Пароль обязателен для заполнения'})
    @MinLength(6, {message: 'Пароль должен быть не менее 6 символов'})
    @MaxLength(128, {message: 'Пароль не должен превышать 128 символов'})
    password: string;
}