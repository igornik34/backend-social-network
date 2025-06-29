import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { RegisterRequest } from "./dto/register.dto";
import { hash, verify } from "argon2";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "src/prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { JwtPayload } from "./interfaces/jwt.interface";
import { LoginRequest } from "./dto/login.dto";
import { Request, Response } from "express";
import { isDev } from "src/utils/is-dev.util";

@Injectable()
export class AuthService {
  private readonly JWT_ACCESS_TOKEN_TTL: string
  private readonly JWT_REFRESH_TOKEN_TTL: string
  private readonly COOKIE_DOMAIN: string

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
) {
    this.JWT_ACCESS_TOKEN_TTL = configService.getOrThrow('JWT_ACCESS_TOKEN_TTL')
    this.JWT_REFRESH_TOKEN_TTL = configService.getOrThrow('JWT_REFRESH_TOKEN_TTL')
    this.COOKIE_DOMAIN = configService.getOrThrow('COOKIE_DOMAIN')
}

  async register(res: Response, dto: RegisterRequest) {
    const { firstName, lastName, email, password } = dto;

    const existUser = await this.prismaService.user.findUnique({
        where: {
            email
        }
    })

    if(existUser) {
        throw new ConflictException('Пользователь с такой почтой уже существует')
    }

    const {password: passwordUser, ...user} = await this.prismaService.user.create({
        data: {
            firstName,
            lastName,
            email,
            password: await hash(password)
        }
    })

      const {accessToken, refreshToken} = this.auth(res, user.id)

      return {
          ...user,
          accessToken,
          refreshToken
      }
  }

  async login(res: Response, dto: LoginRequest) {
    const {email, password} = dto

    const {password: passwordUser, ...user} = await this.prismaService.user.findUnique({
        where: {
            email
        }
    })

    if(!user) {
        throw new NotFoundException('Пользователь не найден')
    }

    const isValidPassword = await verify(passwordUser, password)

    if(!isValidPassword) {
        throw new NotFoundException('Пользователь не найден')
    }

    const {accessToken, refreshToken} = this.auth(res, user.id)

    return {
        ...user,
        accessToken,
        refreshToken
    }
  }

  async refresh(req: Request, res: Response) {
      console.log("COOOKIEEE", req.cookies)
    const refreshToken = req.cookies['refreshToken']

    if(!refreshToken) {
        throw new UnauthorizedException('Недействительный refresh-токен')
    }
    
    const payload: JwtPayload = await this.jwtService.verifyAsync(refreshToken)

    if(payload) {
        const user = await this.prismaService.user.findUnique({
            where: {
                id: payload.id
            },
            select: {
                id: true
            }
        })

        if(!user) {
            throw new NotFoundException('Пользователь не найден')
        }

        return this.auth(res, user.id)
    }
  }

  async logout(res: Response) {
    this.setCookie(res, 'refreshToken', new Date(0))
    return true
  }

  async validate(id: string) {
    const user = await this.prismaService.user.findUnique({
        where: {
            id
        }
    })

    if(!user) {
        throw new NotFoundException('Пользователь не найден')
    }

    return user
  }

  private auth(res: Response, id: string) {
    const {accessToken, refreshToken} = this.generateTokens(id)

    this.setCookie(res, refreshToken, new Date(Date.now() + 60*60*60*24*7))

    return {accessToken, refreshToken}
  }

  private generateTokens(id: string) {
    const payload: JwtPayload = { id }

    const accessToken = this.jwtService.sign(payload, {
        expiresIn: this.JWT_ACCESS_TOKEN_TTL
    })

    const refreshToken = this.jwtService.sign(payload, {
        expiresIn: this.JWT_REFRESH_TOKEN_TTL
    })

    return {
        accessToken,
        refreshToken
    }
  }

  private setCookie(res: Response, value: string, expires: Date) {
    res.cookie('refreshToken', value, {
        httpOnly: true,
        domain: this.COOKIE_DOMAIN,
        expires,
        sameSite: 'lax',
        secure: !isDev(this.configService)
    })
  }
}
