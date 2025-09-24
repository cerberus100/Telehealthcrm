import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { BaseService } from './base.service'

export interface ProviderAvailability {
  providerId: string
  orgId: string
  date: string
  slots: TimeSlot[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  duration: number // in minutes
  isBooked: boolean
  bookedBy?: string // patient ID
  appointmentId?: string
  notes?: string
}

export interface AppointmentBooking {
  id: string
  providerId: string
  patientId: string
  orgId: string
  date: string
  startTime: string
  endTime: string
  duration: number
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  appointmentType: 'TELEHEALTH' | 'IN_PERSON' | 'FOLLOW_UP'
  notes?: string
  createdAt: string
  updatedAt: string
}

@Injectable()
export class SchedulingService extends BaseService {
  private readonly logger = new Logger(SchedulingService.name)
  private readonly dynamodb: DynamoDBClient
  private readonly s3: S3Client
  private readonly tableName: string
  private readonly bucketName: string
  private readonly region: string

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {
    super({} as any) // We'll implement proper Prisma injection later

    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1')
    this.tableName = this.configService.get<string>('DYNAMODB_SCHEDULE_TABLE', 'provider-schedules')
    this.bucketName = this.configService.get<string>('S3_SCHEDULE_BUCKET', 'telehealth-schedules')

    // Initialize AWS clients
    this.dynamodb = new DynamoDBClient({
      region: this.region
    })

    this.s3 = new S3Client({
      region: this.region
    })

    this.logger.log({
      action: 'SCHEDULING_SERVICE_INITIALIZED',
      region: this.region,
      tableName: this.tableName,
      bucketName: this.bucketName
    })
  }

  /**
   * Set provider availability for a specific date
   */
  async setProviderAvailability(
    providerId: string,
    orgId: string,
    date: string,
    slots: Omit<TimeSlot, 'id' | 'isBooked'>[]
  ): Promise<ProviderAvailability> {
    try {
      const availabilityId = uuidv4()
      const now = new Date().toISOString()

      // Create time slots with IDs
      const slotsWithIds = slots.map(slot => ({
        id: uuidv4(),
        ...slot,
        isBooked: false
      }))

      const availability: ProviderAvailability = {
        providerId,
        orgId,
        date,
        slots: slotsWithIds,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }

      // Store in DynamoDB
      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          pk: `PROVIDER#${providerId}`,
          sk: `AVAILABILITY#${date}`,
          ...availability
        })
      })

      await this.dynamodb.send(command)

      this.logger.log({
        action: 'PROVIDER_AVAILABILITY_SET',
        providerId,
        orgId,
        date,
        slotsCount: slots.length
      })

      return availability
    } catch (error) {
      this.logger.error({
        action: 'SET_AVAILABILITY_ERROR',
        providerId,
        orgId,
        date,
        error: (error as Error).message
      })
      throw new BadRequestException('Failed to set provider availability')
    }
  }

  /**
   * Get provider availability for a specific date
   */
  async getProviderAvailability(providerId: string, date: string): Promise<ProviderAvailability | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          pk: `PROVIDER#${providerId}`,
          sk: `AVAILABILITY#${date}`
        })
      })

      const response = await this.dynamodb.send(command)

      if (!response.Item) {
        return null
      }

      const item = unmarshall(response.Item)

      return {
        providerId: item.providerId,
        orgId: item.orgId,
        date: item.date,
        slots: item.slots || [],
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }
    } catch (error) {
      this.logger.error({
        action: 'GET_AVAILABILITY_ERROR',
        providerId,
        date,
        error: (error as Error).message
      })
      throw new BadRequestException('Failed to get provider availability')
    }
  }

  /**
   * Book an appointment
   */
  async bookAppointment(
    providerId: string,
    patientId: string,
    orgId: string,
    slotId: string,
    appointmentType: 'TELEHEALTH' | 'IN_PERSON' | 'FOLLOW_UP' = 'TELEHEALTH',
    notes?: string
  ): Promise<AppointmentBooking> {
    try {
      const appointmentId = uuidv4()
      const now = new Date().toISOString()

      // Find the availability and slot
      const availability = await this.getProviderAvailability(providerId, new Date().toISOString().split('T')[0])
      if (!availability) {
        throw new NotFoundException('Provider availability not found')
      }

      const slot = availability.slots.find(s => s.id === slotId)
      if (!slot) {
        throw new NotFoundException('Time slot not found')
      }

      if (slot.isBooked) {
        throw new BadRequestException('Time slot is already booked')
      }

      // Update the slot as booked
      slot.isBooked = true
      slot.bookedBy = patientId
      slot.appointmentId = appointmentId

      // Create appointment record
      const appointment: AppointmentBooking = {
        id: appointmentId,
        providerId,
        patientId,
        orgId,
        date: availability.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: slot.duration,
        status: 'SCHEDULED',
        appointmentType,
        notes,
        createdAt: now,
        updatedAt: now
      }

      // Update availability in DynamoDB
      const updateCommand = new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({
          pk: `PROVIDER#${providerId}`,
          sk: `AVAILABILITY#${availability.date}`
        }),
        UpdateExpression: 'SET #slots = :slots, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#slots': 'slots',
          '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: marshall({
          ':slots': availability.slots,
          ':updatedAt': now
        })
      })

      await this.dynamodb.send(updateCommand)

      // Store appointment in DynamoDB
      const appointmentCommand = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          pk: `APPOINTMENT#${appointmentId}`,
          sk: `PATIENT#${patientId}`,
          ...appointment
        })
      })

      await this.dynamodb.send(appointmentCommand)

      this.logger.log({
        action: 'APPOINTMENT_BOOKED',
        appointmentId,
        providerId,
        patientId,
        orgId,
        appointmentType,
        date: availability.date,
        startTime: slot.startTime
      })

      return appointment
    } catch (error) {
      this.logger.error({
        action: 'BOOK_APPOINTMENT_ERROR',
        providerId,
        patientId,
        slotId,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Get appointments for a provider on a specific date
   */
  async getProviderAppointments(providerId: string, date: string): Promise<AppointmentBooking[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: 'begins_with(sk, :sk) AND #date = :date',
        ExpressionAttributeNames: {
          '#date': 'date'
        },
        ExpressionAttributeValues: marshall({
          ':pk': `PROVIDER#${providerId}`,
          ':sk': 'APPOINTMENT#',
          ':date': date
        })
      })

      const response = await this.dynamodb.send(command)

      if (!response.Items) {
        return []
      }

      return response.Items.map(item => unmarshall(item)) as AppointmentBooking[]
    } catch (error) {
      this.logger.error({
        action: 'GET_PROVIDER_APPOINTMENTS_ERROR',
        providerId,
        date,
        error: (error as Error).message
      })
      throw new BadRequestException('Failed to get provider appointments')
    }
  }

  /**
   * Get appointments for a patient
   */
  async getPatientAppointments(patientId: string): Promise<AppointmentBooking[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: 'begins_with(sk, :sk)',
        ExpressionAttributeValues: marshall({
          ':pk': `PATIENT#${patientId}`,
          ':sk': 'APPOINTMENT#'
        })
      })

      const response = await this.dynamodb.send(command)

      if (!response.Items) {
        return []
      }

      return response.Items.map(item => unmarshall(item)) as AppointmentBooking[]
    } catch (error) {
      this.logger.error({
        action: 'GET_PATIENT_APPOINTMENTS_ERROR',
        patientId,
        error: (error as Error).message
      })
      throw new BadRequestException('Failed to get patient appointments')
    }
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(appointmentId: string, patientId: string): Promise<void> {
    try {
      // Get the appointment
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          pk: `APPOINTMENT#${appointmentId}`,
          sk: `PATIENT#${patientId}`
        })
      })

      const response = await this.dynamodb.send(command)

      if (!response.Item) {
        throw new NotFoundException('Appointment not found')
      }

      const appointment = unmarshall(response.Item) as AppointmentBooking

      // Update appointment status
      const updateCommand = new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({
          pk: `APPOINTMENT#${appointmentId}`,
          sk: `PATIENT#${patientId}`
        }),
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: marshall({
          ':status': 'CANCELLED',
          ':updatedAt': new Date().toISOString()
        })
      })

      await this.dynamodb.send(updateCommand)

      // Release the time slot
      const availability = await this.getProviderAvailability(appointment.providerId, appointment.date)
      if (availability) {
        const slot = availability.slots.find(s => s.appointmentId === appointmentId)
        if (slot) {
          slot.isBooked = false
          slot.bookedBy = undefined
          slot.appointmentId = undefined

          const availabilityUpdateCommand = new UpdateItemCommand({
            TableName: this.tableName,
            Key: marshall({
              pk: `PROVIDER#${appointment.providerId}`,
              sk: `AVAILABILITY#${appointment.date}`
            }),
            UpdateExpression: 'SET #slots = :slots, #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#slots': 'slots',
              '#updatedAt': 'updatedAt'
            },
            ExpressionAttributeValues: marshall({
              ':slots': availability.slots,
              ':updatedAt': new Date().toISOString()
            })
          })

          await this.dynamodb.send(availabilityUpdateCommand)
        }
      }

      this.logger.log({
        action: 'APPOINTMENT_CANCELLED',
        appointmentId,
        providerId: appointment.providerId,
        patientId,
        date: appointment.date,
        startTime: appointment.startTime
      })
    } catch (error) {
      this.logger.error({
        action: 'CANCEL_APPOINTMENT_ERROR',
        appointmentId,
        patientId,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Generate a signed URL for S3 operations
   */
  async generateSignedUrl(key: string, operation: 'GET' | 'PUT' = 'GET', expiresIn = 3600): Promise<string> {
    try {
      const command = operation === 'GET'
        ? new GetObjectCommand({ Bucket: this.bucketName, Key: key })
        : new PutObjectCommand({ Bucket: this.bucketName, Key: key })

      const signedUrl = await getSignedUrl(this.s3, command, { expiresIn })

      this.logger.debug({
        action: 'SIGNED_URL_GENERATED',
        key,
        operation,
        expiresIn
      })

      return signedUrl
    } catch (error) {
      this.logger.error({
        action: 'GENERATE_SIGNED_URL_ERROR',
        key,
        operation,
        error: (error as Error).message
      })
      throw new BadRequestException('Failed to generate signed URL')
    }
  }
}
