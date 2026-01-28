const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log(`Total Users: ${users.length}`);
    users.forEach((u, i) => {
        console.log(`[${i}] ${u.email} (Role: ${u.role}, ID: ${u.id})`);
    });

    console.log('--- Checking findFirst() result ---');
    const first = await prisma.user.findFirst();
    console.log(`findFirst() returns: ${first?.email}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
