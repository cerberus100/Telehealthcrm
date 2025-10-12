import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CognitoService } from '../auth/cognito.service';
import { logRequest, logError, generateCorrelationId } from '../utils/logger';
import { CorsConfigService } from '../config/cors.config';

// WebSocket authentication schema
const WebSocketAuthSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// Message schemas
const NotificationMessageSchema = z.object({
  type: z.enum(['CONSULT_STATUS_CHANGE', 'SHIPMENT_UPDATE', 'RX_STATUS_CHANGE', 'SYSTEM_ALERT']),
  targetUserId: z.string().optional(),
  targetOrgId: z.string().optional(),
  payload: z.record(z.any()),
});

const HeartbeatMessageSchema = z.object({
  type: z.literal('HEARTBEAT'),
  timestamp: z.number(),
});

// Connection metadata interface
interface AuthenticatedSocket extends Socket {
  userId?: string;
  orgId?: string;
  role?: string;
  purposeOfUse?: string;
  lastHeartbeat?: number;
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow configured origins (will be validated in connection handler)
      const allowedOrigins = process.env.WS_CORS_ORIGINS?.split(',') || ['http://localhost:3000']
      const isAllowed = !origin || allowedOrigins.some(allowed => 
        origin === allowed || origin.includes(allowed.replace('*', ''))
      )
      callback(null, isAllowed)
    },
    credentials: false,
  },
  namespace: '/', // Use root namespace for standard Socket.IO
  path: '/socket.io', // Standard Socket.IO path
  serveClient: false, // Don't serve client library from server
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  transports: ['websocket', 'polling'], // Support both WebSocket and polling fallback
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private readonly heartbeatInterval = 30000; // 30 seconds
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly cognitoService: CognitoService,
  ) {
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();
  }

  async handleConnection(client: AuthenticatedSocket) {
    const correlationId = generateCorrelationId()
    const startTime = Date.now()

    try {
      logRequest({ clientId: client.id, ip: client.handshake.address }, 'info', 'WEBSOCKET_CONNECTION_ATTEMPT', {
        correlationId,
        userAgent: client.handshake.headers?.['user-agent'],
        transport: client.conn.transport.name
      })

      // Extract token from handshake auth
      const authData = client.handshake.auth;
      const validationResult = WebSocketAuthSchema.safeParse(authData);

      if (!validationResult.success) {
        logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_INVALID_AUTH_DATA', {
          correlationId,
          error: validationResult.error.message,
          authData: Object.keys(authData || {})
        })
        client.emit('error', { message: 'Invalid authentication data' });
        client.disconnect();
        return;
      }

      // Verify JWT token using CognitoService
      const token = validationResult.data.token;
      let payload;

      try {
        // Use the Cognito service to validate the token
        payload = await this.cognitoService.validateToken(token);

        // Add span attributes for observability
        const { addSpanAttribute } = await import('../utils/telemetry')
        addSpanAttribute('websocket.user_id', payload.sub)
        addSpanAttribute('websocket.org_id', payload.org_id)
        addSpanAttribute('websocket.role', payload.role)

        // Log successful token validation with enhanced security logging
        logRequest({ clientId: client.id }, 'info', 'WEBSOCKET_TOKEN_VALIDATED', {
          correlationId,
          userId: payload.sub,
          orgId: payload.org_id,
          role: payload.role,
          emailVerified: payload.email_verified,
          mfaEnabled: payload.mfa_enabled,
          purposeOfUse: payload.purpose_of_use
        })

      } catch (error) {
        // Enhanced error logging for security monitoring
        logError(error instanceof Error ? error : new Error(String(error)), { clientId: client.id }, {
          correlationId,
          action: 'WEBSOCKET_JWT_VERIFICATION_FAILED',
          tokenPrefix: token.substring(0, 10) + '...', // Log partial token for debugging without exposing
          tokenLength: token.length
        })

        // Emit structured error response
        client.emit('auth_error', {
          code: 'INVALID_TOKEN',
          message: 'Authentication failed - invalid or expired token',
          timestamp: new Date().toISOString()
        });
        client.disconnect();
        return;
      }

      if (!payload) {
        logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_JWT_VERIFICATION_FAILED', {
          correlationId,
          reason: 'Token validation returned null'
        })
        client.emit('auth_error', {
          code: 'VALIDATION_FAILED',
          message: 'Token validation failed',
          timestamp: new Date().toISOString()
        });
        client.disconnect();
        return;
      }

      // Validate required fields for security
      if (!payload.org_id || !payload.role) {
        logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_AUTHORIZATION_FAILED', {
          correlationId,
          reason: 'Missing required claims',
          hasOrgId: !!payload.org_id,
          hasRole: !!payload.role
        })
        client.emit('auth_error', {
          code: 'INSUFFICIENT_CLAIMS',
          message: 'Insufficient claims in token',
          timestamp: new Date().toISOString()
        });
        client.disconnect();
        return;
      }

      // Validate organization access using PrismaService
      try {
        const { PrismaService } = await import('../prisma.service')
        const prismaService = new PrismaService(this.configService)

        const orgValid = await prismaService.validateOrganization(payload.org_id)
        if (!orgValid) {
          logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_ORG_ACCESS_DENIED', {
            correlationId,
            orgId: payload.org_id,
            reason: 'Organization not found or inactive'
          })
          client.emit('auth_error', {
            code: 'ORG_ACCESS_DENIED',
            message: 'Access denied to organization',
            timestamp: new Date().toISOString()
          });
          client.disconnect();
          return;
        }
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), { clientId: client.id }, {
          correlationId,
          action: 'WEBSOCKET_ORG_VALIDATION_ERROR'
        })
        client.emit('auth_error', {
          code: 'VALIDATION_ERROR',
          message: 'Organization validation failed',
          timestamp: new Date().toISOString()
        });
        client.disconnect();
        return;
      }

      // Store user information on socket with security validation
      client.userId = payload.sub;
      client.orgId = payload.org_id;
      client.role = payload.role;
      client.purposeOfUse = payload.purpose_of_use;
      client.lastHeartbeat = Date.now();

      // Store connection
      this.connectedClients.set(client.id, client);

      // Join user-specific room for targeted notifications
      await client.join(`user:${client.userId}`);
      await client.join(`org:${client.orgId}`);

      const connectionTime = Date.now() - startTime

      // Log successful connection with security context
      logRequest({ clientId: client.id }, 'info', 'WEBSOCKET_CONNECTION_SUCCESS', {
        correlationId,
        userId: client.userId,
        orgId: client.orgId,
        role: client.role,
        emailVerified: payload.email_verified,
        mfaEnabled: payload.mfa_enabled,
        connectionTime,
        transport: client.conn.transport.name,
        ip: client.handshake.address,
        userAgent: client.handshake.headers?.['user-agent']?.substring(0, 100) // Limit for security
      })

      // Send welcome message with security information
      client.emit('connected', {
        message: 'Successfully connected to notification service',
        userId: client.userId,
        orgId: client.orgId,
        role: client.role,
        emailVerified: payload.email_verified,
        mfaEnabled: payload.mfa_enabled,
        purposeOfUse: payload.purpose_of_use,
        correlationId,
        timestamp: new Date().toISOString(),
        allowedTopics: this.getAllowedTopics(client.role || 'SUPPORT')
      });

    } catch (error) {
      const connectionTime = Date.now() - startTime
      logError(error instanceof Error ? error : new Error(String(error)), { clientId: client.id }, {
        correlationId,
        connectionTime,
        action: 'WEBSOCKET_CONNECTION_ERROR'
      })
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const correlationId = generateCorrelationId()

    logRequest({ clientId: client.id }, 'info', 'WEBSOCKET_DISCONNECT', {
      correlationId,
      userId: client.userId,
      orgId: client.orgId,
      role: client.role,
      connectedTime: client.lastHeartbeat ? Date.now() - client.lastHeartbeat : undefined
    })

    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: unknown,
  ) {
    try {
      const validationResult = HeartbeatMessageSchema.safeParse(data);
      
      if (!validationResult.success) {
        client.emit('error', { message: 'Invalid heartbeat format' });
        return;
      }

      // Update last heartbeat
      if (this.connectedClients.has(client.id)) {
        const socket = this.connectedClients.get(client.id);
        if (socket) {
          socket.lastHeartbeat = Date.now();
        }
      }

      // Respond with server timestamp
      client.emit('heartbeat_ack', {
        serverTimestamp: Date.now(),
        clientTimestamp: validationResult.data.timestamp,
      });

    } catch (error) {
      this.logger.error(`Error handling heartbeat from client ${client.id}:`, error);
      client.emit('error', { message: 'Heartbeat processing failed' });
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { topics: string[] },
  ) {
    const correlationId = generateCorrelationId();

    try {
      // Validate input
      if (!Array.isArray(data.topics)) {
        logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_INVALID_SUBSCRIPTION', {
          correlationId,
          reason: 'Topics must be an array',
          requestedTopics: data.topics
        })
        client.emit('subscription_error', {
          code: 'INVALID_FORMAT',
          message: 'Topics must be an array',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (data.topics.length === 0) {
        logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_EMPTY_SUBSCRIPTION', {
          correlationId,
          reason: 'No topics provided'
        })
        client.emit('subscription_error', {
          code: 'EMPTY_TOPICS',
          message: 'At least one topic required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (data.topics.length > 10) {
        logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_TOO_MANY_TOPICS', {
          correlationId,
          requestedCount: data.topics.length,
          maxAllowed: 10
        })
        client.emit('subscription_error', {
          code: 'TOO_MANY_TOPICS',
          message: 'Maximum 10 topics allowed per connection',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Get allowed topics based on user role
      const allowedTopics = this.getAllowedTopics(client.role || 'SUPPORT');
      const validTopics = data.topics.filter(topic => allowedTopics.includes(topic));
      const invalidTopics = data.topics.filter(topic => !allowedTopics.includes(topic));

      // Log security event if user tried to subscribe to unauthorized topics
      if (invalidTopics.length > 0) {
        logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_UNAUTHORIZED_TOPIC_ACCESS', {
          correlationId,
          userRole: client.role,
          requestedTopics: data.topics,
          allowedTopics,
          blockedTopics: invalidTopics
        })
      }

      // Join topic rooms for valid topics only
      for (const topic of validTopics) {
        await client.join(`topic:${topic}`);
      }

      // Log successful subscription
      logRequest({ clientId: client.id }, 'info', 'WEBSOCKET_SUBSCRIPTION_SUCCESS', {
        correlationId,
        userId: client.userId,
        orgId: client.orgId,
        role: client.role,
        subscribedTopics: validTopics,
        blockedTopics: invalidTopics,
        totalTopics: data.topics.length
      })

      client.emit('subscribed', {
        topics: validTopics,
        blockedTopics: invalidTopics,
        message: `Subscribed to ${validTopics.length} of ${data.topics.length} requested topics`,
        timestamp: new Date().toISOString()
      });

      this.logger.log(`Client ${client.id} (${client.role}) subscribed to topics: ${validTopics.join(', ')}`);

    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { clientId: client.id }, {
        correlationId,
        action: 'WEBSOCKET_SUBSCRIPTION_ERROR',
        requestedTopics: data.topics
      })

      client.emit('subscription_error', {
        code: 'SUBSCRIPTION_FAILED',
        message: 'Failed to process subscription request',
        timestamp: new Date().toISOString()
      });
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { topics: string[] },
  ) {
    const correlationId = generateCorrelationId();

    try {
      // Validate input
      if (!Array.isArray(data.topics)) {
        logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_INVALID_UNSUBSCRIPTION', {
          correlationId,
          reason: 'Topics must be an array'
        })
        client.emit('unsubscription_error', {
          code: 'INVALID_FORMAT',
          message: 'Topics must be an array',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (data.topics.length === 0) {
        logRequest({ clientId: client.id }, 'warn', 'WEBSOCKET_EMPTY_UNSUBSCRIPTION', {
          correlationId,
          reason: 'No topics provided'
        })
        client.emit('unsubscription_error', {
          code: 'EMPTY_TOPICS',
          message: 'At least one topic required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Leave topic rooms
      for (const topic of data.topics) {
        await client.leave(`topic:${topic}`);
      }

      // Log successful unsubscription
      logRequest({ clientId: client.id }, 'info', 'WEBSOCKET_UNSUBSCRIPTION_SUCCESS', {
        correlationId,
        userId: client.userId,
        orgId: client.orgId,
        role: client.role,
        unsubscribedTopics: data.topics,
        totalTopics: data.topics.length
      })

      client.emit('unsubscribed', {
        topics: data.topics,
        message: `Successfully unsubscribed from ${data.topics.length} topics`,
        timestamp: new Date().toISOString()
      });

      this.logger.log(`Client ${client.id} (${client.role}) unsubscribed from topics: ${data.topics.join(', ')}`);

    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { clientId: client.id }, {
        correlationId,
        action: 'WEBSOCKET_UNSUBSCRIPTION_ERROR',
        requestedTopics: data.topics
      })

      client.emit('unsubscription_error', {
        code: 'UNSUBSCRIPTION_FAILED',
        message: 'Failed to process unsubscription request',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Enhanced real-time event methods

  /**
   * Trigger screen-pop for incoming calls
   */
  emitScreenPop(targetOrgId: string, callData: {
    consultId: string
    contactId?: string
    callerName?: string
    callerPhone: string
    serviceMode: string
  }) {
    const event = {
      type: 'INCOMING_CALL',
      ...callData,
      callerPhone: callData.callerPhone.replace(/\d(?=\d{4})/g, '*'), // Mask phone for privacy
      timestamp: new Date().toISOString()
    }
    
    this.server.to(`org:${targetOrgId}`).emit('screen-pop', event)
    
    this.logger.log(`Screen-pop emitted to org ${targetOrgId} for consult ${callData.consultId}`)
  }

  /**
   * Broadcast provider availability changes
   */
  emitProviderAvailability(orgId: string, providerId: string, available: boolean, providerName?: string) {
    const event = {
      type: 'PROVIDER_AVAILABILITY',
      providerId,
      providerName,
      available,
      timestamp: new Date().toISOString()
    }
    
    this.server.to(`org:${orgId}`).emit('provider-availability', event)
    
    this.logger.log(`Provider availability broadcast: ${providerId} is ${available ? 'available' : 'offline'}`)
  }

  /**
   * Send approval status updates to marketers (HIPAA-safe)
   */
  emitApprovalUpdate(marketerOrgId: string, approvalData: {
    consultId: string
    status: 'APPROVED' | 'DECLINED' | 'PENDING'
    service: string
    patientInitials?: string
  }) {
    const event = {
      type: 'APPROVAL_UPDATE',
      consultId: approvalData.consultId,
      status: approvalData.status,
      service: approvalData.service,
      patientInitials: approvalData.patientInitials, // Safe: initials only
      timestamp: new Date().toISOString()
    }
    
    this.server.to(`org:${marketerOrgId}`).emit('approval-update', event)
    
    this.logger.log(`Approval update sent to marketer org ${marketerOrgId}: ${approvalData.status}`)
  }

  /**
   * Send intake submission notifications
   */
  emitIntakeSubmission(marketerOrgId: string, submissionData: {
    submissionId: string
    consultId: string
    patientName: string
    serviceRequested: string
    linkId: string
  }) {
    const event = {
      type: 'INTAKE_SUBMISSION',
      submissionId: submissionData.submissionId,
      consultId: submissionData.consultId,
      patientName: submissionData.patientName,
      serviceRequested: submissionData.serviceRequested,
      linkId: submissionData.linkId,
      timestamp: new Date().toISOString()
    }
    
    this.server.to(`org:${marketerOrgId}`).emit('intake-submission', event)
    
    this.logger.log(`Intake submission notification sent to marketer org ${marketerOrgId}`)
  }

  /**
   * Send lab result notifications to providers
   */
  emitLabResult(providerOrgId: string, resultData: {
    labOrderId: string
    patientName: string
    testName: string
    flagged: boolean
  }) {
    const event = {
      type: 'LAB_RESULT_READY',
      labOrderId: resultData.labOrderId,
      patientName: resultData.patientName,
      testName: resultData.testName,
      flagged: resultData.flagged,
      timestamp: new Date().toISOString()
    }
    
    this.server.to(`org:${providerOrgId}`).emit('lab-result', event)
    
    this.logger.log(`Lab result notification sent to provider org ${providerOrgId}`)
  }

  /**
   * Send shipment updates to marketers (shipping info only)
   */
  emitShipmentUpdate(marketerOrgId: string, shipmentData: {
    trackingNumber: string
    status: string
    city: string
    state: string
  }) {
    const event = {
      type: 'SHIPMENT_UPDATE',
      trackingNumber: shipmentData.trackingNumber,
      status: shipmentData.status,
      location: `${shipmentData.city}, ${shipmentData.state}`, // Non-PHI location only
      timestamp: new Date().toISOString()
    }
    
    this.server.to(`org:${marketerOrgId}`).emit('shipment-update', event)
    
    this.logger.log(`Shipment update sent to marketer org ${marketerOrgId}: ${shipmentData.status}`)
  }

  // Public method to send notifications
  async sendNotification(notification: {
    type: string;
    targetUserId?: string;
    targetOrgId?: string;
    payload: Record<string, any>;
  }) {
    try {
      const validationResult = NotificationMessageSchema.safeParse(notification);
      
      if (!validationResult.success) {
        this.logger.error('Invalid notification format:', validationResult.error);
        return;
      }

      const { type, targetUserId, targetOrgId, payload } = validationResult.data;

      // Send to specific user if targetUserId is provided
      if (targetUserId) {
        this.server.to(`user:${targetUserId}`).emit('notification', {
          type,
          payload,
          timestamp: Date.now(),
        });
        this.logger.log(`Notification sent to user: ${targetUserId}`);
      }

      // Send to organization if targetOrgId is provided
      if (targetOrgId) {
        this.server.to(`org:${targetOrgId}`).emit('notification', {
          type,
          payload,
          timestamp: Date.now(),
        });
        this.logger.log(`Notification sent to org: ${targetOrgId}`);
      }

      // Send to topic subscribers
      this.server.to(`topic:${type}`).emit('notification', {
        type,
        payload,
        timestamp: Date.now(),
      });

    } catch (error) {
      this.logger.error('Error sending notification:', error);
    }
  }

  // Broadcast system-wide notifications
  async broadcastSystemNotification(type: string, payload: Record<string, any>) {
    this.server.emit('system_notification', {
      type,
      payload,
      timestamp: Date.now(),
    });
    this.logger.log(`System notification broadcasted: ${type}`);
  }

  // Get connection statistics
  getConnectionStats() {
    const stats = {
      totalConnections: this.connectedClients.size,
      connectionsByOrg: new Map<string, number>(),
      connectionsByRole: new Map<string, number>(),
      uptime: process.uptime(),
      lastHeartbeatCheck: Date.now(),
    };

    for (const client of this.connectedClients.values()) {
      // Count by organization
      if (client.orgId) {
        const orgCount = stats.connectionsByOrg.get(client.orgId) || 0;
        stats.connectionsByOrg.set(client.orgId, orgCount + 1);
      }

      // Count by role
      if (client.role) {
        const roleCount = stats.connectionsByRole.get(client.role) || 0;
        stats.connectionsByRole.set(client.role, roleCount + 1);
      }
    }

    return stats;
  }

  // WebSocket health endpoint
  @SubscribeMessage('health')
  async handleHealthCheck(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: unknown,
  ) {
    const correlationId = generateCorrelationId()
    const healthData = {
      status: 'healthy',
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      client: {
        id: client.id,
        userId: client.userId,
        orgId: client.orgId,
        role: client.role,
        connectedAt: client.handshake?.time,
        lastHeartbeat: client.lastHeartbeat,
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connections: this.connectedClients.size,
        environment: this.configService.get<string>('NODE_ENV', 'development'),
      }
    }

    logRequest({ clientId: client.id }, 'info', 'WEBSOCKET_HEALTH_CHECK', {
      correlationId,
      userId: client.userId,
      orgId: client.orgId
    })

    client.emit('health_response', healthData)
  }

  // Token verification is now handled by CognitoService
  // This method is kept for backwards compatibility but delegates to CognitoService

  private getAllowedTopics(role: string): string[] {
    const topicMap: Record<string, string[]> = {
      ADMIN: ['CONSULT_STATUS_CHANGE', 'SHIPMENT_UPDATE', 'RX_STATUS_CHANGE', 'SYSTEM_ALERT', 'USER_MANAGEMENT'],
      DOCTOR: ['CONSULT_STATUS_CHANGE', 'RX_STATUS_CHANGE', 'SYSTEM_ALERT'],
      PHARMACIST: ['RX_STATUS_CHANGE', 'SYSTEM_ALERT'],
      LAB_TECH: ['SHIPMENT_UPDATE', 'SYSTEM_ALERT'],
      MARKETER: ['CONSULT_STATUS_CHANGE', 'SHIPMENT_UPDATE'],
      SUPPORT: ['SYSTEM_ALERT', 'USER_MANAGEMENT'],
    };

    return topicMap[role] || ['SYSTEM_ALERT'];
  }

  private startHeartbeatMonitoring() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeoutThreshold = this.heartbeatInterval * 2; // 60 seconds

      for (const [clientId, client] of this.connectedClients.entries()) {
        if (client.lastHeartbeat && now - client.lastHeartbeat > timeoutThreshold) {
          this.logger.warn(`Client ${clientId} heartbeat timeout, disconnecting`);
          client.disconnect();
          this.connectedClients.delete(clientId);
        }
      }
    }, this.heartbeatInterval);
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }
}
