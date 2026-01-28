
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEmails() {
    const mixedCaseUser = await prisma.user.findFirst({
        where: { email: { equals: 'Mahfuzz999@gmail.com', mode: 'insensitive' } }
    });

    if (mixedCaseUser) {
        console.log(`Found User with email: ${mixedCaseUser.email}`);
        if (mixedCaseUser.email !== mixedCaseUser.email.toLowerCase()) {
            await prisma.user.update({
                where: { id: mixedCaseUser.id },
                data: { email: mixedCaseUser.email.toLowerCase() }
            });
            console.log(`Updated User email to: ${mixedCaseUser.email.toLowerCase()}`);
        } else {
            console.log('User email is already lowercase.');
        }
    } else {
        console.log('User Mahfuzz999@gmail.com not found.');
    }

    const mixedCasePatient = await prisma.patient.findFirst({
        where: { email: { equals: 'Mahfuzz999@gmail.com', mode: 'insensitive' } }
    });

    if (mixedCasePatient && mixedCasePatient.email) {
        console.log(`Found Patient with email: ${mixedCasePatient.email}`);
        if (mixedCasePatient.email !== mixedCasePatient.email.toLowerCase()) {
            await prisma.patient.update({
                where: { id: mixedCasePatient.id },
                data: { email: mixedCasePatient.email.toLowerCase() }
            });
            console.log(`Updated Patient email to: ${mixedCasePatient.email.toLowerCase()}`);
        } else {
            console.log('Patient email is already lowercase.');
        }
    } else {
        console.log('Patient Mahfuzz999@gmail.com not found.');
    }
}

fixEmails()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
