const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({ where: { email: 'learnwithtahidul@gmail.com' } });
    if (user) {
        console.log(`Deleting SMTP config for ${user.email}...`);
        await prisma.doctorSmtpConfig.deleteMany({ where: { userId: user.id } });
        console.log('Deleted.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
