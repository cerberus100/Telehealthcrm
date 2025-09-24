# Production Configuration Guide

This guide explains how to configure CORS origins and rate limiting for production deployment with AWS Amplify and custom domains.

## Environment Configuration

The application supports environment-driven configuration for both CORS and rate limiting, making it easy to deploy to different environments (development, staging, production) with appropriate security settings.

### Required Environment Variables

#### AWS Amplify Configuration
```bash
AWS_REGION=us-east-1                    # Your AWS region
AWS_BRANCH=main                         # Your deployment branch
AMPLIFY_APP_ID=d123456789              # Your Amplify app ID
```

#### Deployment Environment
```bash
NODE_ENV=production                     # Environment type
DEPLOYMENT_ENV=production              # Deployment environment
```

#### Custom Domains (REQUIRED for production)
```bash
CUSTOM_DOMAINS=yourdomain.com,app.yourdomain.com,api.yourdomain.com
```

## CORS Configuration

The CORS configuration is automatically built based on your environment and deployment settings. The system supports:

### Production CORS Origins
The following origins are automatically included for production:

- `https://yourdomain.com`
- `https://app.yourdomain.com`
- `https://main.{AMPLIFY_APP_ID}.amplifyapp.com` (Amplify deployment)
- `https://*.yourdomain.com` (wildcard for subdomains)

### Staging/Preview Origins
For staging environments, the system includes:

- `https://{BRANCH}.{AMPLIFY_APP_ID}.amplifyapp.com`
- `https://pr-*.{AMPLIFY_APP_ID}.amplifyapp.com` (Pull request previews)
- Custom domains if specified

### Development Origins
For development environments:

- `http://localhost:3000`
- `http://localhost:3001`
- `https://*.ngrok.io`
- `https://*.localtunnel.me`

### Custom Configuration Override
You can override the default CORS settings:

```bash
# Additional allowed origins (comma-separated)
CORS_ORIGINS=https://additional-domain.com,https://another-domain.com

# HTTP methods allowed
CORS_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS

# Headers that can be sent
CORS_HEADERS=Authorization,Content-Type,Idempotency-Key,X-Correlation-Id

# Headers exposed to the client
CORS_EXPOSED_HEADERS=X-Correlation-Id,X-RateLimit-Limit,X-RateLimit-Remaining

# Cache preflight requests (seconds)
CORS_MAX_AGE=86400

# Allow credentials
CORS_CREDENTIALS=true
```

## Rate Limiting Configuration

Rate limiting is automatically configured based on your environment with different strategies for different types of requests.

### Production Rate Limits

#### Default Limits
```bash
RATE_LIMIT_ENABLED=true                 # Enable rate limiting
RATE_LIMIT_MAX=300                     # Max requests per window
RATE_LIMIT_WINDOW_MS=60000             # 1 minute window
```

#### Endpoint-Specific Limits

**Authentication Endpoints** (login, refresh, etc.):
- 10 requests per minute per IP+email combination
- Key: `auth:{IP}:{email}`

**Sensitive Data Endpoints** (patients, prescriptions, consults):
- 50 requests per minute per user
- Key: `sensitive:{orgId}:{userId}`

**File Uploads**:
- 20 requests per 5 minutes per user
- Key: `upload:{userId}`

**API Keys and Bearer Tokens**:
- 1000 requests per minute per key
- Key: `apikey:{first-8-chars}` or `bearer:{first-8-chars}`

**Health Checks**:
- 1000 requests per minute per IP
- Key: `health:{IP}`

**Static Assets**:
- 2000 requests per minute per IP
- Key: `static:{IP}`

**Bulk Operations**:
- 10 requests per minute per user
- Key: `bulk:{userId}`

### Environment-Specific Settings

#### Development
```bash
RATE_LIMIT_DEV_MAX=1000                # Higher limits for development
RATE_LIMIT_DEV_WINDOW=300000           # 5 minute windows
```

#### Staging
```bash
RATE_LIMIT_STAGING_MAX=600             # Moderate limits for staging
RATE_LIMIT_STAGING_WINDOW=120000       # 2 minute windows
```

#### Production
```bash
RATE_LIMIT_PROD_MAX=300                # Strict limits for production
RATE_LIMIT_PROD_WINDOW=60000           # 1 minute windows
```

### Rate Limit Key Generation

The system uses intelligent key generation based on the environment:

#### Development
- User + Org: `dev:user:{orgId}:{userId}`
- IP-based: `dev:ip:{IP}`

#### Staging
- User + Org: `staging:user:{orgId}:{userId}`
- IP-based: `staging:ip:{IP}`

#### Production
- User + Org: `prod:user:{orgId}:{userId}`
- IP-based: `prod:ip:{IP}`

## WebSocket Configuration

WebSocket connections use the same CORS configuration as REST endpoints:

```bash
# WebSocket-specific CORS origins
WS_CORS_ORIGINS=https://yourdomain.com,https://main.*.amplifyapp.com

# WebSocket credentials
WS_CORS_CREDENTIALS=true

# Heartbeat settings
WS_HEARTBEAT_INTERVAL=30000            # 30 seconds
WS_CONNECTION_TIMEOUT=60000            # 60 seconds timeout
```

## Amplify Console Configuration

### Environment Variables in Amplify Console

1. **Go to your Amplify Console application**
2. **Navigate to App settings > Environment variables**
3. **Add the following variables:**

#### Required Variables
```
AWS_REGION=us-east-1
AWS_BRANCH=main
AMPLIFY_APP_ID=d123456789
NODE_ENV=production
DEPLOYMENT_ENV=production
CUSTOM_DOMAINS=yourdomain.com,app.yourdomain.com
```

#### Database Configuration
```
DATABASE_URL=postgresql://user:password@your-rds-instance.region.rds.amazonaws.com:5432/telehealth
```

#### Redis Configuration
```
REDIS_HOST=your-redis-cluster.region.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

#### Authentication
```
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=XXXXXXXXXXXXXX
```

#### Rate Limiting
```
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PROD_MAX=300
RATE_LIMIT_PROD_WINDOW=60000
```

## Custom Domain Setup

### 1. Configure Custom Domain in Amplify Console

1. **Go to your Amplify application**
2. **Navigate to App settings > Domain management**
3. **Add custom domain**: `yourdomain.com`
4. **Configure subdomains**:
   - `app.yourdomain.com` → Frontend
   - `api.yourdomain.com` → Backend (if using custom domain for API)

### 2. Update Environment Variables

```bash
CUSTOM_DOMAINS=yourdomain.com,app.yourdomain.com,api.yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
WS_CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### 3. DNS Configuration

Add CNAME records for your domains:
- `app.yourdomain.com` → `main.{AMPLIFY_APP_ID}.amplifyapp.com`
- `api.yourdomain.com` → `main.{AMPLIFY_APP_ID}.amplifyapp.com`

## Monitoring and Logging

### CORS and Rate Limit Logging

The system logs configuration summaries on startup:

```json
{
  "cors_origins_count": 5,
  "cors_origins_sample": ["https://yourdomain.com", "https://app.yourdomain.com"],
  "cors_credentials": true,
  "cors_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  "cors_max_age": 86400,
  "environment": "production",
  "deployment_env": "production",
  "amplify_app_id": "d123456789",
  "custom_domains": "yourdomain.com,app.yourdomain.com"
}
```

### Rate Limit Logging

```json
{
  "rate_limit_enabled": true,
  "rate_limit_max": 300,
  "rate_limit_window_ms": 60000,
  "rate_limit_strategies_count": 6,
  "rate_limit_strategies": ["base", "auth_endpoints", "sensitive_endpoints", "file_uploads", "api_keys", "health_check"],
  "environment": "production",
  "deployment_env": "production",
  "key_generator": "user"
}
```

## Troubleshooting

### Common Issues

#### CORS Errors in Production
1. **Check if your domain is in CUSTOM_DOMAINS**
2. **Verify AWS_BRANCH and AMPLIFY_APP_ID are correct**
3. **Ensure NODE_ENV=production and DEPLOYMENT_ENV=production**
4. **Check browser network tab for exact error**

#### Rate Limiting Too Aggressive
1. **Increase RATE_LIMIT_PROD_MAX for specific environments**
2. **Adjust RATE_LIMIT_PROD_WINDOW for longer/shorter windows**
3. **Review rate limit logs for specific endpoints being throttled**

#### WebSocket Connection Issues
1. **Verify WS_CORS_ORIGINS includes your domain**
2. **Check that WS_CORS_CREDENTIALS=true**
3. **Ensure firewall allows WebSocket connections on port 443**

### Debugging Commands

#### Check Current Configuration
```bash
# View effective CORS configuration
curl https://your-api-domain.com/health

# View rate limit status
curl -H "Authorization: Bearer <token>" https://your-api-domain.com/health
```

#### Test CORS from Client
```javascript
// Test CORS with different origins
fetch('https://your-api-domain.com/health', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://yourdomain.com',
    'Access-Control-Request-Method': 'GET'
  }
})
.then(response => console.log('CORS status:', response.status))
```

#### Monitor Rate Limits
```bash
# Check Redis for rate limit keys (if accessible)
redis-cli KEYS "rate_limit:*" | head -20
```

## Security Considerations

### Production Security Checklist

- [ ] **Custom domains configured** in Amplify Console
- [ ] **HTTPS enforced** for all origins
- [ ] **Rate limiting enabled** for production
- [ ] **CORS credentials enabled** for authenticated requests
- [ ] **Environment variables set** in Amplify Console
- [ ] **Database credentials secured** (not in version control)
- [ ] **Redis credentials secured** for production rate limiting

### Compliance Requirements

- [ ] **HTTPS only** for all CORS origins
- [ ] **Rate limiting** configured for sensitive endpoints
- [ ] **Audit logging** enabled for configuration changes
- [ ] **Environment isolation** between dev/staging/prod

## Support

For configuration issues:

1. **Check the logs** in Amplify Console for CORS/rate limit errors
2. **Verify environment variables** are set correctly in Amplify Console
3. **Test with different origins** to isolate the issue
4. **Review the configuration summaries** in application logs

The system provides detailed logging of configuration decisions, making it easy to troubleshoot deployment issues in different environments.
