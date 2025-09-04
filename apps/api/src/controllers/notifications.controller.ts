import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common'
import { NotificationsService } from '../services/notifications.service'
import { NotificationsQueryDto } from '../types/dto'
import { RequestClaims } from '../types/claims'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'

@Controller('notifications')
@UseGuards(AbacGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @Abac({ resource: 'Notification', action: 'read' })
  async getNotifications(@Query(new ZodValidationPipe(NotificationsQueryDto)) query: NotificationsQueryDto, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.notificationsService.getNotifications(query, claims)
  }
}
