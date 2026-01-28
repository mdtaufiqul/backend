const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({ where: { email: 'learnwithtahidul@gmail.com' } });
    if (!user) {
        console.log('User learnwithtahidul@gmail.com NOT FOUND');
        return;
    }
    console.log(`User ID: ${user.id}`);

    const smtp = await prisma.doctorSmtpConfig.findUnique({ where: { userId: user.id } });
    if (smtp) {
        console.log('SMTP Config FOUND:');
        console.log({
            host: smtp.host,
            port: smtp.port,
            user: smtp.user,
            senderName: smtp.senderName,
            secure: smtp.secure
        });
    } else {
        console.log('SMTP Config NOT FOUND in DB for this user.');
    }

    // also check if any smtp config exists at all
    const count = await prisma.doctorSmtpConfig.count();
    console.log(`Total SMTP configs in DB: ${count}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
