
import { ApiClient } from '../api-client';

async function runPhase6() {
    const client = new ApiClient();
    const timestamp = Date.now();

    // 1. Setup Data
    console.log('--- Phase 6: Email & Interaction Testing ---');

    // Login as SaaS Owner
    const saasOwner = { name: 'Super Owner', email: `saas_${timestamp}@mediflow.test`, password: 'Password123!', role: 'SAAS_OWNER' };
    await client.post('/auth/register', saasOwner);
    await client.login(saasOwner.email, saasOwner.password);

    console.log('Creating Clinic...');
    const clinic = await client.post('/clinics', { name: `Interaction Clinic ${timestamp}`, address: 'Email St' });

    console.log('Creating Doctor...');
    const drResp = await client.post('/users', {
        name: 'Dr. Email',
        email: `dremail_${timestamp}@mediflow.test`,
        password: 'Password123!',
        role: 'doctor',
        clinicId: clinic.id
    });
    await client.post('/auth/verify-invite', { token: drResp.verificationToken });

    // 2. Create Email Template
    console.log('Creating Email Template...');
    const template = await client.post('/email-templates', {
        name: `Confirmation Template ${timestamp}`,
        subject: 'Please Confirm Appointment',
        category: 'APPOINTMENT',
        bodyHtml: '<p>Click here: <a href="{{confirmLink}}">Confirm</a></p>',
        bodyText: 'Click here: {{confirmLink}}',
        clinicId: clinic.id
    });

    // 3. Create Workflow
    console.log('Creating Workflow with Email Action...');
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
                actionType: 'email',
                templateId: template.id,
                subject: 'Confirmation Required' // override? or used if template missing
            }
        }
    ];
    const workflowEdges = [
        { id: 'e1-2', source: 'trigger-1', target: 'action-1' }
    ];

    await client.post('/workflows', {
        name: `Confirmation Workflow ${timestamp}`,
        triggerType: 'APPOINTMENT_CREATED',
        patientType: 'ALL',
        clinicId: clinic.id,
        isActive: true, // Auto-active
        nodes: workflowNodes,
        edges: workflowEdges,
        steps: [] // Legacy
    });

    // 4. Trigger via Appointment
    console.log('Creating Appointment...');
    const service = await client.post('/services', {
        name: 'Consultation',
        duration: '30',
        price: 50,
        clinicId: clinic.id,
        doctorId: drResp.id
    });

    // Update global LEAD form
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
            date: '2026-04-01',
            time: '10:00'
        },
        'lead-name': 'John Email',
        'lead-email': patientEmail,
        'lead-phone': '5550002222',
        'lead-password': 'Password123!'
    };

    const submissionResult = await client.post(`/forms/${bookingForm?.id}/submissions`, bookingData);
    const appointmentId = submissionResult.appointment?.id;
    const patientId = submissionResult.appointment?.patientId; // Or parsed from result

    console.log(`✓ Appointment created: ${appointmentId}`);

    // 5. Wait for Email Log
    console.log('Waiting for Email Log (5s)...');
    await new Promise(r => setTimeout(r, 5000));

    // The Patient doesn't have a login to check their own logs easily unless we login as them.
    // BUT the Doctor can see logs for their patient.
    // Login as Doctor
    await client.login(drResp.email, 'Password123!');

    // Endpoint to get logs? 
    // GET /api/patients/:id/logs ?
    // Let's check PatientsController

    // Assuming GET /patients/:id/logs exists
    let logs = await client.get(`/patients/${patientId}/logs`);
    console.log(`Found ${logs.length} logs for patient (as Doctor)`);

    if (logs.length === 0) {
        console.log('Debugging: Login as SaaS Owner to check logs...');
        await client.login(saasOwner.email, saasOwner.password);
        logs = await client.get(`/patients/${patientId}/logs`);
        console.log(`Found ${logs.length} logs for patient (as SaaS Owner)`);
    }

    const emailLog = logs.find((l: any) => l.type === 'EMAIL' && l.content.includes('/email/confirm'));

    if (!emailLog) {
        console.error('✗ Email log not found or link missing');
        console.log('All Logs:', JSON.stringify(logs, null, 2));
        process.exit(1);
    }

    console.log('✓ Found confirmation email log');

    // 6. Extract Link
    // Content: Click here: http://localhost:4000/email/confirm?token=...
    const match = emailLog.content.match(/href="([^"]+)"/) || emailLog.content.match(/http[^\s"]+/);
    let confirmUrl = match ? match[1] || match[0] : null;

    if (!confirmUrl) {
        console.error('✗ Could not extract URL from content:', emailLog.content);
        process.exit(1);
    }

    // Decode HTML entities (Handlebars escapes = to &#x3D;)
    confirmUrl = confirmUrl.replace(/&#x3D;/g, '=').replace(/&amp;/g, '&');
    console.log(`Decoded URL: ${confirmUrl}`);

    const tokenMatch = confirmUrl.match(/token=([^&]+)/);
    if (!tokenMatch) {
        console.error('✗ Could not extract token from URL:', confirmUrl);
        process.exit(1);
    }
    const token = tokenMatch[1];
    console.log(`✓ Extracted Token: ${token}`);

    // 7. Click Link (Confirm)
    console.log('Simulating Link Click (Confirm)...');
    // We can use client.get('/email/confirm?token=...')
    // Note: This endpoint redirects (302). Axios follows redirects.
    // The final destination (frontend) might 404 in this test env, but the backend action should complete first.

    try {
        await client.get(`/email/confirm?token=${token}`);
    } catch (err: any) {
        // Ignore 404 from frontend redirect, or just check if appointment updated
        console.log('Link clicked (ignoring redirect result)');
    }

    // 8. Verify Appointment Status
    console.log('Verifying Appointment Status...');
    const appt = await client.get(`/appointments/${appointmentId}`);

    if (appt.status === 'confirmed' || appt.isConfirmed === true) {
        console.log('✓ Appointment Confirmed!');
    } else {
        console.error(`✗ Appointment NOT confirmed. Status: ${appt.status}, isConfirmed: ${appt.isConfirmed}`);
        process.exit(1);
    }

    console.log('\nPhase 6 Completed Successfully!');
}

runPhase6().catch(err => {
    console.error('Fatal error in Phase 6:', err);
    process.exit(1);
});
