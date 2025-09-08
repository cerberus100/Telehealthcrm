import { Controller, Get, UseGuards, Req } from '@nestjs/common'
import { Abac, AbacGuard } from '../abac/abac.guard'
import { AuthService } from '../services/auth.service'
import { RequestClaims } from '../types/claims'

@Controller()
export class MeController {
  constructor(private authService: AuthService) {}

  @Get('me')
  @UseGuards(AbacGuard)
  @Abac({ resource: 'User', action: 'read' })
  async me(@Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.authService.getMe(claims)
  }
}


