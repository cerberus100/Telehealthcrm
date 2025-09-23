# Eudaura Healthcare Platform API

Multi-tenant, HIPAA-eligible healthcare SaaS API built with NestJS and Fastify.

## Features

- **Multi-tenant Architecture**: Supports Providers, Labs, Pharmacies, and Marketing Companies
- **ABAC Security**: Attribute-based access control with role and purpose-of-use enforcement
- **HIPAA Compliance**: PHI encryption, audit logging, and minimum necessary access
- **CORS Configuration**: Configured for Amplify and localhost development
- **Rate Limiting**: Built-in rate limiting with standard headers
- **Structured Logging**: JSON logs with PHI redaction
- **Error Handling**: Standardized error responses with correlation IDs

## Tech Stack

- **Framework**: NestJS with Fastify adapter
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens (Cognito integration planned)
- **Validation**: Zod schemas
- **Logging**: Pino with structured JSON output
- **Security**: Helmet, CORS, rate limiting

## API Endpoints

### Authentication
- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user and organization

### Health
- `GET /health` - Health check with correlation ID

### Consults
- `GET /consults` - List consults (marketer-safe summaries)
- `GET /consults/{id}` - Get consult details (PHI for providers only)
- `PATCH /consults/{id}/status` - Update consult status

### Shipments
- `GET /shipments` - List shipments (marketer-safe)

### Prescriptions
- `GET /rx` - List prescriptions (provider/pharmacy only)
- `GET /rx/{id}` - Get prescription details (provider/pharmacy only)

### Notifications
- `GET /notifications` - List notifications for in-app bell

## Security Model

### ABAC Enforcement
- **org_id**: Multi-tenant isolation
- **role**: ADMIN, DOCTOR, LAB_TECH, PHARMACIST, MARKETER, SUPPORT
- **purpose_of_use**: Purpose of data access
- **sub**: User identifier

### PHI Protection
- Marketers can only see consult status and shipping information
- Rx and lab results are restricted to providers and pharmacies
- All PHI encrypted at rest and in transit
- Structured logging with PHI redaction

## Development Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
DATABASE_URL="postgresql://..."
LOG_LEVEL="info"
PORT=3001
```

3. Generate Prisma client:
```bash
pnpm prisma:generate
```

4. Run migrations:
```bash
pnpm prisma migrate dev
```

5. Start development server:
```bash
pnpm dev
```

## Testing

For development/testing, you can use header-based authentication:

```bash
# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "dr@example.com", "password": "password123"}'

# Use returned token
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer mock_access_user123_1234567890" \
  -H "x-org-id: org_123" \
  -H "x-role: DOCTOR" \
  -H "x-purpose: TREATMENT"
```

## CORS Configuration

- **Allowed Origins**: `https://main.*.amplifyapp.com`, `http://localhost:3000`
- **Credentials**: `false`
- **Methods**: GET, POST, PUT, PATCH, DELETE
- **Headers**: Authorization, Content-Type, Idempotency-Key, Correlation-Id
- **Exposed Headers**: Correlation-Id, X-RateLimit-Remaining, Retry-After

## Error Handling

All errors follow the standard format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Consult not found",
    "details": null
  }
}
```

## Rate Limiting

- **Limit**: 300 requests per minute
- **Headers**: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After

## Correlation IDs

All requests and responses include correlation IDs for tracing:

- **Request Header**: `Correlation-Id`
- **Response Header**: `Correlation-Id`

## Production Deployment

1. Build the application:
```bash
pnpm build
```

2. Set production environment variables
3. Deploy to AWS with proper security groups and VPC configuration
4. Configure Cognito for production authentication
5. Set up monitoring and alerting

## Security Considerations

- Replace mock authentication with Cognito JWT validation
- Implement proper token blacklisting for logout
- Add request/response encryption for sensitive endpoints
- Configure proper database RLS policies
- Set up audit logging for all PHI access
- Implement proper secret rotation
- Configure WAF and DDoS protection

## OpenAPI Documentation

Full API documentation available at `/openapi.yaml` or import into tools like Postman.
