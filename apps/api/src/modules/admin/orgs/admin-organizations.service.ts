import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { RequestClaims } from '../../../types/claims';
import { z } from 'zod';

// Organization management schemas
const CreateOrganizationSchema = z.object({
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

const UpdateOrganizationSchema = z.object({
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

const OrganizationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  type: z.enum(['PROVIDER', 'LAB', 'PHARMACY', 'MARKETER']).optional(),
  search: z.string().optional(),
  hipaaCompliant: z.boolean().optional(),
  baaSigned: z.boolean().optional(),
});

const AssignAdminSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ORG_ADMIN', 'ORG_MANAGER']),
});

@Injectable()
export class AdminOrganizationsService {
  private readonly logger = new Logger(AdminOrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrganizations(query: z.infer<typeof OrganizationsQuerySchema>, claims: RequestClaims) {
    try {
      const where: any = {};

      // Add type filter
      if (query.type) {
        where.type = query.type;
      }

      // Add HIPAA compliance filter
      if (query.hipaaCompliant !== undefined) {
        where.compliance = {
          hipaaCompliant: query.hipaaCompliant,
        };
      }

      // Add BAA signed filter
      if (query.baaSigned !== undefined) {
        where.compliance = {
          ...where.compliance,
          baaSigned: query.baaSigned,
        };
      }

      // Add search filter
      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { 'contactInfo.email': { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const take = query.limit || 50;

      const organizations = await this.prisma.organization.findMany({
        where,
        take: take + 1,
        skip: query.cursor ? 1 : 0,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          contactInfo: true,
          settings: true,
          compliance: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

      const hasNext = organizations.length > take;
      const items = organizations.slice(0, take);

      return {
        items: items.map((org: any) => ({
          id: org.id,
          name: org.name,
          type: org.type,
          address: org.address,
          contactInfo: org.contactInfo,
          settings: org.settings,
          compliance: org.compliance,
          userCount: org._count.users,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
        })),
        next_cursor: hasNext && items[items.length - 1] ? items[items.length - 1]?.id : null,
      };

    } catch (error) {
      this.logger.error('Error getting organizations:', error);
      throw error;
    }
  }

  async getOrganizationById(orgId: string, claims: RequestClaims) {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          contactInfo: true,
          settings: true,
          compliance: true,
          createdAt: true,
          updatedAt: true,
          users: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              isActive: true,
              lastLoginAt: true,
            },
          },
        },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      return {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        address: organization.address,
        contactInfo: organization.contactInfo,
        settings: organization.settings,
        compliance: organization.compliance,
        users: organization.users.map((user: any) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt?.toISOString(),
        })),
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error getting organization by ID:', error);
      throw error;
    }
  }

  async createOrganization(data: z.infer<typeof CreateOrganizationSchema>, claims: RequestClaims) {
    try {
      // Check if organization with same name already exists
      const existingOrg = await this.prisma.organization.findFirst({
        where: {
          name: data.name,
        },
      });

      if (existingOrg) {
        throw new BadRequestException('Organization with this name already exists');
      }

      // Create organization
      const organization = await this.prisma.organization.create({
        data: {
          name: data.name,
          type: data.type,
          address: data.address,
          contactInfo: data.contactInfo,
          settings: data.settings,
          compliance: data.compliance,
        },
      });

      this.logger.log(`Organization created: ${organization.id} (${organization.name}) by ${claims.sub}`);

      return {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        address: organization.address,
        contactInfo: organization.contactInfo,
        settings: organization.settings,
        compliance: organization.compliance,
        createdAt: organization.createdAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error creating organization:', error);
      throw error;
    }
  }

  async updateOrganization(orgId: string, data: z.infer<typeof UpdateOrganizationSchema>, claims: RequestClaims) {
    try {
      // Check if organization exists
      const existingOrg = await this.prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!existingOrg) {
        throw new NotFoundException('Organization not found');
      }

      // Update organization
      const organization = await this.prisma.organization.update({
        where: { id: orgId },
        data: {
          name: data.name,
          type: data.type,
          address: data.address,
          contactInfo: data.contactInfo,
          settings: data.settings,
          compliance: data.compliance,
        },
      });

      this.logger.log(`Organization updated: ${organization.id} (${organization.name}) by ${claims.sub}`);

      return {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        address: organization.address,
        contactInfo: organization.contactInfo,
        settings: organization.settings,
        compliance: organization.compliance,
        updatedAt: organization.updatedAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error updating organization:', error);
      throw error;
    }
  }

  async signBAA(orgId: string, baaData: {
    signedAt: string;
    expiresAt?: string;
    signedBy: string;
  }, claims: RequestClaims) {
    try {
      // Check if organization exists
      const existingOrg = await this.prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!existingOrg) {
        throw new NotFoundException('Organization not found');
      }

      // Update BAA compliance
      const organization = await this.prisma.organization.update({
        where: { id: orgId },
        data: {
          compliance: {
            ...(existingOrg.compliance as any || {}),
            baaSigned: true,
            baaSignedAt: baaData.signedAt,
            baaExpiresAt: baaData.expiresAt,
          },
        },
      });

      this.logger.log(`BAA signed for organization: ${organization.id} by ${claims.sub}`);

      return {
        id: organization.id,
        name: organization.name,
        compliance: organization.compliance,
        updatedAt: organization.updatedAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error signing BAA:', error);
      throw error;
    }
  }

  async assignAdmin(orgId: string, data: z.infer<typeof AssignAdminSchema>, claims: RequestClaims) {
    try {
      // Check if organization exists
      const existingOrg = await this.prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!existingOrg) {
        throw new NotFoundException('Organization not found');
      }

      // Check if user exists and belongs to the organization
      const user = await this.prisma.user.findFirst({
        where: {
          id: data.userId,
          orgId: orgId,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found in this organization');
      }

      // Update user role
      const updatedUser = await this.prisma.user.update({
        where: { id: data.userId },
        data: { role: data.role },
      });

      this.logger.log(`Admin assigned: ${updatedUser.id} as ${data.role} for org ${orgId} by ${claims.sub}`);

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        updatedAt: updatedUser.updatedAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error assigning admin:', error);
      throw error;
    }
  }

  async getOrganizationStats(claims: RequestClaims) {
    try {
      const [total, byType, hipaaCompliant, baaSigned] = await Promise.all([
        this.prisma.organization.count(),
        this.prisma.organization.groupBy({
          by: ['type'],
          _count: { type: true },
        }),
        this.prisma.organization.count({
          where: {
            compliance: {
              path: ['hipaaCompliant'],
              equals: true,
            },
          },
        }),
        this.prisma.organization.count({
          where: {
            compliance: {
              path: ['baaSigned'],
              equals: true,
            },
          },
        }),
      ]);

      return {
        total,
        hipaaCompliant,
        baaSigned,
        byType: byType.map((item: any) => ({
          type: item.type,
          count: item._count.type,
        })),
      };

    } catch (error) {
      this.logger.error('Error getting organization stats:', error);
      throw error;
    }
  }

  async getBAAReminders() {
    try {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringBAAs = await this.prisma.organization.findMany({
        where: {
          compliance: {
            path: ['baaExpiresAt'],
            lte: thirtyDaysFromNow.toISOString(),
          },
        },
        select: {
          id: true,
          name: true,
          contactInfo: true,
          compliance: true,
        },
      });

      return expiringBAAs.map((org: any) => ({
        id: org.id,
        name: org.name,
        contactInfo: org.contactInfo,
        baaExpiresAt: org.compliance.baaExpiresAt,
        daysUntilExpiry: Math.ceil(
          (new Date(org.compliance.baaExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));

    } catch (error) {
      this.logger.error('Error getting BAA reminders:', error);
      throw error;
    }
  }
}
