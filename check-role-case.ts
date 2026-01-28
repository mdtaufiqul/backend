import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRoleCase() {
    console.log('\n=== Checking Role Case Sensitivity ===\n');

    // Find Patient 41
    const patient41 = await prisma.user.findFirst({
        where: {
            name: { contains: 'Patient 41', mode: 'insensitive' }
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true
        }
    });

    console.log('Patient 41 User:');
    console.log(`  ID: ${patient41?.id}`);
    console.log(`  Role in DB: "${patient41?.role}"`);
    console.log(`  Role type: ${typeof patient41?.role}`);
    console.log(`  Lowercase comparison: "${patient41?.role}" === "doctor" ? ${patient41?.role === 'doctor'}`);
    console.log(`  Uppercase comparison: "${patient41?.role}" === "DOCTOR" ? ${patient41?.role === 'DOCTOR'}`);
    console.log(`  Case-insensitive: "${patient41?.role?.toLowerCase()}" === "doctor" ? ${patient41?.role?.toLowerCase() === 'doctor'}`);

    await prisma.$disconnect();
}

checkRoleCase().catch(console.error);
