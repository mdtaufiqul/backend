
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestAppointment() {
    const appt = await prisma.appointment.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
            patient: true,
            doctor: true
        }
    });

    if (appt) {
        const a = appt as any;
        console.log('Latest Appointment:');
        console.log(`- ID: ${a.id}`);
        console.log(`- Guest Email: ${a.guestEmail}`);
        console.log(`- Patient: ${a.patient?.name} (${a.patient?.email}) [ID: ${a.patient?.id}]`);
        console.log(`- Doctor: ${a.doctor?.name} (${a.doctor?.email})`);
        console.log(`- CreatedAt: ${a.createdAt}`);
    } else {
        console.log('No appointments found.');
    }
}

checkLatestAppointment()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
