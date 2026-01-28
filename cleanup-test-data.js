const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up test appointments...');
    const dateObj = new Date('2026-01-08T04:00:00.000Z'); // The date used in test
    const result = await prisma.appointment.deleteMany({
        where: {
            date: dateObj
        }
    });
    console.log(`Deleted ${result.count} appointments.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
