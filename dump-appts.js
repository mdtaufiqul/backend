const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const doctorId = 'a2027450-3e66-455e-90d0-0b9dc302fd11';
    console.log(`Checking appointments for doctor: ${doctorId}`);

    const appointments = await prisma.appointment.findMany({
        where: {
            doctorId: doctorId,
            date: {
                gte: new Date('2026-01-11T00:00:00Z'),
                lt: new Date('2026-01-13T00:00:00Z')
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log('Found Appointments:', JSON.stringify(appointments, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
