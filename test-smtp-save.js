const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Mock Encryption Service
const encryptionService = {
    encrypt: (text) => {
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync('secret', 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return { iv: iv.toString('hex'), content: encrypted.toString('hex') };
    }
};

async function main() {
    console.log('--- FINDING USER ---');
    const user = await prisma.user.findFirst();
    if (!user) {
        console.log('No user found!');
        return;
    }
    console.log(`Found user: ${user.email} (${user.id})`);

    console.log('--- SIMULATING SAVE ---');
    const body = {
        host: 'smtp.gmail.com',
        port: '587',
        user: 'test@gmail.com',
        password: 'password123',
        senderName: 'Test Doctor'
    };

    try {
        const { iv, content } = encryptionService.encrypt(body.password);

        const result = await prisma.doctorSmtpConfig.upsert({
            where: { userId: user.id },
            update: {
                host: body.host,
                port: parseInt(body.port),
                user: body.user,
                passwordEncrypted: content,
                iv,
                senderName: body.senderName,
                secure: parseInt(body.port) === 465
            },
            create: {
                userId: user.id,
                host: body.host,
                port: parseInt(body.port),
                user: body.user,
                passwordEncrypted: content,
                iv,
                senderName: body.senderName,
                secure: parseInt(body.port) === 465
            }
        });
        console.log('Save SUCCESS:', result);

        console.log('--- VERIFYING ---');
        const verify = await prisma.doctorSmtpConfig.findUnique({ where: { userId: user.id } });
        console.log('Verification DB Read:', verify);

    } catch (error) {
        console.error('Save FAILED:', error);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
