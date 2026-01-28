const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst();

    const defaultSchedule = {
        "monday": { "start": "09:00", "end": "17:00", "active": true },
        "tuesday": { "start": "09:00", "end": "17:00", "active": true },
        "wednesday": { "start": "09:00", "end": "17:00", "active": true },
        "thursday": { "start": "09:00", "end": "17:00", "active": true },
        "friday": { "start": "09:00", "end": "17:00", "active": true },
        "saturday": { "active": false },
        "sunday": { "active": false }
    };

    await prisma.user.update({
        where: { id: user.id },
        data: { schedule: defaultSchedule }
    });

    console.log('Updated schedule for:', user.name);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
