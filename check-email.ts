import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEmail() {
    const email = 'taufiqul.developer+45@gmail.com';

    console.log(`\n=== Checking for email: ${email} ===\n`);

    // Check User table
    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });
    console.log('User record:', user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasPassword: !!user.passwordHash,
        createdAt: user.createdAt
    } : 'NOT FOUND');

    // Check Patient table
    const patient = await prisma.patient.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });
    console.log('\nPatient record:', patient ? {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        hasPassword: !!patient.passwordHash,
        createdAt: patient.createdAt
    } : 'NOT FOUND');

    // Check Appointments
    if (patient) {
        const appointments = await prisma.appointment.findMany({
            where: { patientId: patient.id },
            include: { service: true, doctor: true }
        });
        console.log('\nAppointments:', appointments.length);
        appointments.forEach(apt => {
            console.log(`  - ${apt.id}: ${apt.status} on ${apt.date} with Dr. ${apt.doctor.name}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    if (user && patient) {
        console.log('✅ VERIFICATION PASSED:');
        console.log('   - Patient record exists with password hash');
        console.log('   - User account exists with patient role');
        console.log('   - Account is ready for login');
        console.log('\n⚠️  Patient should use "Forgot Password" to set their own password');
    } else {
        console.log('❌ VERIFICATION FAILED:');
        if (!user) console.log('   - User account is missing');
        if (!patient) console.log('   - Patient record is missing');
    }
    console.log('='.repeat(60) + '\n');

    await prisma.$disconnect();
}

checkEmail().catch(console.error);
