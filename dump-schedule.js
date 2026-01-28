const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({ where: { role: 'doctor' } });
    if (user) {
        console.log(`User: ${user.email}`);
        console.log('Schedule:', JSON.stringify(user.schedule, null, 2));
    } else {
        console.log('No doctor found');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
