import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Patch, 
  Query, 
  Body, 
  Param, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { AdminOrganizationsService } from './admin-organizations.service';
import { RequestClaims } from '../../../types/claims';
import { AbacGuard } from '../../../abac/abac.guard';
import { Abac } from '../../../abac/abac.guard';
import { ZodValidationPipe } from '../../../pipes/zod-validation.pipe';
import { z } from 'zod';

// DTOs
const CreateOrganizationDto = z.object({
  name: z.string().min(1, 'Organization name is required'),
  type: z.enum(['PROVIDER', 'LAB', 'PHARMACY', 'MARKETER']),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('US'),
  }),
  contactInfo: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
  }),
  settings: z.object({
    timezone: z.string().default('America/New_York'),
    dateFormat: z.string().default('MM/DD/YYYY'),
    currency: z.string().default('USD'),
    language: z.string().default('en'),
  }),
  compliance: z.object({
    hipaaCompliant: z.boolean().default(false),
    baaRequired: z.boolean().default(true),
    baaSigned: z.boolean().default(false),
    baaSignedAt: z.string().optional(),
    baaExpiresAt: z.string().optional(),
  }),
});

const UpdateOrganizationDto = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['PROVIDER', 'LAB', 'PHARMACY', 'MARKETER']).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  contactInfo: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
  }).optional(),
  settings: z.object({
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    currency: z.string().optional(),
    language: z.string().optional(),
  }).optional(),
  compliance: z.object({
    hipaaCompliant: z.boolean().optional(),
    baaRequired: z.boolean().optional(),
    baaSigned: z.boolean().optional(),
    baaSignedAt: z.string().optional(),
    baaExpiresAt: z.string().optional(),
  }).optional(),
});

const OrganizationsQueryDto = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  type: z.enum(['PROVIDER', 'LAB', 'PHARMACY', 'MARKETER']).optional(),
  search: z.string().optional(),
  hipaaCompliant: z.boolean().optional(),
  baaSigned: z.boolean().optional(),
});

const SignBAADto = z.object({
  signedAt: z.string(),
  expiresAt: z.string().optional(),
  signedBy: z.string(),
});

const AssignAdminDto = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ORG_ADMIN', 'ADMIN']),
});

@Controller('admin/organizations')
@UseGuards(AbacGuard)
export class AdminOrganizationsController {
  constructor(private readonly adminOrganizationsService: AdminOrganizationsService) {}

  @Get()
  @Abac({ resource: 'Organization', action: 'read' })
  async getOrganizations(
    @Query(new ZodValidationPipe(OrganizationsQueryDto)) query: z.infer<typeof OrganizationsQueryDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims;
    return this.adminOrganizationsService.getOrganizations(query, claims);
  }

  @Get('stats')
  @Abac({ resource: 'Organization', action: 'read' })
  async getOrganizationStats(@Req() req: any) {
    const claims: RequestClaims = req.claims;
    return this.adminOrganizationsService.getOrganizationStats(claims);
  }

  @Get('baa-reminders')
  @Abac({ resource: 'Organization', action: 'read' })
  async getBAAReminders(@Req() req: any) {
    const claims: RequestClaims = req.claims;
    return this.adminOrganizationsService.getBAAReminders();
  }

  @Get(':id')
  @Abac({ resource: 'Organization', action: 'read' })
  async getOrganizationById(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims;
    return this.adminOrganizationsService.getOrganizationById(id, claims);
  }

  @Post()
  @Abac({ resource: 'Organization', action: 'write' })
  async createOrganization(
    @Body(new ZodValidationPipe(CreateOrganizationDto)) body: z.infer<typeof CreateOrganizationDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims;
    return this.adminOrganizationsService.createOrganization(body, claims);
  }

  @Put(':id')
  @Abac({ resource: 'Organization', action: 'update' })
  async updateOrganization(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOrganizationDto)) body: z.infer<typeof UpdateOrganizationDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims;
    return this.adminOrganizationsService.updateOrganization(id, body, claims);
  }

  @Patch(':id/sign-baa')
  @Abac({ resource: 'Organization', action: 'update' })
  async signBAA(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SignBAADto)) body: z.infer<typeof SignBAADto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims;
    return this.adminOrganizationsService.signBAA(id, body, claims);
  }

  @Patch(':id/assign-admin')
  @Abac({ resource: 'Organization', action: 'update' })
  async assignAdmin(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignAdminDto)) body: z.infer<typeof AssignAdminDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims;
    return this.adminOrganizationsService.assignAdmin(id, body, claims);
  }
}
