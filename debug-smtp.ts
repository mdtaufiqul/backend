import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DynamicMailerService } from './src/services/dynamic-mailer.service';
import { PrismaService } from './src/prisma/prisma.service';

async function testSmtp() {
    console.log('🧪 Testing SMTP Configuration from Database...\n');

    const app = await NestFactory.createApplicationContext(AppModule);
    const mailerService = app.get(DynamicMailerService);
    const prisma = app.get(PrismaService);

    // Get the first doctor's ID (which has the config)
    const config = await prisma.doctorSmtpConfig.findFirst();

    if (!config) {
        console.error('❌ No SMTP config found!');
        await app.close();
        process.exit(1);
    }

    console.log(`📧 User: ${config.user}`);
    console.log(`🔌 Host: ${config.host}:${config.port}`);
    console.log('----------------------------------------');

    try {
        console.log('🔄 Verifying connection...');
        const verifyResult = await mailerService.verifyConnection(config.userId);

        if (verifyResult.success) {
            console.log('✅ Connection Successful!');

            console.log('📤 Attempting to send test email...');
            await mailerService.sendMail(config.userId, {
                to: config.user, // Send to self
                subject: 'MediFlow SMTP Test',
                html: 'If you see this, SMTP is working correctly! 🎉'
            });
            console.log('✅ Test email sent successfully!');
        } else {
            console.error('❌ Verification Failed:', verifyResult.message);
            if (verifyResult.message?.includes('535') || verifyResult.message?.includes('Username and Password not accepted')) {
                console.log('\n💡 HINT: You might be using your Google Account password.');
                console.log('   You MUST use an "App Password" for Gmail.');
                console.log('   Go to: https://myaccount.google.com/apppasswords');
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await app.close();
}

testSmtp();
