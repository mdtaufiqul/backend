const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log('Total Users:', users.length);
    users.forEach(u => {
        console.log(`- ${u.name} (${u.email}) [Role: ${u.role}] ID: ${u.id}`);
        console.log(`  Schedule: ${u.schedule ? 'SET' : 'NULL'}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
