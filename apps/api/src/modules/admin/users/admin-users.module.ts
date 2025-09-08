import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { CognitoService } from '../../../auth/cognito.service';

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService, CognitoService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
