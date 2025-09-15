import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common'
import { ZodSchema } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    console.log('ZodValidationPipe.transform called with:', { value, metadata });
    try {
      const parsedValue = this.schema.parse(value)
      console.log('ZodValidationPipe validation successful:', parsedValue);
      return parsedValue
    } catch (error) {
      console.error('ZodValidationPipe validation failed:', error);
      const zodError = error as any
      throw new BadRequestException({
        message: 'Validation failed',
        details: zodError.errors,
      })
    }
  }
}
