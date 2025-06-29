import { Injectable } from "@nestjs/common";
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator"

@Injectable()
export class RegisterRequest {

    @IsString({message: 'Имя должно быть строкой'})
    @IsNotEmpty({message: 'Имя обязательно для заполнения'})
    @MaxLength(50, {message: 'Имя не должно превышать 50 символов'})
    firstName: string;

    @IsString({message: 'Фамилия должна быть строкой'})
    @IsNotEmpty({message: 'Фамилия обязательна для заполнения'})
    @MaxLength(75, {message: 'Фамилия не должна превышать 75 символов'})
    lastName: string;

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