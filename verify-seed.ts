import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    const counts = {
        clinics: await prisma.clinic.count(),
        users: await prisma.user.count(),
        services: await prisma.service.count(),
        emailTemplates: await prisma.emailTemplate.count(),
        patients: await prisma.patient.count(),
        observations: await prisma.patientObservation.count()
    };
    console.log('Database Counts:', JSON.stringify(counts, null, 2));

    if (counts.clinics > 0) {
        const firstClinic = await prisma.clinic.findFirst();
        console.log('First Clinic:', JSON.stringify(firstClinic, null, 2));
    }

    if (counts.users > 0) {
        const firstUser = await prisma.user.findFirst();
        console.log('First User:', JSON.stringify(firstUser, null, 2));
    }
}

verify()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
