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
    origin: [
      'https://main.*.amplifyapp.com',
      'http://localhost:3000',
    ],
    credentials: false,
  },
  namespace: '/notifications',
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
  ) {
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);

      // Extract token from handshake auth
      const authData = client.handshake.auth;
      const validationResult = WebSocketAuthSchema.safeParse(authData);

      if (!validationResult.success) {
        this.logger.warn(`Invalid auth data from client ${client.id}:`, validationResult.error);
        client.emit('error', { message: 'Invalid authentication data' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      const token = validationResult.data.token;
      const payload = await this.verifyToken(token);

      if (!payload) {
        this.logger.warn(`Invalid token from client ${client.id}`);
        client.emit('error', { message: 'Invalid or expired token' });
        client.disconnect();
        return;
      }

      // Store user information on socket
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

      this.logger.log(`Client authenticated and connected: ${client.id} (user: ${client.userId}, org: ${client.orgId})`);

      // Send welcome message
      client.emit('connected', {
        message: 'Successfully connected to notification service',
        userId: client.userId,
        orgId: client.orgId,
        role: client.role,
      });

    } catch (error) {
      this.logger.error(`Error handling connection for client ${client.id}:`, error);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
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
    try {
      if (!Array.isArray(data.topics)) {
        client.emit('error', { message: 'Topics must be an array' });
        return;
      }

      // Validate topics based on user role
      const allowedTopics = this.getAllowedTopics(client.role || 'SUPPORT');
      const validTopics = data.topics.filter(topic => allowedTopics.includes(topic));

      // Join topic rooms
      for (const topic of validTopics) {
        await client.join(`topic:${topic}`);
      }

      client.emit('subscribed', {
        topics: validTopics,
        message: `Subscribed to ${validTopics.length} topics`,
      });

      this.logger.log(`Client ${client.id} subscribed to topics: ${validTopics.join(', ')}`);

    } catch (error) {
      this.logger.error(`Error handling subscription from client ${client.id}:`, error);
      client.emit('error', { message: 'Subscription failed' });
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { topics: string[] },
  ) {
    try {
      if (!Array.isArray(data.topics)) {
        client.emit('error', { message: 'Topics must be an array' });
        return;
      }

      // Leave topic rooms
      for (const topic of data.topics) {
        await client.leave(`topic:${topic}`);
      }

      client.emit('unsubscribed', {
        topics: data.topics,
        message: `Unsubscribed from ${data.topics.length} topics`,
      });

      this.logger.log(`Client ${client.id} unsubscribed from topics: ${data.topics.join(', ')}`);

    } catch (error) {
      this.logger.error(`Error handling unsubscription from client ${client.id}:`, error);
      client.emit('error', { message: 'Unsubscription failed' });
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

  private async verifyToken(token: string): Promise<any> {
    try {
      // For development, use mock verification
      // In production, this would verify against Cognito
      if (this.configService.get('NODE_ENV') === 'development') {
        return this.verifyMockToken(token);
      }

      // TODO: Implement Cognito JWT verification
      // const verifier = CognitoJwtVerifier.create({
      //   userPoolId: this.configService.get('COGNITO_USER_POOL_ID'),
      //   tokenUse: 'access',
      //   clientId: this.configService.get('COGNITO_CLIENT_ID'),
      // });
      // return await verifier.verify(token);

      return this.verifyMockToken(token);
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      return null;
    }
  }

  private verifyMockToken(token: string): any {
    // Mock token verification for development
    if (token.startsWith('mock_access_')) {
      const parts = token.split('_');
      if (parts.length >= 4) {
        return {
          sub: parts[2],
          org_id: 'org_123',
          role: 'DOCTOR',
          purpose_of_use: 'TREATMENT',
          exp: Date.now() / 1000 + 3600, // 1 hour from now
        };
      }
    }
    return null;
  }

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
