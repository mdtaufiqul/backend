
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUser() {
    const email = 'mahfuzz999@gmail.com';
    console.log(`Attempting to delete data for: ${email}`);

    // 1. Find records
    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    const patient = await prisma.patient.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    // 2. Delete Appointments linked to Patient
    if (patient) {
        const deletedAppts = await prisma.appointment.deleteMany({
            where: { patientId: patient.id }
        });
        console.log(`Deleted ${deletedAppts.count} appointments for patient.`);

        // Delete Patient
        await prisma.patient.delete({
            where: { id: patient.id }
        });
        console.log('Deleted Patient record.');
    } else {
        console.log('No Patient record found.');
    }

    // 3. Delete User
    if (user) {
        await prisma.user.delete({
            where: { id: user.id }
        });
        console.log('Deleted User record.');
    } else {
        console.log('No User record found.');
    }
}

deleteUser()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
