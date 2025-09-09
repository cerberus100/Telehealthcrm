import { Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { SecurityAuditService } from '../services/security-audit.service';
import { HIPAAComplianceService } from '../services/hipaa-compliance.service';
import { SOC2ComplianceService } from '../services/soc2-compliance.service';
import { RequestClaims } from '../types/claims';
import { AbacGuard } from '../abac/abac.guard';
import { Abac } from '../abac/abac.guard';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { z } from 'zod';

const ComplianceQueryDto = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  export: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
});

@Controller('compliance')
@UseGuards(AbacGuard)
export class ComplianceController {
  constructor(
    private readonly securityAuditService: SecurityAuditService,
    private readonly hipaaComplianceService: HIPAAComplianceService,
    private readonly soc2ComplianceService: SOC2ComplianceService,
  ) {}

  @Get('security-audit')
  @Abac({ resource: 'Health', action: 'read' })
  async getSecurityAudit(@Req() req: any) {
    const claims: RequestClaims = req.claims;
    
    // Only allow admins to perform security audits
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for security audit');
    }

    return this.securityAuditService.performSecurityAudit();
  }

  @Get('security-audit/history')
  @Abac({ resource: 'Health', action: 'read' })
  async getSecurityAuditHistory(
    @Query(new ZodValidationPipe(ComplianceQueryDto)) query: z.infer<typeof ComplianceQueryDto>,
    @Req() req: any,
  ) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for security audit history');
    }

    return this.securityAuditService.getAuditHistory(query.limit);
  }

  @Post('security-audit/export')
  @Abac({ resource: 'Health', action: 'read' })
  async exportSecurityAuditReport(
    @Query('reportId') reportId: string,
    @Req() req: any,
  ) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for security audit export');
    }

    return this.securityAuditService.exportAuditReport(reportId);
  }

  @Get('hipaa')
  @Abac({ resource: 'Health', action: 'read' })
  async getHIPAACompliance(@Req() req: any) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for HIPAA compliance review');
    }

    return this.hipaaComplianceService.performHIPAAComplianceReview();
  }

  @Get('hipaa/status')
  @Abac({ resource: 'Health', action: 'read' })
  async getHIPAAComplianceStatus(@Req() req: any) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for HIPAA compliance status');
    }

    return this.hipaaComplianceService.getComplianceStatus();
  }

  @Get('hipaa/history')
  @Abac({ resource: 'Health', action: 'read' })
  async getHIPAAComplianceHistory(
    @Query(new ZodValidationPipe(ComplianceQueryDto)) query: z.infer<typeof ComplianceQueryDto>,
    @Req() req: any,
  ) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for HIPAA compliance history');
    }

    return this.hipaaComplianceService.getComplianceHistory(query.limit);
  }

  @Post('hipaa/export')
  @Abac({ resource: 'Health', action: 'read' })
  async exportHIPAAComplianceReport(
    @Query('reportId') reportId: string,
    @Req() req: any,
  ) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for HIPAA compliance export');
    }

    return this.hipaaComplianceService.exportComplianceReport(reportId);
  }

  @Get('soc2')
  @Abac({ resource: 'Health', action: 'read' })
  async getSOC2Compliance(@Req() req: any) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for SOC 2 compliance assessment');
    }

    return this.soc2ComplianceService.performSOC2ComplianceAssessment();
  }

  @Get('soc2/status')
  @Abac({ resource: 'Health', action: 'read' })
  async getSOC2ComplianceStatus(@Req() req: any) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for SOC 2 compliance status');
    }

    return this.soc2ComplianceService.getComplianceStatus();
  }

  @Get('soc2/history')
  @Abac({ resource: 'Health', action: 'read' })
  async getSOC2ComplianceHistory(
    @Query(new ZodValidationPipe(ComplianceQueryDto)) query: z.infer<typeof ComplianceQueryDto>,
    @Req() req: any,
  ) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for SOC 2 compliance history');
    }

    return this.soc2ComplianceService.getComplianceHistory(query.limit);
  }

  @Post('soc2/export')
  @Abac({ resource: 'Health', action: 'read' })
  async exportSOC2ComplianceReport(
    @Query('reportId') reportId: string,
    @Req() req: any,
  ) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for SOC 2 compliance export');
    }

    return this.soc2ComplianceService.exportComplianceReport(reportId);
  }

  @Get('overview')
  @Abac({ resource: 'Health', action: 'read' })
  async getComplianceOverview(@Req() req: any) {
    const claims: RequestClaims = req.claims;
    
    if (claims.role !== 'ADMIN') {
      throw new Error('Insufficient permissions for compliance overview');
    }

    const [hipaaStatus, soc2Status] = await Promise.all([
      this.hipaaComplianceService.getComplianceStatus(),
      this.soc2ComplianceService.getComplianceStatus(),
    ]);

    return {
      hipaa: {
        overallCompliance: hipaaStatus.overallCompliance,
        lastReview: hipaaStatus.lastReview,
        nextReview: hipaaStatus.nextReview,
        criticalIssues: hipaaStatus.criticalIssues,
      },
      soc2: {
        overallCompliance: soc2Status.overallCompliance,
        lastAssessment: soc2Status.lastAssessment,
        nextAssessment: soc2Status.nextAssessment,
        criticalGaps: soc2Status.criticalGaps,
      },
      summary: {
        overallCompliance: Math.round((hipaaStatus.overallCompliance + soc2Status.overallCompliance) / 2),
        totalCriticalIssues: hipaaStatus.criticalIssues + soc2Status.criticalGaps,
        lastReview: new Date(Math.max(hipaaStatus.lastReview.getTime(), soc2Status.lastAssessment.getTime())),
        nextReview: new Date(Math.min(hipaaStatus.nextReview.getTime(), soc2Status.nextAssessment.getTime())),
      },
    };
  }
}
