console.log('Testing minimal NestJS with Fastify...');

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Module } from '@nestjs/common';

@Module({
  providers: [],
  controllers: [],
})
class TestModule {}

async function test() {
  try {
    console.log('Creating minimal Fastify app...');
    const app = await NestFactory.create<NestFastifyApplication>(
      TestModule,
      new FastifyAdapter()
    );
    console.log('Minimal Fastify app created successfully!');
    await app.close();
    console.log('Test passed!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

test();
