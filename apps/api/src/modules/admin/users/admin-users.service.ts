import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { RequestClaims } from '../../../types/claims';
import { z } from 'zod';
import { CognitoService } from '../../../auth/cognito.service';

// User management schemas
const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['ADMIN', 'DOCTOR', 'LAB_TECH', 'PHARMACIST', 'MARKETER', 'SUPPORT']),
  purposeOfUse: z.enum(['TREATMENT', 'PAYMENT', 'HEALTHCARE_OPERATIONS', 'MARKETING']).optional(),
  phoneNumber: z.string().optional(),
  department: z.string().optional(),
  isActive: z.boolean().default(true),
});

const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'DOCTOR', 'LAB_TECH', 'PHARMACIST', 'MARKETER', 'SUPPORT']).optional(),
  purposeOfUse: z.enum(['TREATMENT', 'PAYMENT', 'HEALTHCARE_OPERATIONS', 'MARKETING']).optional(),
  phoneNumber: z.string().optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional(),
});

const UsersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  role: z.enum(['ADMIN', 'DOCTOR', 'LAB_TECH', 'PHARMACIST', 'MARKETER', 'SUPPORT']).optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

const ChangePasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  temporaryPassword: z.boolean().default(false),
});

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cognitoService: CognitoService,
  ) {}

  async getUsers(query: z.infer<typeof UsersQuerySchema>, claims: RequestClaims) {
    try {
      const where: any = {
        orgId: claims.orgId,
      };

      // Add role filter
      if (query.role) {
        where.role = query.role;
      }

      // Add active status filter
      if (query.isActive !== undefined) {
        where.isActive = query.isActive;
      }

      // Add search filter
      if (query.search) {
        where.OR = [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const take = query.limit || 50;

      const users = await this.prisma.user.findMany({
        where,
        take: take + 1,
        skip: query.cursor ? 1 : 0,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          purposeOfUse: true,
          phoneNumber: true,
          department: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const hasNext = users.length > take;
      const items = users.slice(0, take);

      return {
        items: items.map((user: any) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          purposeOfUse: user.purposeOfUse,
          phoneNumber: user.phoneNumber,
          department: user.department,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt?.toISOString(),
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        })),
        next_cursor: hasNext && items[items.length - 1] ? items[items.length - 1]?.id : null,
      };

    } catch (error) {
      this.logger.error('Error getting users:', error);
      throw error;
    }
  }

  async getUserById(userId: string, claims: RequestClaims) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          orgId: claims.orgId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          purposeOfUse: true,
          phoneNumber: true,
          department: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        purposeOfUse: user.purposeOfUse,
        phoneNumber: user.phoneNumber,
        department: user.department,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt?.toISOString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  async createUser(data: z.infer<typeof CreateUserSchema>, claims: RequestClaims) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: data.email,
          orgId: claims.orgId,
        },
      });

      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      // Create user in Cognito (for production)
      let cognitoUserId: string;
      if (process.env.NODE_ENV === 'production') {
        cognitoUserId = await this.cognitoService.createUser({
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          orgId: claims.orgId,
        });
      } else {
        // Mock Cognito user ID for development
        cognitoUserId = `mock_cognito_${Date.now()}`;
      }

      // Create user in database
      const user = await this.prisma.user.create({
        data: {
          id: cognitoUserId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          purposeOfUse: data.purposeOfUse || 'TREATMENT',
          phoneNumber: data.phoneNumber,
          department: data.department,
          isActive: data.isActive,
          orgId: claims.orgId,
        },
      });

      this.logger.log(`User created: ${user.id} (${user.email}) by ${claims.sub}`);

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        purposeOfUse: user.purposeOfUse,
        phoneNumber: user.phoneNumber,
        department: user.department,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, data: z.infer<typeof UpdateUserSchema>, claims: RequestClaims) {
    try {
      // Check if user exists and belongs to the same organization
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: userId,
          orgId: claims.orgId,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Update user in Cognito (for production)
      if (process.env.NODE_ENV === 'production') {
        await this.cognitoService.updateUser(userId, {
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          purposeOfUse: data.purposeOfUse,
          phoneNumber: data.phoneNumber,
          department: data.department,
          isActive: data.isActive,
        });
      }

      // Update user in database
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          purposeOfUse: data.purposeOfUse,
          phoneNumber: data.phoneNumber,
          department: data.department,
          isActive: data.isActive,
        },
      });

      this.logger.log(`User updated: ${user.id} (${user.email}) by ${claims.sub}`);

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        purposeOfUse: user.purposeOfUse,
        phoneNumber: user.phoneNumber,
        department: user.department,
        isActive: user.isActive,
        updatedAt: user.updatedAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error updating user:', error);
      throw error;
    }
  }

  async deactivateUser(userId: string, claims: RequestClaims) {
    try {
      // Check if user exists and belongs to the same organization
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: userId,
          orgId: claims.orgId,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Prevent deactivating self
      if (userId === claims.sub) {
        throw new BadRequestException('Cannot deactivate your own account');
      }

      // Deactivate user in Cognito (for production)
      if (process.env.NODE_ENV === 'production') {
        await this.cognitoService.deactivateUser(userId);
      }

      // Update user in database
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      this.logger.log(`User deactivated: ${user.id} (${user.email}) by ${claims.sub}`);

      return {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        updatedAt: user.updatedAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error deactivating user:', error);
      throw error;
    }
  }

  async activateUser(userId: string, claims: RequestClaims) {
    try {
      // Check if user exists and belongs to the same organization
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: userId,
          orgId: claims.orgId,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Activate user in Cognito (for production)
      if (process.env.NODE_ENV === 'production') {
        await this.cognitoService.activateUser(userId);
      }

      // Update user in database
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
      });

      this.logger.log(`User activated: ${user.id} (${user.email}) by ${claims.sub}`);

      return {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        updatedAt: user.updatedAt.toISOString(),
      };

    } catch (error) {
      this.logger.error('Error activating user:', error);
      throw error;
    }
  }

  async changeUserPassword(userId: string, data: z.infer<typeof ChangePasswordSchema>, claims: RequestClaims) {
    try {
      // Check if user exists and belongs to the same organization
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: userId,
          orgId: claims.orgId,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Change password in Cognito (for production)
      if (process.env.NODE_ENV === 'production') {
        await this.cognitoService.changeUserPassword(userId, data.newPassword, data.temporaryPassword);
      }

      this.logger.log(`Password changed for user: ${userId} by ${claims.sub}`);

      return {
        message: 'Password changed successfully',
        temporaryPassword: data.temporaryPassword,
      };

    } catch (error) {
      this.logger.error('Error changing user password:', error);
      throw error;
    }
  }

  async getUserStats(claims: RequestClaims) {
    try {
      const where = { orgId: claims.orgId };

      const [total, active, byRole] = await Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.count({ where: { ...where, isActive: true } }),
        this.prisma.user.groupBy({
          by: ['role'],
          where,
          _count: { role: true },
        }),
      ]);

      return {
        total,
        active,
        inactive: total - active,
        byRole: byRole.map((item: any) => ({
          role: item.role,
          count: item._count.role,
        })),
      };

    } catch (error) {
      this.logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  async resendInvitation(userId: string, claims: RequestClaims) {
    try {
      // Check if user exists and belongs to the same organization
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: userId,
          orgId: claims.orgId,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Resend invitation in Cognito (for production)
      if (process.env.NODE_ENV === 'production') {
        await this.cognitoService.resendInvitation(userId);
      }

      this.logger.log(`Invitation resent for user: ${userId} by ${claims.sub}`);

      return {
        message: 'Invitation resent successfully',
        email: existingUser.email,
      };

    } catch (error) {
      this.logger.error('Error resending invitation:', error);
      throw error;
    }
  }
}
