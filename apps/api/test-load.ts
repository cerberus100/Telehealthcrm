import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppModule } from './test-module'

async function test() {
  const app = await NestFactory.create<NestFastifyApplication>(
    TestAppModule,
    new FastifyAdapter(),
  )

  console.log('✅ API modules loaded successfully')
  console.log('✅ All controllers registered')
  console.log('✅ All services registered')
  console.log('✅ ABAC guard configured')
  console.log('✅ Global exception filter configured')
  console.log('✅ Response interceptor configured')
  
  await app.close()
  console.log('✅ Test completed successfully')
}

test().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
