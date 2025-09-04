import { z } from 'zod'

// Carrier enum validation
export const CarrierSchema = z.enum(['UPS', 'FEDEX', 'USPS', 'OTHER'])

// Shipment status enum validation
export const ShipmentStatusSchema = z.enum(['CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'])

// Ship-to address schema (non-PHI fields only)
export const ShipToSchema = z.object({
  name: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
  address1: z.string().min(1).max(255),
  address2: z.string().max(255).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
  zip: z.string().min(5).max(10),
  country: z.string().default('US'),
})

// Create shipment DTO
export const CreateShipmentDto = z.object({
  carrier: CarrierSchema,
  trackingNumber: z.string().min(1).max(50),
  reference: z.string().max(255).optional(),
  assignedToUserId: z.string().uuid().optional(),
  shipTo: ShipToSchema,
})

// Update shipment DTO
export const UpdateShipmentDto = z.object({
  reference: z.string().max(255).optional(),
  assignedToUserId: z.string().uuid().optional(),
  shipTo: ShipToSchema.optional(),
})

// Bulk create shipments DTO
export const BulkCreateShipmentsDto = z.object({
  shipments: z.array(CreateShipmentDto).min(1).max(100),
})

// Query parameters for listing shipments
export const ShipmentsQueryDto = z.object({
  status: ShipmentStatusSchema.optional(),
  carrier: CarrierSchema.optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  search: z.string().max(255).optional(),
  assigned_to: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

// Shipment response DTO
export const ShipmentResponseDto = z.object({
  id: z.string(),
  carrier: CarrierSchema,
  trackingNumber: z.string(),
  reference: z.string().nullable(),
  status: ShipmentStatusSchema,
  eta: z.string().datetime().nullable(),
  lastEvent: z.string().nullable(),
  lastCarrierPollAt: z.string().datetime().nullable(),
  shipTo: ShipToSchema,
  createdByUserId: z.string(),
  assignedToUserId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

// Shipments list response DTO
export const ShipmentsListResponseDto = z.object({
  items: z.array(ShipmentResponseDto),
  next_cursor: z.string().nullable(),
  total: z.number(),
})

// Refresh shipment tracking DTO
export const RefreshShipmentDto = z.object({
  force: z.boolean().default(false),
})

// TypeScript types
export type Carrier = z.infer<typeof CarrierSchema>
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>
export type ShipTo = z.infer<typeof ShipToSchema>
export type CreateShipmentDto = z.infer<typeof CreateShipmentDto>
export type UpdateShipmentDto = z.infer<typeof UpdateShipmentDto>
export type BulkCreateShipmentsDto = z.infer<typeof BulkCreateShipmentsDto>
export type ShipmentsQueryDto = z.infer<typeof ShipmentsQueryDto>
export type ShipmentResponseDto = z.infer<typeof ShipmentResponseDto>
export type ShipmentsListResponseDto = z.infer<typeof ShipmentsListResponseDto>
export type RefreshShipmentDto = z.infer<typeof RefreshShipmentDto>
