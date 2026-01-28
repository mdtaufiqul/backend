import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking Users...");
    const users = await prisma.user.findMany({
        select: { id: true, email: true, role: true, passwordHash: true }
    });
    console.log("Users found:", users.length);
    users.forEach(u => {
        console.log(`- ${u.email} (${u.role}) - HashLen: ${u.passwordHash?.length}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
