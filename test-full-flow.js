const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== FULL FLOW TEST ===');

    // 1. Setup Data
    const doctor = await prisma.user.findFirst({ where: { role: 'doctor' } });
    if (!doctor) throw new Error('No doctor found');
    console.log(`Doctor: ${doctor.email} (${doctor.id})`);

    // Force Doctor Schedule (Just in case)
    // await prisma.user.update({ where: { id: doctor.id }, data: { schedule: ... } });

    const service = await prisma.service.findFirst();
    if (!service) throw new Error('No service found');
    console.log(`Service: ${service.name} (${service.duration})`);

    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 1); // Tomorrow
    testDate.setHours(10, 0, 0, 0); // 10:00 AM Local (approx)
    // We'll use a string for the payload to mimic frontend
    const dateStr = testDate.toISOString();
    const timeStr = "10:00";

    console.log(`Test Date: ${dateStr}, Time: ${timeStr}`);

    console.log('\n--- STEP 1: Create Appointment A ---');
    // Simulate AppointmentsService.create logic via a direct function call or http request simulation
    // I will call a simulated function that mirrors the Service logic I verified.

    const apptA = await createAppointmentSimulated(doctor.id, service.id, dateStr, timeStr, "Patient A", "a@test.com");
    console.log(`Created Appt A: ${apptA.id} at ${apptA.date.toISOString()}`);

    // Verify Timezone
    const storedDate = new Date(apptA.date);
    const hours = storedDate.getHours();
    // If stored as UTC, 10:00 AM BDT (GMT+6) should be 04:00 AM UTC.
    console.log(`Stored Hour (UTC): ${storedDate.getUTCHours()}:${storedDate.getUTCMinutes()}`);
    // If local timezone of machine is +6, getHours() should be 10.
    console.log(`Stored Hour (Local): ${storedDate.getHours()}:${storedDate.getMinutes()}`);


    console.log('\n--- STEP 2: Attempt Double Booking (Appt B) ---');
    try {
        const apptB = await createAppointmentSimulated(doctor.id, service.id, dateStr, timeStr, "Patient B", "b@test.com");
        console.log(`[FAILURE] Created Appt B (Double Booking): ${apptB.id}. Backend allowed it!`);
    } catch (e) {
        console.log(`[SUCCESS] Double booking prevented: ${e.message}`);
    }

    console.log('\n--- STEP 3: Verify Workflow Trigger ---');
    // Check WorkflowInstance for Appt A
    const instances = await prisma.workflowInstance.findMany({
        where: { appointmentId: apptA.id }
    });
    console.log(`Workflow Instances for Appt A: ${instances.length}`);
    instances.forEach(i => console.log(`- Status: ${i.status}, WorkflowId: ${i.workflowId}`));
}

// MIMIC AppointmentsService.create Logic
async function createAppointmentSimulated(doctorId, serviceId, date, time, guestName, guestEmail) {
    let appointmentDate;
    if (date) {
        appointmentDate = new Date(date);
        if (time) {
            const [hours, minutes] = time.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                appointmentDate.setHours(hours, minutes, 0, 0);
            }
        }
    }

    // VALIDATION CHECK
    const existing = await prisma.appointment.findFirst({
        where: {
            doctorId,
            date: appointmentDate,
            status: { notIn: ['cancelled', 'waitlist'] }
        }
    });

    if (existing) {
        throw new Error("This time slot is already booked.");
    }

    return await prisma.appointment.create({
        data: {
            doctorId,
            serviceId,
            date: appointmentDate,
            guestName,
            guestEmail,
            status: 'scheduled',
            type: 'in-person'
        }
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
