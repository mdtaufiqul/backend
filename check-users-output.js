const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Simulate UsersService.findAll logic if it just does findMany()
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            specialties: true,
            schedule: true, // Check if this is selected!
            consultationType: true
        }
    });
    console.log('Sample User Schedule:', JSON.stringify(users[0]?.schedule));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
