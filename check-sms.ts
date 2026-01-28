
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { TwilioService } from './src/services/twilio.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const twilioService = app.get(TwilioService);
  const logger = new Logger('CheckSMS');

  const to = process.argv[2];
  const from = process.env.TWILIO_PHONE_NUMBER || '';

  if (!to || !from) {
    logger.error('Please provide a destination phone number as an argument and ensure TWILIO_PHONE_NUMBER is set.');
    await app.close();
    return;
  }

  console.log(`Sending SMS from ${from} to ${to}...`);

  try {
    const result = await twilioService.sendSms(from, to, 'Test message from Mediflow System Default', 'some-user-id');
    console.log('SMS sent successfully!');
    console.log('SID:', result.sid);
  } catch (error) {
    console.error('Failed to send SMS:', error.message);
  }

  await app.close();
}

bootstrap();
