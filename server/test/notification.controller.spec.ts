import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('NotificationController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/notifications (POST)', async () => {
    const response = await request(app.getHttpServer())
      .post('/notifications')
      .send({ type: 'email', message: 'E2E Test' });

    expect(response.status).toBe(201);
  });

  afterAll(async () => {
    await app.close();
  });
});
