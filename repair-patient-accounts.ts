import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Repair Script: Create User accounts for Patients who don't have them
 * 
 * This script finds all Patient records that have an email but no corresponding
 * User account, and creates User accounts for them with auto-generated passwords.
 */
async function repairPatientAccounts() {
    console.log('\n🔧 Starting Patient Account Repair Script...\n');

    try {
        // Find all patients with emails
        const patients = await prisma.patient.findMany({
            where: {
                email: {
                    not: null
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                passwordHash: true,
                createdAt: true
            }
        });

        console.log(`Found ${patients.length} patients with email addresses\n`);

        let repaired = 0;
        let skipped = 0;
        let errors = 0;

        for (const patient of patients) {
            const email = patient.email!.toLowerCase();

            // Check if User account exists
            const existingUser = await prisma.user.findFirst({
                where: { email: { equals: email, mode: 'insensitive' } }
            });

            if (existingUser) {
                console.log(`✓ User account already exists for ${email} (skipping)`);
                skipped++;
                continue;
            }

            // User account doesn't exist, create one
            try {
                // Generate a random password
                const autoPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
                const passwordHash = await bcrypt.hash(autoPassword, 10);

                const newUser = await prisma.user.create({
                    data: {
                        name: patient.name,
                        email: email,
                        role: 'patient',
                        passwordHash: passwordHash,
                        timezone: 'America/New_York' // Default timezone
                    }
                });

                console.log(`✅ Created User account for ${email}`);
                console.log(`   Patient ID: ${patient.id}`);
                console.log(`   User ID: ${newUser.id}`);
                console.log(`   Auto-generated password: ${autoPassword}`);
                console.log(`   ⚠️  Patient should use "Forgot Password" to set their own password\n`);

                // Also update Patient record to have passwordHash if missing
                if (!patient.passwordHash) {
                    await prisma.patient.update({
                        where: { id: patient.id },
                        data: { passwordHash: passwordHash }
                    });
                    console.log(`   📝 Updated Patient record with password hash\n`);
                }

                repaired++;
            } catch (error) {
                console.error(`❌ Failed to create User account for ${email}:`, error);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Repair Summary:');
        console.log(`   Total patients checked: ${patients.length}`);
        console.log(`   ✅ Accounts repaired: ${repaired}`);
        console.log(`   ⏭️  Accounts skipped (already exist): ${skipped}`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log('='.repeat(60) + '\n');

        if (repaired > 0) {
            console.log('⚠️  IMPORTANT: Patients with repaired accounts should use the');
            console.log('   "Forgot Password" feature to set their own password.\n');
        }

    } catch (error) {
        console.error('❌ Script failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
repairPatientAccounts().catch(console.error);
