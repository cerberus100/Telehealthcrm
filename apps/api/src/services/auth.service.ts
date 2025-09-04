import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { LoginDto, RefreshDto, LogoutDto, MeResponseDto } from '../types/dto'
import { RequestClaims } from '../types/claims'

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(loginDto: LoginDto) {
    // TODO: Replace with Cognito authentication
    // For now, simulate authentication
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { org: true },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Generate mock tokens (replace with Cognito)
    const access_token = `mock_access_${user.id}_${Date.now()}`
    const refresh_token = `mock_refresh_${user.id}_${Date.now()}`

    return {
      access_token,
      refresh_token,
    }
  }

  async refresh(refreshDto: RefreshDto) {
    // TODO: Replace with Cognito token refresh
    // For now, simulate token refresh
    const tokenParts = refreshDto.refresh_token.split('_')
    if (tokenParts.length < 3 || tokenParts[0] !== 'mock_refresh') {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const userId = tokenParts[1]
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { org: true },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const access_token = `mock_access_${user.id}_${Date.now()}`
    const refresh_token = `mock_refresh_${user.id}_${Date.now()}`

    return {
      access_token,
      refresh_token,
    }
  }

  async logout(logoutDto: LogoutDto) {
    // TODO: Implement token blacklisting or Cognito logout
    return { success: true }
  }

  async getMe(claims: RequestClaims): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: { org: true },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        org_id: user.orgId,
        last_login_at: user.lastLoginAt?.toISOString() || new Date().toISOString(),
      },
      org: {
        id: user.org.id,
        type: user.org.type,
        name: user.org.name,
      },
    }
  }
}
