import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
    const users = await prisma.user.findMany();
    console.log('Users in DB:');
    users.forEach(u => console.log(`- ${u.email} (${u.role})`));
}

listUsers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
