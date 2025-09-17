import { Controller, Post, Body, Get, UseGuards, Req, Inject, forwardRef } from '@nestjs/common'
import { AuthService } from '../services/auth.service'
import { LoginDto, RefreshDto, LogoutDto } from '../types/dto'
import { RequestClaims } from '../types/claims'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService
  ) {
    // AuthController initialized
  }

  @Post('login')
  async login(@Body(new ZodValidationPipe(LoginDto)) loginDto: LoginDto) {
    // Login attempt
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
  async getMe(@Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.authService.getMe(claims)
  }

  // Alias to support frontend calling /me directly
  @Get('/')
  async meAlias(@Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.authService.getMe(claims)
  }
}
