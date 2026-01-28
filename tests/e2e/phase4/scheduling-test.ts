
import { ApiClient } from '../api-client';

async function runPhase4() {
    const client = new ApiClient();
    const timestamp = Date.now();

    // 1. Setup Data
    console.log('--- Phase 4: Scheduling & Appointments ---');

    // Login as SaaS Owner to setup
    const saasOwner = { name: 'Super Owner', email: `saas_${timestamp}@mediflow.test`, password: 'Password123!', role: 'SAAS_OWNER' };
    await client.post('/auth/register', saasOwner);
    await client.login(saasOwner.email, saasOwner.password);

    console.log('Creating Clinic...');
    const clinic = await client.post('/clinics', { name: `Sched Clinic ${timestamp}`, address: 'Sched Ave' });

    console.log('Creating Doctor...');
    const drResp = await client.post('/users', {
        name: 'Dr. Sched',
        email: `drsched_${timestamp}@mediflow.test`,
        password: 'Password123!',
        role: 'doctor',
        clinicId: clinic.id
    });
    await client.post('/auth/verify-invite', { token: drResp.verificationToken });

    console.log('Creating Service...');
    const service = await client.post('/services', {
        name: 'General Consultation',
        description: 'Standard checkup',
        duration: '30', // String as per schema
        price: 100,
        clinicId: clinic.id,
        doctorId: drResp.id
    });

    // 2. Fetch Booking Form
    console.log('Fetching Booking Form...');
    const forms = await client.get('/forms');
    const bookingForm = forms.find((f: any) => f.systemType === 'LEAD');
    if (!bookingForm) {
        console.error('✗ Booking Form (LEAD) not found');
        process.exit(1);
    }

    // CRITICAL FIX: Update form to point to this clinic so appointments go there
    console.log(`Updating Form ${bookingForm.id} to Clinic ${clinic.id}...`);
    await client.patch(`/forms/${bookingForm.id}`, {
        clinicId: clinic.id
    });

    // 3. Submit Booking (as Patient)
    console.log('Submitting Booking Form...');
    const patientEmail = `patient_${timestamp}@mediflow.test`;
    const bookingData = {
        'practitioner-select': drResp.id,
        'service-select': service.id,
        'appointment-time': {
            practitioner: drResp.id,
            date: '2026-02-01',
            time: '10:00'
        },
        'lead-name': 'John Doe',
        'lead-email': patientEmail,
        'lead-phone': '1234567890',
        'lead-password': 'Password123!',
        'lead-reason': 'Feeling unwell'
    };

    const submissionResult = await client.post(`/forms/${bookingForm.id}/submissions`, bookingData);
    console.log('✓ Form submitted successfully');

    const appointmentId = submissionResult.appointment?.id;
    if (!appointmentId) {
        console.error(`✗ Appointment NOT created in response: ${JSON.stringify(submissionResult)}`);
        process.exit(1);
    }
    console.log(`✓ Appointment created: ${appointmentId}`);

    // 4. Verify as Doctor
    console.log('Verifying appointment as Doctor...');
    const drLogin = await client.login(`drsched_${timestamp}@mediflow.test`, 'Password123!');
    console.log(`LoggedIn Doctor: ID=${drLogin.user.id}, Role=${drLogin.user.role}, ClinicId=${drLogin.user.clinicId}`);

    const myAppointments = await client.get('/appointments');
    console.log(`Doctor saw ${myAppointments.length} appointments`);
    if (myAppointments.length > 0) {
        console.log(`First appt ID: ${myAppointments[0].id}, DoctorId in Appt: ${myAppointments[0].doctorId}`);
    }

    const found = myAppointments.find((a: any) => a.id === appointmentId);
    if (found) {
        console.log('✓ Doctor can see the appointment');
    } else {
        console.error('✗ Doctor cannot see the appointment');
        process.exit(1);
    }

    // 5. Test Reschedule
    console.log('Testing Reschedule...');
    await client.patch(`/appointments/${appointmentId}`, {
        date: '2026-02-01T11:00:00.000Z' // AppointmentsService expects a full date string or ISO
    });
    console.log('✓ Appointment rescheduled');

    // 6. Test Cancellation
    console.log('Testing Cancellation...');
    await client.patch(`/appointments/${appointmentId}`, {
        status: 'cancelled'
    });
    const cancelled = await client.get(`/appointments/${appointmentId}`);
    if (cancelled.status === 'cancelled') {
        console.log('✓ Appointment cancelled successfully');
    } else {
        console.error(`✗ Failed to cancel appointment. Status: ${cancelled.status}`);
        process.exit(1);
    }

    console.log('\nPhase 4 Completed Successfully!');
}

runPhase4().catch(err => {
    console.error('Fatal error in Phase 4:', err);
    process.exit(1);
});
