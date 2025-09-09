import { SetMetadata } from '@nestjs/common';

export interface AbacRequirement {
  resource: 'Consult' | 'Rx' | 'LabOrder' | 'LabResult' | 'Shipment' | 'Patient' | 'User' | 'Auth' | 'Health' | 'Notification' | 'Organization' | 'Metrics' | 'Compliance';
  action: 'read' | 'write' | 'list' | 'update' | 'logout' | 'create' | 'delete';
}

export const ABAC_KEY = 'abac';
export const Abac = (resource: string, action: string) => SetMetadata(ABAC_KEY, { resource, action });
