const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const deleted = await prisma.user.deleteMany({
        where: { email: 'doctor@mediflow.com' }
    });
    console.log('Deleted users:', deleted.count);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
