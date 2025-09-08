import { Controller, Get, Post, Patch, Query, Body, Param, UseGuards, Req } from '@nestjs/common'
import { NotificationsService } from '../services/notifications.service'
import { NotificationsQueryDto } from '../types/dto'
import { RequestClaims } from '../types/claims'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { z } from 'zod'

// DTOs for new endpoints
const CreateNotificationDto = z.object({
  type: z.enum(['CONSULT_STATUS_CHANGE', 'SHIPMENT_UPDATE', 'RX_STATUS_CHANGE', 'SYSTEM_ALERT', 'USER_MANAGEMENT']),
  targetUserId: z.string().optional(),
  targetOrgId: z.string().optional(),
  payload: z.record(z.any()),
})

const MarkAsReadDto = z.object({
  notificationId: z.string().uuid(),
})

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

  @Get('stats')
  @Abac({ resource: 'Notification', action: 'read' })
  async getNotificationStats(@Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.notificationsService.getNotificationStats(claims)
  }

  @Post()
  @Abac({ resource: 'Notification', action: 'write' })
  async createNotification(@Body(new ZodValidationPipe(CreateNotificationDto)) body: z.infer<typeof CreateNotificationDto>, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.notificationsService.createNotification(body, claims)
  }

  @Patch(':id/read')
  @Abac({ resource: 'Notification', action: 'update' })
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.notificationsService.markNotificationAsRead(id, claims)
  }
}
