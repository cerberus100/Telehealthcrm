import { z } from 'zod'

// Auth DTOs
export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const RefreshDto = z.object({
  refresh_token: z.string(),
})

export const LogoutDto = z.object({
  refresh_token: z.string(),
})

// User and Organization DTOs
export const UserDto = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'DOCTOR', 'LAB_TECH', 'PHARMACIST', 'MARKETER', 'SUPPORT']),
  org_id: z.string(),
  last_login_at: z.string().datetime(),
})

export const OrganizationDto = z.object({
  id: z.string(),
  type: z.enum(['PROVIDER', 'LAB', 'PHARMACY', 'MARKETER']),
  name: z.string(),
})

export const MeResponseDto = z.object({
  user: UserDto,
  org: OrganizationDto,
})

// Consult DTOs
export const ConsultStatusDto = z.enum(['PENDING', 'PASSED', 'FAILED', 'APPROVED', 'DECLINED'])

export const ConsultSummaryDto = z.object({
  id: z.string(),
  status: ConsultStatusDto,
  created_at: z.string().datetime(),
  provider_org_id: z.string(),
})

export const ConsultDetailDto = z.object({
  id: z.string(),
  status: ConsultStatusDto,
  created_at: z.string().datetime(),
  provider_org_id: z.string(),
  patient: z.object({
    id: z.string(),
    legal_name: z.string(),
    dob: z.string().datetime(),
    address: z.record(z.any()).optional(),
  }),
  reason_codes: z.array(z.string()),
  created_from: z.enum(['CALL', 'WEB', 'API']),
})

export const UpdateConsultStatusDto = z.object({
  status: z.enum(['PASSED', 'FAILED', 'APPROVED']),
})

// Shipment DTOs
export const ShipmentDto = z.object({
  id: z.string(),
  lab_order_id: z.string(),
  carrier: z.string(),
  tracking_number: z.string(),
  status: z.string(),
  last_event_at: z.string().datetime().optional(),
  ship_to: z.object({
    name: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  }),
})

// Rx DTOs
export const RxStatusDto = z.enum(['DRAFT', 'SUBMITTED', 'DISPENSED', 'CANCELLED'])

export const RxSummaryDto = z.object({
  id: z.string(),
  status: RxStatusDto,
  created_at: z.string().datetime(),
  consult_id: z.string(),
  pharmacy_org_id: z.string(),
})

export const RxDetailDto = z.object({
  id: z.string(),
  status: RxStatusDto,
  created_at: z.string().datetime(),
  consult_id: z.string(),
  pharmacy_org_id: z.string(),
  provider_user_id: z.string(),
  refills_allowed: z.number(),
  refills_used: z.number(),
})

// Notification DTOs
export const NotificationDto = z.object({
  id: z.string(),
  type: z.string(),
  created_at: z.string().datetime(),
  payload: z.record(z.any()),
})

// Pagination DTOs
export const PaginationQueryDto = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
})

export const PaginatedResponseDto = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    items: z.array(schema),
    next_cursor: z.string().nullable(),
  })

// Error DTOs
export const ErrorDto = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().nullable(),
  }),
})

// Query DTOs
export const ConsultsQueryDto = PaginationQueryDto.extend({
  status: z.enum(['PASSED', 'FAILED', 'APPROVED']).optional(),
})

export const ShipmentsQueryDto = PaginationQueryDto.extend({
  consult_id: z.string().optional(),
  lab_order_id: z.string().optional(),
})

export const RxQueryDto = PaginationQueryDto.extend({
  status: z.enum(['SUBMITTED', 'DISPENSED']).optional(),
})

export const NotificationsQueryDto = PaginationQueryDto

// Type exports
export type LoginDto = z.infer<typeof LoginDto>
export type RefreshDto = z.infer<typeof RefreshDto>
export type LogoutDto = z.infer<typeof LogoutDto>
export type UserDto = z.infer<typeof UserDto>
export type OrganizationDto = z.infer<typeof OrganizationDto>
export type MeResponseDto = z.infer<typeof MeResponseDto>
export type ConsultSummaryDto = z.infer<typeof ConsultSummaryDto>
export type ConsultDetailDto = z.infer<typeof ConsultDetailDto>
export type UpdateConsultStatusDto = z.infer<typeof UpdateConsultStatusDto>
export type ShipmentDto = z.infer<typeof ShipmentDto>
export type RxSummaryDto = z.infer<typeof RxSummaryDto>
export type RxDetailDto = z.infer<typeof RxDetailDto>
export type NotificationDto = z.infer<typeof NotificationDto>
export type ConsultsQueryDto = z.infer<typeof ConsultsQueryDto>
export type ShipmentsQueryDto = z.infer<typeof ShipmentsQueryDto>
export type RxQueryDto = z.infer<typeof RxQueryDto>
export type NotificationsQueryDto = z.infer<typeof NotificationsQueryDto>
export type ErrorDto = z.infer<typeof ErrorDto>
