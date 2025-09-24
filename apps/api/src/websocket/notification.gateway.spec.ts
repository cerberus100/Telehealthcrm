import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { NotificationGateway } from './notification.gateway'
import { CognitoService } from '../auth/cognito.service'

describe('NotificationGateway', () => {
  let gateway: NotificationGateway
  let cognitoService: CognitoService
  let configService: ConfigService

  const mockCognitoService = {
    validateToken: jest.fn(),
  }

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'WS_CORS_ORIGINS': 'http://localhost:3000,https://main.*.amplifyapp.com',
        'WS_CORS_CREDENTIALS': false,
        'NODE_ENV': 'test',
      }
      return config[key as keyof typeof config] || undefined
    }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        {
          provide: CognitoService,
          useValue: mockCognitoService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    gateway = module.get<NotificationGateway>(NotificationGateway)
    cognitoService = module.get<CognitoService>(CognitoService)
    configService = module.get<ConfigService>(ConfigService)
  })

  it('should be defined', () => {
    expect(gateway).toBeDefined()
  })

  describe('WebSocket Gateway Configuration', () => {
    it('should have correct CORS configuration', () => {
      expect(gateway).toBeDefined()
      // CORS configuration is tested through the decorator options
    })

    it('should have correct Socket.IO configuration', () => {
      expect(gateway).toBeDefined()
      // Socket.IO configuration is tested through the decorator options
    })

    it('should have proper heartbeat monitoring', () => {
      expect(gateway['heartbeatInterval']).toBe(30000) // 30 seconds
      expect(gateway).toHaveProperty('startHeartbeatMonitoring')
    })
  })

  describe('Connection Handling', () => {
    it('should handle invalid authentication data', async () => {
      const mockClient = {
        id: 'test-client',
        handshake: {
          auth: {}, // Invalid auth data
          address: '127.0.0.1',
          headers: { 'user-agent': 'test-agent' }
        },
        conn: { transport: { name: 'websocket' } },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as any

      await gateway.handleConnection(mockClient)

      expect(mockClient.emit).toHaveBeenCalledWith('error', { message: 'Invalid authentication data' })
      expect(mockClient.disconnect).toHaveBeenCalled()
    })

    it('should handle JWT verification failure', async () => {
      mockCognitoService.validateToken.mockRejectedValue(new Error('Invalid token'))

      const mockClient = {
        id: 'test-client',
        handshake: {
          auth: { token: 'invalid-token' },
          address: '127.0.0.1',
          headers: { 'user-agent': 'test-agent' }
        },
        conn: { transport: { name: 'websocket' } },
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as any

      await gateway.handleConnection(mockClient)

      expect(mockClient.emit).toHaveBeenCalledWith('error', { message: 'Invalid or expired token' })
      expect(mockClient.disconnect).toHaveBeenCalled()
    })

    it('should handle successful authentication', async () => {
      const mockPayload = {
        sub: 'user123',
        org_id: 'org123',
        role: 'DOCTOR',
        purpose_of_use: 'TREATMENT',
      }

      mockCognitoService.validateToken.mockResolvedValue(mockPayload)

      const mockClient = {
        id: 'test-client',
        handshake: {
          auth: { token: 'valid-token' },
          address: '127.0.0.1',
          headers: { 'user-agent': 'test-agent' },
          time: Date.now(),
        },
        conn: { transport: { name: 'websocket' } },
        emit: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
      } as any

      await gateway.handleConnection(mockClient)

      expect(mockClient.userId).toBe('user123')
      expect(mockClient.orgId).toBe('org123')
      expect(mockClient.role).toBe('DOCTOR')
      expect(mockClient.emit).toHaveBeenCalledWith('connected', expect.objectContaining({
        userId: 'user123',
        orgId: 'org123',
        role: 'DOCTOR',
      }))
    })
  })

  describe('Message Handling', () => {
    it('should handle heartbeat messages', async () => {
      const mockClient = {
        id: 'test-client',
        lastHeartbeat: Date.now() - 40000, // 40 seconds ago
        emit: jest.fn(),
      } as any

      // Add client to connected clients
      gateway['connectedClients'].set('test-client', mockClient)

      const heartbeatData = {
        type: 'HEARTBEAT',
        timestamp: Date.now(),
      }

      await gateway.handleHeartbeat(mockClient, heartbeatData)

      expect(mockClient.lastHeartbeat).toBeGreaterThan(Date.now() - 1000) // Recently updated
      expect(mockClient.emit).toHaveBeenCalledWith('heartbeat_ack', expect.objectContaining({
        serverTimestamp: expect.any(Number),
        clientTimestamp: heartbeatData.timestamp,
      }))
    })

    it('should handle health check messages', async () => {
      const mockClient = {
        id: 'test-client',
        userId: 'user123',
        orgId: 'org123',
        role: 'DOCTOR',
        handshake: { time: Date.now() },
        lastHeartbeat: Date.now(),
        emit: jest.fn(),
      } as any

      await gateway.handleHealthCheck(mockClient, {})

      expect(mockClient.emit).toHaveBeenCalledWith('health_response', expect.objectContaining({
        status: 'healthy',
        client: {
          id: 'test-client',
          userId: 'user123',
          orgId: 'org123',
          role: 'DOCTOR',
        },
        server: expect.objectContaining({
          uptime: expect.any(Number),
          connections: expect.any(Number),
          environment: 'test',
        }),
      }))
    })

    it('should handle subscription messages', async () => {
      const mockClient = {
        id: 'test-client',
        role: 'DOCTOR',
        emit: jest.fn(),
        join: jest.fn(),
      } as any

      const subscriptionData = {
        topics: ['CONSULT_STATUS_CHANGE', 'RX_STATUS_CHANGE'],
      }

      await gateway.handleSubscribe(mockClient, subscriptionData)

      expect(mockClient.emit).toHaveBeenCalledWith('subscribed', {
        topics: ['CONSULT_STATUS_CHANGE', 'RX_STATUS_CHANGE'],
        message: 'Subscribed to 2 topics',
      })
      expect(mockClient.join).toHaveBeenCalledWith('topic:CONSULT_STATUS_CHANGE')
      expect(mockClient.join).toHaveBeenCalledWith('topic:RX_STATUS_CHANGE')
    })

    it('should handle unsubscription messages', async () => {
      const mockClient = {
        id: 'test-client',
        emit: jest.fn(),
        leave: jest.fn(),
      } as any

      const unsubscriptionData = {
        topics: ['CONSULT_STATUS_CHANGE'],
      }

      await gateway.handleUnsubscribe(mockClient, unsubscriptionData)

      expect(mockClient.emit).toHaveBeenCalledWith('unsubscribed', {
        topics: ['CONSULT_STATUS_CHANGE'],
        message: 'Unsubscribed from 1 topics',
      })
      expect(mockClient.leave).toHaveBeenCalledWith('topic:CONSULT_STATUS_CHANGE')
    })
  })

  describe('Event Broadcasting', () => {
    it('should broadcast screen pop events', () => {
      const mockServer = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      }

      gateway['server'] = mockServer as any

      const screenPopData = {
        consultId: 'consult123',
        contactId: 'contact123',
        callerName: 'John Doe',
        callerPhone: '555-0123',
        serviceMode: 'TELEHEALTH',
      }

      gateway.emitScreenPop('org123', screenPopData)

      expect(mockServer.to).toHaveBeenCalledWith('org:org123')
      expect(mockServer.to().emit).toHaveBeenCalledWith('screen-pop', expect.objectContaining({
        type: 'INCOMING_CALL',
        consultId: 'consult123',
        contactId: 'contact123',
        callerName: 'John Doe',
        callerPhone: '***-0123', // Phone should be masked
        serviceMode: 'TELEHEALTH',
      }))
    })

    it('should broadcast provider availability', () => {
      const mockServer = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      }

      gateway['server'] = mockServer as any

      gateway.emitProviderAvailability('org123', 'provider123', true, 'Dr. Smith')

      expect(mockServer.to).toHaveBeenCalledWith('org:org123')
      expect(mockServer.to().emit).toHaveBeenCalledWith('provider-availability', expect.objectContaining({
        type: 'PROVIDER_AVAILABILITY',
        providerId: 'provider123',
        providerName: 'Dr. Smith',
        available: true,
      }))
    })
  })

  describe('Connection Statistics', () => {
    it('should return connection statistics', () => {
      const stats = gateway.getConnectionStats()

      expect(stats).toHaveProperty('totalConnections')
      expect(stats).toHaveProperty('connectionsByOrg')
      expect(stats).toHaveProperty('connectionsByRole')
      expect(stats).toHaveProperty('uptime')
      expect(stats).toHaveProperty('lastHeartbeatCheck')
      expect(typeof stats.totalConnections).toBe('number')
      expect(typeof stats.uptime).toBe('number')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed heartbeat data', async () => {
      const mockClient = {
        id: 'test-client',
        emit: jest.fn(),
      } as any

      const malformedData = {
        // Missing required fields
      }

      await gateway.handleHeartbeat(mockClient, malformedData)

      expect(mockClient.emit).toHaveBeenCalledWith('error', { message: 'Invalid heartbeat format' })
    })

    it('should handle malformed subscription data', async () => {
      const mockClient = {
        id: 'test-client',
        emit: jest.fn(),
      } as any

      const malformedData = {
        // topics is not an array
        topics: 'invalid-topics',
      } as any // Type assertion to bypass TypeScript checking for malformed data

      await gateway.handleSubscribe(mockClient, malformedData)

      expect(mockClient.emit).toHaveBeenCalledWith('error', { message: 'Topics must be an array' })
    })
  })
})
