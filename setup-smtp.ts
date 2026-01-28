import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Encryption helper (matches EncryptionService)
function encrypt(text: string): { encrypted: string; iv: string } {
    const algorithm = 'aes-256-gcm';
    // Derive key exactly like EncryptionService
    const keyString = process.env.ENCRYPTION_KEY;
    const key = keyString
        ? crypto.createHash('sha256').update(keyString).digest()
        : crypto.createHash('sha256').update('fallback-insecure-key').digest();

    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
        encrypted: encrypted + ':' + authTag, // Append auth tag for GCM
        iv: iv.toString('hex')
    };
}

async function setupSMTPConfig() {
    console.log('🔧 Setting up SMTP Configuration...\n');

    // Get the first doctor/user
    const doctor = await prisma.user.findFirst({
        where: { role: 'doctor' }
    });

    if (!doctor) {
        console.log('❌ No doctor found! Please create a user first.');
        return;
    }

    console.log(`📧 Configuring SMTP for: ${doctor.name} (${doctor.email})`);

    // Check if config already exists
    const existingConfig = await prisma.doctorSmtpConfig.findUnique({
        where: { userId: doctor.id }
    });

    if (existingConfig) {
        console.log('⚠️  SMTP config already exists for this doctor.');
        console.log('   Host:', existingConfig.host);
        console.log('   User:', existingConfig.user);
        console.log('\nTo update, delete the existing config first or modify this script.\n');
        return;
    }

    // SMTP Configuration Options
    console.log('\n📝 Choose your email provider:\n');
    console.log('1. Gmail (smtp.gmail.com)');
    console.log('2. Outlook/Office365 (smtp-mail.outlook.com)');
    console.log('3. SendGrid (smtp.sendgrid.net)');
    console.log('4. Mailgun (smtp.mailgun.org)');
    console.log('5. Custom SMTP');
    console.log('\n💡 For testing, you can use Gmail with an App Password');
    console.log('   (https://support.google.com/accounts/answer/185833)\n');

    // For automation, let's use environment variables or defaults
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER || doctor.email;
    const smtpPassword = process.env.SMTP_PASSWORD || '';
    const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
    const senderName = process.env.SMTP_SENDER_NAME || doctor.name;

    if (!smtpPassword) {
        console.log('❌ SMTP_PASSWORD not set in environment variables!\n');
        console.log('Please set the following in your .env file:\n');
        console.log('SMTP_HOST=smtp.gmail.com');
        console.log('SMTP_PORT=587');
        console.log('SMTP_USER=your-email@gmail.com');
        console.log('SMTP_PASSWORD=your-app-password');
        console.log('SMTP_SECURE=false');
        console.log('SMTP_SENDER_NAME=Your Clinic Name\n');
        console.log('For Gmail: Use an App Password, not your regular password');
        console.log('Generate one at: https://myaccount.google.com/apppasswords\n');
        return;
    }

    // Encrypt the password
    const { encrypted, iv } = encrypt(smtpPassword);

    // Create SMTP config
    const config = await prisma.doctorSmtpConfig.create({
        data: {
            userId: doctor.id,
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            user: smtpUser,
            passwordEncrypted: encrypted,
            iv: iv,
            senderName: senderName
        }
    });

    console.log('✅ SMTP Configuration created successfully!\n');
    console.log('📧 Email Settings:');
    console.log('   Host:', config.host);
    console.log('   Port:', config.port);
    console.log('   Secure:', config.secure);
    console.log('   User:', config.user);
    console.log('   Sender Name:', config.senderName);
    console.log('\n✨ Emails will now be sent from:', `"${config.senderName}" <${config.user}>`);
    console.log('\n🧪 Test by creating a new appointment!');
}

setupSMTPConfig()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
