
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createMissingUser() {
    const email = 'mahfuzz999@gmail.com';

    const existingUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (existingUser) {
        console.log('User already exists:', existingUser.id);
        return;
    }

    const patient = await prisma.patient.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!patient) {
        console.log('Patient record also missing. Cannot link.');
        return;
    }

    console.log('Creating user for patient:', patient.name);
    const passwordHash = await bcrypt.hash('welcome123', 10);

    const newUser = await prisma.user.create({
        data: {
            name: patient.name,
            email: email, // lowercase
            role: 'patient',
            passwordHash,
            // Link to patient if schema supports it directly? 
            // Usually linked by email or manual link. 
            // My schema likely doesn't have `patientId` on User, but Patient has User? Or loose coupling?
            // Usually loosely coupled by email in this system.
        }
    });

    console.log('User created successfully:', newUser.id);
    console.log('Temporary password: welcome123');
}

createMissingUser()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
