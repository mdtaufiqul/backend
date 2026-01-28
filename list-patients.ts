import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listPatients() {
    const patients = await prisma.patient.findMany();
    console.log('Patients in DB:');
    patients.forEach(p => console.log(`- ${p.name}: ${p.email} (ID: ${p.id})`));
}

listPatients()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
