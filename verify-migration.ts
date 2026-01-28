
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/auth'; // Adjust port if needed

async function verify() {
    console.log('--- Verifying Multi-Role Setup ---');

    // 1. Find an account with multiple users or memberships
    const accounts = await prisma.account.findMany({
        include: {
            users: { include: { memberships: true } },
            patients: true
        }
    });

    let targetAccount: any = null;

    for (const acc of accounts) {
        let rolesCount = 0;
        acc.users.forEach(u => {
            rolesCount++; // The user itself
            rolesCount += u.memberships.length;
        });
        rolesCount += acc.patients.length;

        if (rolesCount > 1) {
            targetAccount = acc;
            console.log(`Found Multi-Role Account: ${acc.email} with ${rolesCount} profiles.`);
            break;
        }
    }

    if (!targetAccount) {
        console.log('No multi-role account found. Please create one or assign roles first.');
        return;
    }

    // 2. Try Login with this account
    console.log(`\n--- Testing Login for ${targetAccount.email} ---`);
    // We don't know the plain text password from hash, so we might need to reset it or mock the req if we can't login really.
    // Actually, I can use the migration logic which set default hash if I knew it, but here accounts are migrated.
    // I will use a known test user if possible.

    // For this test, I will force a known password hash on this account so I can login.
    // WARNING: This changes data.
    // const bcrypt = require('bcryptjs');
    // const hash = await bcrypt.hash('password123', 10);
    // await prisma.account.update({ where: { id: targetAccount.id }, data: { passwordHash: hash } });

    console.log('Skipping actual login HTTP request in this script to avoid resetting passwords blindly.');
    console.log('Use the UI with your known credentials.');

    // 3. Inspect the structure manually to verify linking
    console.log('Account Structure:');
    console.log(JSON.stringify(targetAccount, null, 2));

    // 4. Validate Account ID presence
    const userWithoutAccount = await prisma.user.findFirst({ where: { accountId: null } });
    if (userWithoutAccount) {
        console.error('FAIL: Found user without account linked:', userWithoutAccount.id);
    } else {
        console.log('SUCCESS: All users linked to accounts.');
    }

    const patientWithoutAccount = await prisma.patient.findFirst({
        where: { accountId: null, email: { not: null } }
    });
    if (patientWithoutAccount) {
        console.error('FAIL: Found patient without account linked:', patientWithoutAccount.id);
    } else {
        console.log('SUCCESS: All patients (with email) linked to accounts.');
    }
}

verify()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
