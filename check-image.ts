import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking User Images...");
    const user = await prisma.user.findFirst({
        where: { email: 'dr.solo@mediflow.com' }
    });

    if (user) {
        console.log(`User: ${user.email}`);
        console.log(`Image DB Value: '${user.image}'`);
    } else {
        console.log("User not found");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
