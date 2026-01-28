
import { ApiClient } from '../api-client';

async function runPhase5() {
    const client = new ApiClient();
    const timestamp = Date.now();

    // 1. Setup Data
    console.log('--- Phase 5: Workflow System Testing ---');

    // Login as SaaS Owner
    const saasOwner = { name: 'Super Owner', email: `saas_${timestamp}@mediflow.test`, password: 'Password123!', role: 'SAAS_OWNER' };
    await client.post('/auth/register', saasOwner);
    await client.login(saasOwner.email, saasOwner.password);

    console.log('Creating Clinic...');
    const clinic = await client.post('/clinics', { name: `Workflow Clinic ${timestamp}`, address: 'Flow St' });

    console.log('Creating Doctor...');
    const drResp = await client.post('/users', {
        name: 'Dr. Workflow',
        email: `drflow_${timestamp}@mediflow.test`,
        password: 'Password123!',
        role: 'doctor',
        clinicId: clinic.id
    });
    await client.post('/auth/verify-invite', { token: drResp.verificationToken });

    // 2. Create Workflow Definition
    console.log('Creating Workflow Definition...');
    const workflowNodes = [
        {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Appointment Created' }
        },
        {
            id: 'action-1',
            type: 'action',
            position: { x: 0, y: 100 },
            data: {
                actionType: 'add_to_waitlist',
                reason: 'Automated workflow test'
            }
        }
    ];
    const workflowEdges = [
        { id: 'e1-2', source: 'trigger-1', target: 'action-1' }
    ];

    const workflow = await client.post('/workflows', {
        name: `Test Workflow ${timestamp}`,
        triggerType: 'APPOINTMENT_CREATED',
        patientType: 'ALL',
        clinicId: clinic.id,
        isActive: true, // CRITICAL: Must be active to trigger
        nodes: workflowNodes,
        edges: workflowEdges,
        steps: [] // Legacy field, empty
    });

    console.log(`✓ Workflow created: ${workflow.id}`);

    // 3. Trigger Workflow via Appointment Creation
    console.log('Creating Service & Appointment to trigger workflow...');
    const service = await client.post('/services', {
        name: 'Consultation',
        duration: '30',
        price: 50,
        clinicId: clinic.id,
        doctorId: drResp.id
    });

    // Need to update global LEAD form to point to this clinic (reusing fix from Phase 4)
    const forms = await client.get('/forms');
    const bookingForm = forms.find((f: any) => f.systemType === 'LEAD');
    if (bookingForm) {
        await client.patch(`/forms/${bookingForm.id}`, { clinicId: clinic.id });
    }

    const patientEmail = `patient_${timestamp}@mediflow.test`;
    const bookingData = {
        'practitioner-select': drResp.id,
        'service-select': service.id,
        'appointment-time': {
            practitioner: drResp.id,
            date: '2026-03-01',
            time: '12:00'
        },
        'lead-name': 'Jane Flow',
        'lead-email': patientEmail,
        'lead-phone': '5550001111',
        'lead-password': 'Password123!'
    };

    const submissionResult = await client.post(`/forms/${bookingForm?.id}/submissions`, bookingData);
    const appointmentId = submissionResult.appointment?.id;
    console.log(`✓ Appointment created: ${appointmentId}`);

    // 4. Verify Workflow Execution
    // Check if appointment was added to waitlist (Action of the workflow)
    // Give it a moment as it's async (though orchestrator might be awaited in service?)

    // Actually, AppointmentsService triggerEvent is .catch(), meaning it runs in parallel (fire and forget)
    // So we wait a bit
    console.log('Waiting for workflow execution...');
    await new Promise(r => setTimeout(r, 2000));

    const appt = await client.get(`/appointments/${appointmentId}`);
    if (appt.waitlistReason === 'Automated workflow test') {
        console.log('✓ Workflow executed successfully: Appointment added to waitlist');
    } else {
        console.error(`✗ Workflow execution failed. WaitlistReason: ${appt.waitlistReason}`);
        // Check if instance exists (need DB access or API?)
        // We can try to look at logs or just fail for now.
        process.exit(1);
    }

    console.log('\nPhase 5 Completed Successfully!');
}

runPhase5().catch(err => {
    console.error('Fatal error in Phase 5:', err);
    process.exit(1);
});
