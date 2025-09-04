import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ShipmentsService } from './shipments.service'
import { AuditService } from '../../audit/audit.service'
import { AbacGuard } from '../../abac/abac.guard'
import { Abac } from '../../abac/abac.decorator'
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe'
import {
  CreateShipmentDto,
  CreateShipmentDtoSchema,
  UpdateShipmentDto,
  UpdateShipmentDtoSchema,
  BulkCreateShipmentsDto,
  BulkCreateShipmentsDtoSchema,
  ShipmentsQueryDto,
  ShipmentsQueryDtoSchema,
  RefreshShipmentDto,
  RefreshShipmentDtoSchema,
} from './dto/shipments.dto'
import { RequestClaims } from '../../types/claims'
import { logger } from '../../utils/logger'

@Controller('shipments')
@UseGuards(AbacGuard)
export class ShipmentsController {
  constructor(
    private shipmentsService: ShipmentsService,
    private auditService: AuditService,
  ) {}

  /**
   * Create a new shipment
   * MARKETER_ADMIN only
   */
  @Post()
  @Abac('Shipment', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createShipment(
    @Body(new ZodValidationPipe(CreateShipmentDtoSchema)) createShipmentDto: CreateShipmentDto,
    @Headers('correlation-id') correlationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-org-id') orgId: string,
  ) {
    const correlationIdValue = correlationId || `shipment-create-${Date.now()}`
    
    logger.info({
      action: 'SHIPMENT_CREATE_REQUEST',
      user_id: userId,
      org_id: orgId,
      correlation_id: correlationIdValue,
    })

    return await this.shipmentsService.createShipment(
      createShipmentDto,
      userId,
      orgId,
      correlationIdValue,
    )
  }

  /**
   * Create multiple shipments in bulk
   * MARKETER_ADMIN only
   */
  @Post('bulk')
  @Abac('Shipment', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createBulkShipments(
    @Body(new ZodValidationPipe(BulkCreateShipmentsDtoSchema)) bulkCreateDto: BulkCreateShipmentsDto,
    @Headers('correlation-id') correlationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-org-id') orgId: string,
  ) {
    const correlationIdValue = correlationId || `bulk-shipments-create-${Date.now()}`
    
    logger.info({
      action: 'BULK_SHIPMENTS_CREATE_REQUEST',
      count: bulkCreateDto.shipments.length,
      user_id: userId,
      org_id: orgId,
      correlation_id: correlationIdValue,
    })

    return await this.shipmentsService.createBulkShipments(
      bulkCreateDto,
      userId,
      orgId,
      correlationIdValue,
    )
  }

  /**
   * Get shipments with filtering and pagination
   * MARKETER, MARKETER_ADMIN, SUPER_ADMIN
   */
  @Get()
  @Abac('Shipment', 'read')
  async getShipments(
    @Query(new ZodValidationPipe(ShipmentsQueryDtoSchema)) query: ShipmentsQueryDto,
    @Headers('correlation-id') correlationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-org-id') orgId: string,
  ) {
    const correlationIdValue = correlationId || `shipments-query-${Date.now()}`
    
    logger.info({
      action: 'SHIPMENTS_QUERY_REQUEST',
      filters: {
        status: query.status,
        carrier: query.carrier,
        date_from: query.date_from,
        date_to: query.date_to,
        search: query.search,
        assigned_to: query.assigned_to,
      },
      user_id: userId,
      org_id: orgId,
      correlation_id: correlationIdValue,
    })

    return await this.shipmentsService.getShipments(
      query,
      orgId,
      userId,
      correlationIdValue,
    )
  }

  /**
   * Get a single shipment by ID
   * MARKETER, MARKETER_ADMIN, SUPER_ADMIN
   */
  @Get(':id')
  @Abac('Shipment', 'read')
  async getShipmentById(
    @Param('id') id: string,
    @Headers('correlation-id') correlationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-org-id') orgId: string,
  ) {
    const correlationIdValue = correlationId || `shipment-get-${Date.now()}`
    
    logger.info({
      action: 'SHIPMENT_GET_REQUEST',
      shipment_id: id,
      user_id: userId,
      org_id: orgId,
      correlation_id: correlationIdValue,
    })

    return await this.shipmentsService.getShipmentById(
      id,
      orgId,
      userId,
      correlationIdValue,
    )
  }

  /**
   * Update a shipment
   * MARKETER_ADMIN only
   */
  @Put(':id')
  @Abac('Shipment', 'update')
  async updateShipment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateShipmentDtoSchema)) updateShipmentDto: UpdateShipmentDto,
    @Headers('correlation-id') correlationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-org-id') orgId: string,
  ) {
    const correlationIdValue = correlationId || `shipment-update-${Date.now()}`
    
    logger.info({
      action: 'SHIPMENT_UPDATE_REQUEST',
      shipment_id: id,
      user_id: userId,
      org_id: orgId,
      correlation_id: correlationIdValue,
    })

    return await this.shipmentsService.updateShipment(
      id,
      updateShipmentDto,
      userId,
      orgId,
      correlationIdValue,
    )
  }

  /**
   * Refresh shipment tracking data
   * MARKETER, MARKETER_ADMIN, SUPER_ADMIN
   */
  @Post(':id/refresh')
  @Abac('Shipment', 'update')
  @HttpCode(HttpStatus.OK)
  async refreshShipmentTracking(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RefreshShipmentDtoSchema)) refreshDto: RefreshShipmentDto,
    @Headers('correlation-id') correlationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-org-id') orgId: string,
  ) {
    const correlationIdValue = correlationId || `shipment-refresh-${Date.now()}`
    
    logger.info({
      action: 'SHIPMENT_REFRESH_REQUEST',
      shipment_id: id,
      force: refreshDto.force,
      user_id: userId,
      org_id: orgId,
      correlation_id: correlationIdValue,
    })

    return await this.shipmentsService.refreshShipmentTracking(
      id,
      refreshDto,
      userId,
      orgId,
      correlationIdValue,
    )
  }

  /**
   * Delete a shipment
   * MARKETER_ADMIN only
   */
  @Delete(':id')
  @Abac('Shipment', 'delete')
  @HttpCode(HttpStatus.OK)
  async deleteShipment(
    @Param('id') id: string,
    @Headers('correlation-id') correlationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-org-id') orgId: string,
  ) {
    const correlationIdValue = correlationId || `shipment-delete-${Date.now()}`
    
    logger.info({
      action: 'SHIPMENT_DELETE_REQUEST',
      shipment_id: id,
      user_id: userId,
      org_id: orgId,
      correlation_id: correlationIdValue,
    })

    return await this.shipmentsService.deleteShipment(
      id,
      userId,
      orgId,
      correlationIdValue,
    )
  }
}
