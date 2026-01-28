import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createUserForPatient() {
    const email = 'mahfuzz999@gmail.com';
    const password = 'Se123Se123';

    try {
        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (existingUser) {
            console.log('User already exists:', existingUser);
            return;
        }

        // Get patient info
        const patient = await prisma.patient.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (!patient) {
            console.log('Patient not found');
            return;
        }

        // Create user
        const user = await prisma.user.create({
            data: {
                name: patient.name,
                email: email.toLowerCase(),
                role: 'patient',
                passwordHash: await bcrypt.hash(password, 10),
                timezone: 'America/New_York'
            }
        });

        console.log('User created successfully:', user);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createUserForPatient();
