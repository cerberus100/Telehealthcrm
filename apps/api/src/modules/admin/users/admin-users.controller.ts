import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Patch, 
  Delete, 
  Query, 
  Body, 
  Param, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { RequestClaims } from '../../../types/claims';
import { AbacGuard } from '../../../abac/abac.guard';
import { Abac } from '../../../abac/abac.guard';
import { ZodValidationPipe } from '../../../pipes/zod-validation.pipe';
import { z } from 'zod';

// DTOs
const CreateUserDto = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['ADMIN', 'DOCTOR', 'LAB_TECH', 'PHARMACIST', 'MARKETER', 'SUPPORT']),
  purposeOfUse: z.enum(['TREATMENT', 'PAYMENT', 'HEALTHCARE_OPERATIONS', 'MARKETING']).optional(),
  phoneNumber: z.string().optional(),
  department: z.string().optional(),
  isActive: z.boolean().default(true),
});

const UpdateUserDto = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'DOCTOR', 'LAB_TECH', 'PHARMACIST', 'MARKETER', 'SUPPORT']).optional(),
  purposeOfUse: z.enum(['TREATMENT', 'PAYMENT', 'HEALTHCARE_OPERATIONS', 'MARKETING']).optional(),
  phoneNumber: z.string().optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional(),
});

const UsersQueryDto = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  role: z.enum(['ADMIN', 'DOCTOR', 'LAB_TECH', 'PHARMACIST', 'MARKETER', 'SUPPORT']).optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

const ChangePasswordDto = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  temporaryPassword: z.boolean().default(false),
});

@Controller('admin/users')
@UseGuards(AbacGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @Abac({ resource: 'User', action: 'read' })
  async getUsers(
    @Query(new ZodValidationPipe(UsersQueryDto)) query: z.infer<typeof UsersQueryDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims;
    return this.adminUsersService.getUsers(query, claims);
  }

  @Get('stats')
  @Abac({ resource: 'User', action: 'read' })
  async getUserStats(@Req() req: any) {
    const claims: RequestClaims = req.claims;
    return this.adminUsersService.getUserStats(claims);
  }

  @Get(':id')
  @Abac({ resource: 'User', action: 'read' })
  async getUserById(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims;
    return this.adminUsersService.getUserById(id, claims);
  }

  @Post()
  @Abac({ resource: 'User', action: 'write' })
  async createUser(
    @Body(new ZodValidationPipe(CreateUserDto)) body: z.infer<typeof CreateUserDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims;
    return this.adminUsersService.createUser(body, claims);
  }

  @Put(':id')
  @Abac({ resource: 'User', action: 'update' })
  async updateUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserDto)) body: z.infer<typeof UpdateUserDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims;
    return this.adminUsersService.updateUser(id, body, claims);
  }

  @Patch(':id/activate')
  @Abac({ resource: 'User', action: 'update' })
  async activateUser(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims;
    return this.adminUsersService.activateUser(id, claims);
  }

  @Patch(':id/deactivate')
  @Abac({ resource: 'User', action: 'update' })
  async deactivateUser(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims;
    return this.adminUsersService.deactivateUser(id, claims);
  }

  @Patch(':id/password')
  @Abac({ resource: 'User', action: 'update' })
  async changeUserPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangePasswordDto)) body: z.infer<typeof ChangePasswordDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims;
    return this.adminUsersService.changeUserPassword(id, body, claims);
  }

  @Post(':id/resend-invitation')
  @Abac({ resource: 'User', action: 'update' })
  async resendInvitation(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims;
    return this.adminUsersService.resendInvitation(id, claims);
  }
}
