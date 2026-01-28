
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const doctor = await prisma.user.findFirst();
    const patient = await prisma.patient.findFirst();

    if (!doctor || !patient) {
        console.error('Doctor or Patient not found');
        return;
    }

    console.log('Creating appointment for:', {
        doctor: doctor.id,
        patient: patient.id
    });

    const appointment = await prisma.appointment.create({
        data: {
            doctorId: doctor.id,
            patientId: patient.id,
            date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            status: 'scheduled',
            type: 'video',
            notes: 'Email Test Script',
        }
    });

    console.log('Appointment created:', appointment.id);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
