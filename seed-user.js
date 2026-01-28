const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.create({
        data: {
            email: 'doctor@mediflow.com',
            name: 'Dr. House',
            role: 'DOCTOR',
            passwordHash: 'dummyhash123',
        },
    });
    console.log('Created user:', user);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
