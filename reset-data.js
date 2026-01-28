const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Starting system data reset...');

        // Delete child tables first to avoid FK constraints
        console.log('Deleting Communication Logs...');
        await prisma.communicationLog.deleteMany({});

        console.log('Deleting Appointment Logs...');
        await prisma.appointmentLog.deleteMany({});

        console.log('Deleting Workflow Instances...');
        await prisma.workflowInstance.deleteMany({});

        console.log('Deleting Messages...');
        await prisma.message.deleteMany({});

        console.log('Deleting Appointments (including waitlist)...');
        await prisma.appointment.deleteMany({});

        console.log('Deleting Patients...');
        // Note: If forms link to patients, we might need to handle that, but schema shows patientId in Message/Appt/Instance
        await prisma.patient.deleteMany({});

        console.log('✅ System reset complete. Doctors, Users, and Settings were preserved.');
    } catch (error) {
        console.error('❌ Reset failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
