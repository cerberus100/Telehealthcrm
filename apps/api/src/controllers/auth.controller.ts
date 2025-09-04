import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common'
import { AuthService } from '../services/auth.service'
import { LoginDto, RefreshDto, LogoutDto } from '../types/dto'
import { RequestClaims } from '../types/claims'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body(new ZodValidationPipe(LoginDto)) loginDto: LoginDto) {
    return this.authService.login(loginDto)
  }

  @Post('refresh')
  async refresh(@Body(new ZodValidationPipe(RefreshDto)) refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto)
  }

  @Post('logout')
  @UseGuards(AbacGuard)
  @Abac({ resource: 'Auth', action: 'logout' })
  async logout(@Body(new ZodValidationPipe(LogoutDto)) logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto)
  }

  @Get('me')
  @UseGuards(AbacGuard)
  @Abac({ resource: 'User', action: 'read' })
  async getMe(@Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.authService.getMe(claims)
  }
}
