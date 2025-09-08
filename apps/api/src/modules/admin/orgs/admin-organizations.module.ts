import { Module } from '@nestjs/common';
import { AdminOrganizationsController } from './admin-organizations.controller';
import { AdminOrganizationsService } from './admin-organizations.service';

@Module({
  controllers: [AdminOrganizationsController],
  providers: [AdminOrganizationsService],
  exports: [AdminOrganizationsService],
})
export class AdminOrganizationsModule {}
