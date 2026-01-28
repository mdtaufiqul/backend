import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function fixMissingUsers() {
    console.log('🔍 Finding patients without User accounts...\n');

    // Find all patients without User accounts
    const patients = await prisma.patient.findMany({
        where: {
            email: { not: null }
        },
        select: { id: true, email: true, name: true }
    });

    let created = 0;
    let skipped = 0;

    for (const patient of patients) {
        if (!patient.email) continue; // Skip if no email

        const user = await prisma.user.findFirst({
            where: { email: { equals: patient.email, mode: 'insensitive' } }
        });

        if (!user) {
            console.log(`📝 Creating User for Patient: ${patient.email}`);
            const randomPassword = Math.random().toString(36).slice(-8);

            await prisma.user.create({
                data: {
                    name: patient.name,
                    email: patient.email.toLowerCase(),
                    role: 'patient',
                    passwordHash: await bcrypt.hash(randomPassword, 10),
                    timezone: 'America/New_York'
                }
            });

            console.log(`✅ Created User for ${patient.email}`);
            console.log(`   Password: ${randomPassword}\n`);
            created++;
        } else {
            console.log(`⏭️  User already exists for ${patient.email}`);
            skipped++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${patients.length}`);

    await prisma.$disconnect();
}

fixMissingUsers().catch(console.error);
