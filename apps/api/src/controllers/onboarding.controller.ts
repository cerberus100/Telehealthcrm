import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { OnboardingService } from '../services/onboarding.service'
import { 
  PhysicianStep1Dto, PhysicianStep2Dto, PhysicianStep3Dto, PhysicianStep4Dto,
  VerifyEmailDto, AdminOnboardingActionDto,
  type PhysicianStep1Input, type PhysicianStep2Input, type PhysicianStep3Input, 
  type PhysicianStep4Input, type VerifyEmailInput, type AdminOnboardingActionInput
} from '../types/onboarding.dto'

@Controller('onboarding/physician')
export class OnboardingPhysicianController {
  constructor(private readonly svc: OnboardingService) {}

  @Post('step1')
  async step1(@Body(new ZodValidationPipe(PhysicianStep1Dto)) body: PhysicianStep1Input) {
    return await this.svc.step1(body)
  }

  @Post('step2')
  async step2(@Body(new ZodValidationPipe(PhysicianStep2Dto)) body: PhysicianStep2Input) {
    return await this.svc.step2(body)
  }

  @Post('step3')
  async step3(@Body(new ZodValidationPipe(PhysicianStep3Dto)) body: PhysicianStep3Input) {
    return await this.svc.step3(body)
  }

  @Post('step4/sign')
  async step4(@Body(new ZodValidationPipe(PhysicianStep4Dto)) body: PhysicianStep4Input) {
    return await this.svc.step4Sign(body)
  }
}

@Controller('auth')
export class VerifyController {
  constructor(private readonly svc: OnboardingService) {}

  @Post('verify-email')
  async verify(@Body(new ZodValidationPipe(VerifyEmailDto)) body: VerifyEmailInput) {
    return await this.svc.verifyEmail(body)
  }
}

@Controller('admin/onboarding/physicians')
@UseGuards(AbacGuard)
export class AdminOnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Get()
  async list() {
    return await this.svc.adminList()
  }

  @Post('action')
  @UseGuards(AbacGuard)
  @Abac({ resource: 'Organization', action: 'write' })
  async action(@Body(new ZodValidationPipe(AdminOnboardingActionDto)) body: AdminOnboardingActionInput) {
    return await this.svc.adminAction(body)
  }
}


