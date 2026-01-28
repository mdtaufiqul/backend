
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function migrateToAccounts() {
    console.log('Starting migration to Account-based Users...');

    // 1. Migrate Users (Doctors, Staff, Admins)
    const users = await prisma.user.findMany({
        where: { accountId: null }
    });

    console.log(`Found ${users.length} users to migrate.`);

    for (const user of users) {
        console.log(`Processing user: ${user.email}`);

        // Check if account already exists for this email
        let account = await prisma.account.findUnique({
            where: { email: user.email }
        });

        if (!account) {
            // Create new account
            // Use existing password hash if available, else a dummy (will require reset)
            const passwordHash = user.passwordHash || await bcrypt.hash('temp123', 10);

            account = await prisma.account.create({
                data: {
                    email: user.email,
                    passwordHash: passwordHash,
                    isActive: true, // Auto-activate migrated users
                    isEmailVerified: true // Assume existing users are verified
                }
            });
            console.log(`  > Created new Account ${account.id}`);
        } else {
            console.log(`  > Linked to existing Account ${account.id}`);
        }

        // Link user to account
        await prisma.user.update({
            where: { id: user.id },
            data: { accountId: account.id }
        });
    }

    // 2. Migrate Patients
    const patients = await prisma.patient.findMany({
        where: {
            accountId: null,
            email: { not: null } // Only patients with email can have accounts
        }
    });

    console.log(`Found ${patients.length} patients with emails to migrate.`);

    for (const patient of patients) {
        if (!patient.email) continue;
        console.log(`Processing patient: ${patient.email}`);

        let account = await prisma.account.findUnique({
            where: { email: patient.email }
        });

        if (!account) {
            const passwordHash = patient.passwordHash || await bcrypt.hash('patient123', 10);
            account = await prisma.account.create({
                data: {
                    email: patient.email,
                    passwordHash: passwordHash,
                    isActive: true,
                    isEmailVerified: true
                }
            });
            console.log(`  > Created new Account ${account.id}`);
        } else {
            console.log(`  > Linked to existing Account ${account.id}`);
        }

        await prisma.patient.update({
            where: { id: patient.id },
            data: { accountId: account.id }
        });
    }

    console.log('Migration complete.');
}

migrateToAccounts()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
