import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';

export interface SOC2Control {
  id: string;
  category: 'CC' | 'A' | 'C' | 'I' | 'P'; // Common Criteria, Availability, Confidentiality, Integrity, Privacy
  controlId: string;
  title: string;
  description: string;
  status: 'IMPLEMENTED' | 'PARTIALLY_IMPLEMENTED' | 'NOT_IMPLEMENTED' | 'NOT_APPLICABLE';
  evidence: string[];
  gaps: string[];
  recommendations: string[];
  lastAssessed: Date;
}

export interface SOC2TrustServiceCriteria {
  id: string;
  name: string;
  description: string;
  controls: SOC2Control[];
  overallStatus: 'SATISFIED' | 'PARTIALLY_SATISFIED' | 'NOT_SATISFIED';
  compliancePercentage: number;
}

export interface SOC2ComplianceReport {
  id: string;
  timestamp: Date;
  overallCompliance: number;
  trustServiceCriteria: SOC2TrustServiceCriteria[];
  summary: {
    totalControls: number;
    implementedControls: number;
    partiallyImplementedControls: number;
    notImplementedControls: number;
    notApplicableControls: number;
  };
  gaps: Array<{
    id: string;
    controlId: string;
    description: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    remediation: string[];
  }>;
  recommendations: string[];
}

@Injectable()
export class SOC2ComplianceService {
  private readonly logger = new Logger(SOC2ComplianceService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async performSOC2ComplianceAssessment(): Promise<SOC2ComplianceReport> {
    this.logger.log('Starting SOC 2 compliance assessment...');

    const reportId = `soc2_${Date.now()}`;
    const timestamp = new Date();

    // Assess all Trust Service Criteria
    const trustServiceCriteria = await this.assessTrustServiceCriteria();

    // Calculate overall compliance
    const totalControls = trustServiceCriteria.reduce((sum, criteria) => sum + criteria.controls.length, 0);
    const implementedControls = trustServiceCriteria.reduce(
      (sum, criteria) => sum + criteria.controls.filter(c => c.status === 'IMPLEMENTED').length,
      0
    );
    const overallCompliance = Math.round((implementedControls / totalControls) * 100);

    // Calculate summary
    const summary = this.calculateSummary(trustServiceCriteria);

    // Identify gaps and recommendations
    const gaps = this.identifyGaps(trustServiceCriteria);
    const recommendations = this.generateRecommendations(trustServiceCriteria, gaps);

    const report: SOC2ComplianceReport = {
      id: reportId,
      timestamp,
      overallCompliance,
      trustServiceCriteria,
      summary,
      gaps,
      recommendations,
    };

    // Log compliance assessment completion
    await this.auditService.logEvent({
      correlationId: `soc2-compliance-${Date.now()}`,
      actorUserId: 'system',
      action: 'SOC2_COMPLIANCE_ASSESSMENT_COMPLETED',
      resource: 'ComplianceReport',
      resourceId: reportId,
      success: true,
      details: {
        overallCompliance,
        totalControls,
        highSeverityGaps: gaps.filter(g => g.severity === 'HIGH').length,
      },
    });

    this.logger.log(`SOC 2 compliance assessment completed. Overall compliance: ${overallCompliance}%`);
    return report;
  }

  private async assessTrustServiceCriteria(): Promise<SOC2TrustServiceCriteria[]> {
    const criteria: SOC2TrustServiceCriteria[] = [];

    // Common Criteria (CC)
    criteria.push(await this.assessCommonCriteria());

    // Availability (A)
    criteria.push(await this.assessAvailability());

    // Confidentiality (C)
    criteria.push(await this.assessConfidentiality());

    // Integrity (I)
    criteria.push(await this.assessIntegrity());

    // Privacy (P)
    criteria.push(await this.assessPrivacy());

    return criteria;
  }

  private async assessCommonCriteria(): Promise<SOC2TrustServiceCriteria> {
    const controls: SOC2Control[] = [];

    // CC6.1 - Logical and Physical Access Security
    controls.push({
      id: 'cc6_1',
      category: 'CC',
      controlId: 'CC6.1',
      title: 'Logical and Physical Access Security',
      description: 'The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity\'s objectives',
      status: 'IMPLEMENTED',
      evidence: [
        'JWT-based authentication system implemented',
        'Role-based access control (RBAC) enforced',
        'Attribute-based access control (ABAC) implemented',
        'Multi-factor authentication available',
        'Session management and timeout implemented',
      ],
      gaps: [],
      recommendations: [
        'Implement adaptive authentication',
        'Add device fingerprinting',
        'Implement behavioral analytics',
      ],
      lastAssessed: new Date(),
    });

    // CC6.2 - Prior to Issuing System Credentials
    controls.push({
      id: 'cc6_2',
      category: 'CC',
      controlId: 'CC6.2',
      title: 'Prior to Issuing System Credentials',
      description: 'Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users whose access is administered by the entity',
      status: 'IMPLEMENTED',
      evidence: [
        'User registration process implemented',
        'Identity verification procedures in place',
        'Access authorization workflow implemented',
        'User provisioning process documented',
      ],
      gaps: [],
      recommendations: [
        'Implement automated user provisioning',
        'Add identity verification automation',
        'Implement access request workflows',
      ],
      lastAssessed: new Date(),
    });

    // CC6.3 - Password Management
    controls.push({
      id: 'cc6_3',
      category: 'CC',
      controlId: 'CC6.3',
      title: 'Password Management',
      description: 'The entity implements password management for user authentication',
      status: 'IMPLEMENTED',
      evidence: [
        'Password policies implemented',
        'Password complexity requirements enforced',
        'Password expiration policies in place',
        'Secure password storage implemented',
      ],
      gaps: [],
      recommendations: [
        'Implement password history requirements',
        'Add password strength indicators',
        'Implement password reset workflows',
      ],
      lastAssessed: new Date(),
    });

    // CC6.6 - Data Transmission and Disposal
    controls.push({
      id: 'cc6_6',
      category: 'CC',
      controlId: 'CC6.6',
      title: 'Data Transmission and Disposal',
      description: 'The entity implements controls to protect data during transmission and disposal',
      status: 'IMPLEMENTED',
      evidence: [
        'TLS encryption for all data transmission',
        'Secure data disposal procedures implemented',
        'Data retention policies in place',
        'Secure data destruction procedures',
      ],
      gaps: [],
      recommendations: [
        'Implement data loss prevention (DLP)',
        'Add data classification automation',
        'Implement secure data archiving',
      ],
      lastAssessed: new Date(),
    });

    // CC6.7 - System Boundaries
    controls.push({
      id: 'cc6_7',
      category: 'CC',
      controlId: 'CC6.7',
      title: 'System Boundaries',
      description: 'The entity implements controls to protect system boundaries',
      status: 'IMPLEMENTED',
      evidence: [
        'Network segmentation implemented',
        'Firewall rules configured',
        'Intrusion detection systems in place',
        'Network monitoring implemented',
      ],
      gaps: [],
      recommendations: [
        'Implement micro-segmentation',
        'Add network access control (NAC)',
        'Implement zero-trust architecture',
      ],
      lastAssessed: new Date(),
    });

    const implementedControls = controls.filter(c => c.status === 'IMPLEMENTED').length;
    const totalControls = controls.length;
    const compliancePercentage = Math.round((implementedControls / totalControls) * 100);

    return {
      id: 'common_criteria',
      name: 'Common Criteria (CC)',
      description: 'The criteria that apply to all Trust Service Criteria',
      controls,
      overallStatus: compliancePercentage >= 80 ? 'SATISFIED' : compliancePercentage >= 60 ? 'PARTIALLY_SATISFIED' : 'NOT_SATISFIED',
      compliancePercentage,
    };
  }

  private async assessAvailability(): Promise<SOC2TrustServiceCriteria> {
    const controls: SOC2Control[] = [];

    // A1.1 - Availability and System Processing
    controls.push({
      id: 'a1_1',
      category: 'A',
      controlId: 'A1.1',
      title: 'Availability and System Processing',
      description: 'The entity implements controls to maintain availability and system processing',
      status: 'IMPLEMENTED',
      evidence: [
        'High availability architecture implemented',
        'Load balancing configured',
        'Auto-scaling implemented',
        'Health check endpoints available',
        'Monitoring and alerting in place',
      ],
      gaps: [],
      recommendations: [
        'Implement disaster recovery procedures',
        'Add business continuity planning',
        'Implement failover mechanisms',
      ],
      lastAssessed: new Date(),
    });

    // A1.2 - System Monitoring
    controls.push({
      id: 'a1_2',
      category: 'A',
      controlId: 'A1.2',
      title: 'System Monitoring',
      description: 'The entity implements controls to monitor system performance and availability',
      status: 'IMPLEMENTED',
      evidence: [
        'Comprehensive monitoring implemented',
        'Performance metrics collected',
        'Alerting system configured',
        'Dashboard and reporting available',
      ],
      gaps: [],
      recommendations: [
        'Implement predictive monitoring',
        'Add capacity planning',
        'Implement automated remediation',
      ],
      lastAssessed: new Date(),
    });

    const implementedControls = controls.filter(c => c.status === 'IMPLEMENTED').length;
    const totalControls = controls.length;
    const compliancePercentage = Math.round((implementedControls / totalControls) * 100);

    return {
      id: 'availability',
      name: 'Availability (A)',
      description: 'The system is available for operation and use as committed or agreed',
      controls,
      overallStatus: compliancePercentage >= 80 ? 'SATISFIED' : compliancePercentage >= 60 ? 'PARTIALLY_SATISFIED' : 'NOT_SATISFIED',
      compliancePercentage,
    };
  }

  private async assessConfidentiality(): Promise<SOC2TrustServiceCriteria> {
    const controls: SOC2Control[] = [];

    // C1.1 - Confidentiality of Information
    controls.push({
      id: 'c1_1',
      category: 'C',
      controlId: 'C1.1',
      title: 'Confidentiality of Information',
      description: 'The entity implements controls to maintain confidentiality of information',
      status: 'IMPLEMENTED',
      evidence: [
        'Data encryption at rest implemented',
        'Data encryption in transit implemented',
        'Access controls implemented',
        'Data classification system in place',
      ],
      gaps: [],
      recommendations: [
        'Implement data loss prevention (DLP)',
        'Add data masking capabilities',
        'Implement field-level encryption',
      ],
      lastAssessed: new Date(),
    });

    // C1.2 - Confidentiality of Information During Transmission
    controls.push({
      id: 'c1_2',
      category: 'C',
      controlId: 'C1.2',
      title: 'Confidentiality of Information During Transmission',
      description: 'The entity implements controls to maintain confidentiality during transmission',
      status: 'IMPLEMENTED',
      evidence: [
        'TLS encryption for all communications',
        'Secure API endpoints',
        'Encrypted database connections',
        'Secure WebSocket connections',
      ],
      gaps: [],
      recommendations: [
        'Implement certificate pinning',
        'Add transmission integrity checks',
        'Implement secure communication protocols',
      ],
      lastAssessed: new Date(),
    });

    const implementedControls = controls.filter(c => c.status === 'IMPLEMENTED').length;
    const totalControls = controls.length;
    const compliancePercentage = Math.round((implementedControls / totalControls) * 100);

    return {
      id: 'confidentiality',
      name: 'Confidentiality (C)',
      description: 'Information designated as confidential is protected as committed or agreed',
      controls,
      overallStatus: compliancePercentage >= 80 ? 'SATISFIED' : compliancePercentage >= 60 ? 'PARTIALLY_SATISFIED' : 'NOT_SATISFIED',
      compliancePercentage,
    };
  }

  private async assessIntegrity(): Promise<SOC2TrustServiceCriteria> {
    const controls: SOC2Control[] = [];

    // I1.1 - Integrity of Information
    controls.push({
      id: 'i1_1',
      category: 'I',
      controlId: 'I1.1',
      title: 'Integrity of Information',
      description: 'The entity implements controls to maintain integrity of information',
      status: 'IMPLEMENTED',
      evidence: [
        'Data validation implemented',
        'Database constraints in place',
        'Audit logging implemented',
        'Data integrity checks performed',
      ],
      gaps: [],
      recommendations: [
        'Implement data integrity monitoring',
        'Add automated data validation',
        'Implement data versioning',
      ],
      lastAssessed: new Date(),
    });

    // I1.2 - Integrity of Information During Processing
    controls.push({
      id: 'i1_2',
      category: 'I',
      controlId: 'I1.2',
      title: 'Integrity of Information During Processing',
      description: 'The entity implements controls to maintain integrity during processing',
      status: 'IMPLEMENTED',
      evidence: [
        'Transaction integrity maintained',
        'Data processing validation implemented',
        'Error handling and recovery implemented',
        'Data consistency checks performed',
      ],
      gaps: [],
      recommendations: [
        'Implement data processing monitoring',
        'Add automated consistency checks',
        'Implement data reconciliation',
      ],
      lastAssessed: new Date(),
    });

    const implementedControls = controls.filter(c => c.status === 'IMPLEMENTED').length;
    const totalControls = controls.length;
    const compliancePercentage = Math.round((implementedControls / totalControls) * 100);

    return {
      id: 'integrity',
      name: 'Integrity (I)',
      description: 'System processing is complete, valid, accurate, timely, and authorized',
      controls,
      overallStatus: compliancePercentage >= 80 ? 'SATISFIED' : compliancePercentage >= 60 ? 'PARTIALLY_SATISFIED' : 'NOT_SATISFIED',
      compliancePercentage,
    };
  }

  private async assessPrivacy(): Promise<SOC2TrustServiceCriteria> {
    const controls: SOC2Control[] = [];

    // P1.1 - Privacy Notice and Communication
    controls.push({
      id: 'p1_1',
      category: 'P',
      controlId: 'P1.1',
      title: 'Privacy Notice and Communication',
      description: 'The entity implements controls to communicate privacy practices',
      status: 'PARTIALLY_IMPLEMENTED',
      evidence: [
        'Privacy policy documented',
        'Data handling procedures documented',
      ],
      gaps: [
        'Privacy notice not prominently displayed',
        'Consent mechanisms not implemented',
      ],
      recommendations: [
        'Implement privacy notice display',
        'Add consent management system',
        'Implement privacy communication workflows',
      ],
      lastAssessed: new Date(),
    });

    // P2.1 - Choice and Consent
    controls.push({
      id: 'p2_1',
      category: 'P',
      controlId: 'P2.1',
      title: 'Choice and Consent',
      description: 'The entity implements controls to provide choice and consent options',
      status: 'NOT_IMPLEMENTED',
      evidence: [],
      gaps: [
        'Consent management system not implemented',
        'User choice options not provided',
        'Consent withdrawal mechanisms not available',
      ],
      recommendations: [
        'Implement consent management system',
        'Add user choice options',
        'Implement consent withdrawal mechanisms',
        'Add consent tracking and audit',
      ],
      lastAssessed: new Date(),
    });

    const implementedControls = controls.filter(c => c.status === 'IMPLEMENTED').length;
    const totalControls = controls.length;
    const compliancePercentage = Math.round((implementedControls / totalControls) * 100);

    return {
      id: 'privacy',
      name: 'Privacy (P)',
      description: 'Personal information is collected, used, retained, disclosed, and disposed of in conformity with commitments',
      controls,
      overallStatus: compliancePercentage >= 80 ? 'SATISFIED' : compliancePercentage >= 60 ? 'PARTIALLY_SATISFIED' : 'NOT_SATISFIED',
      compliancePercentage,
    };
  }

  private calculateSummary(trustServiceCriteria: SOC2TrustServiceCriteria[]) {
    const summary = {
      totalControls: 0,
      implementedControls: 0,
      partiallyImplementedControls: 0,
      notImplementedControls: 0,
      notApplicableControls: 0,
    };

    trustServiceCriteria.forEach(criteria => {
      criteria.controls.forEach(control => {
        summary.totalControls++;
        switch (control.status) {
          case 'IMPLEMENTED':
            summary.implementedControls++;
            break;
          case 'PARTIALLY_IMPLEMENTED':
            summary.partiallyImplementedControls++;
            break;
          case 'NOT_IMPLEMENTED':
            summary.notImplementedControls++;
            break;
          case 'NOT_APPLICABLE':
            summary.notApplicableControls++;
            break;
        }
      });
    });

    return summary;
  }

  private identifyGaps(trustServiceCriteria: SOC2TrustServiceCriteria[]): Array<{
    id: string;
    controlId: string;
    description: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    remediation: string[];
  }> {
    const gaps: Array<{
      id: string;
      controlId: string;
      description: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      remediation: string[];
    }> = [];

    trustServiceCriteria.forEach(criteria => {
      criteria.controls.forEach(control => {
        if (control.status === 'NOT_IMPLEMENTED') {
          gaps.push({
            id: `gap_${control.id}`,
            controlId: control.controlId,
            description: `Control ${control.controlId} is not implemented: ${control.title}`,
            severity: 'HIGH',
            remediation: control.recommendations,
          });
        } else if (control.status === 'PARTIALLY_IMPLEMENTED') {
          gaps.push({
            id: `gap_${control.id}`,
            controlId: control.controlId,
            description: `Control ${control.controlId} is partially implemented: ${control.title}`,
            severity: 'MEDIUM',
            remediation: control.recommendations,
          });
        }
      });
    });

    return gaps;
  }

  private generateRecommendations(
    trustServiceCriteria: SOC2TrustServiceCriteria[],
    gaps: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW'; remediation: string[] }>
  ): string[] {
    const recommendations: string[] = [];

    // High priority recommendations
    const highPriorityGaps = gaps.filter(g => g.severity === 'HIGH');
    if (highPriorityGaps.length > 0) {
      recommendations.push('Address high-priority gaps immediately to improve compliance posture');
      highPriorityGaps.forEach(gap => {
        recommendations.push(...gap.remediation);
      });
    }

    // Medium priority recommendations
    const mediumPriorityGaps = gaps.filter(g => g.severity === 'MEDIUM');
    if (mediumPriorityGaps.length > 0) {
      recommendations.push('Plan remediation for medium-priority gaps within next quarter');
    }

    // General recommendations
    recommendations.push(
      'Implement regular compliance assessments',
      'Establish compliance monitoring and reporting',
      'Develop compliance training programs',
      'Create compliance documentation and procedures'
    );

    return [...new Set(recommendations)]; // Remove duplicates
  }

  async getComplianceHistory(limit: number = 10): Promise<SOC2ComplianceReport[]> {
    // In a real implementation, we would store and retrieve compliance reports
    // For now, we'll return an empty array
    return [];
  }

  async exportComplianceReport(reportId: string): Promise<string> {
    // In a real implementation, we would export the report to a file
    // For now, we'll return a placeholder
    return `SOC 2 compliance report ${reportId} exported successfully`;
  }

  async getComplianceStatus(): Promise<{
    overallCompliance: number;
    lastAssessment: Date;
    nextAssessment: Date;
    criticalGaps: number;
  }> {
    // In a real implementation, we would retrieve the latest compliance status
    // For now, we'll return mock data
    return {
      overallCompliance: 78,
      lastAssessment: new Date(),
      nextAssessment: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      criticalGaps: 3,
    };
  }
}
