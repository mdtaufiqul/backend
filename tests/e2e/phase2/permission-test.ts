
import { ApiClient } from '../api-client';

async function runPhase2() {
    const client = new ApiClient();
    const timestamp = Date.now();

    // Register 3 users for testing
    const saUser = { name: 'System Admin', email: `sa_${timestamp}@mediflow.test`, password: 'Password123!', role: 'SYSTEM_ADMIN' };
    const doctorUser = { name: 'Doctor', email: `dr_${timestamp}@mediflow.test`, password: 'Password123!', role: 'doctor' };
    const patientUser = { name: 'Patient', email: `pa_${timestamp}@mediflow.test`, password: 'Password123!', role: 'patient' };

    await client.post('/auth/register', saUser);
    await client.post('/auth/register', doctorUser);
    await client.post('/auth/register', patientUser);

    console.log('--- Phase 2: Permission Validation ---');

    // 1. System Admin full access
    console.log('Testing System Admin access to /clinics...');
    await client.login(saUser.email, saUser.password);
    try {
        const clinics = await client.get('/clinics');
        console.log(`✓ System Admin fetched ${clinics.length} clinics`);
    } catch (e) {
        console.error('✗ System Admin could not fetch clinics');
        process.exit(1);
    }

    // 2. Patient restricted access (Clinics)
    console.log('Testing Patient access to /clinics (should be blocked)...');
    await client.login(patientUser.email, patientUser.password);
    try {
        await client.get('/clinics');
        console.error('✗ Patient was able to fetch clinics! (Security Leak)');
        process.exit(1);
    } catch (e: any) {
        if (e.response?.status === 403) {
            console.log('✓ Patient access to /clinics blocked (403 Forbidden)');
        } else {
            console.error(`! Unexpected error for patient: ${e.response?.status} ${e.message}`);
            process.exit(1);
        }
    }

    // 3. Billing accessible only by System Admin (or those with permission)
    console.log('Testing Patient access to /billing/invoices (should be blocked)...');
    try {
        await client.get('/billing/invoices');
        console.error('✗ Patient was able to fetch billing! (Security Leak)');
        process.exit(1);
    } catch (e: any) {
        if (e.response?.status === 403) {
            console.log('✓ Patient access to /billing blocked (403 Forbidden)');
        } else {
            console.error(`! Unexpected error for patient: ${e.response?.status} ${e.message}`);
            process.exit(1);
        }
    }

    // 4. Workflow access restricted
    console.log('Testing Doctor access to /workflows (should depend on permission)...');
    await client.login(doctorUser.email, doctorUser.password);
    try {
        await client.get('/workflows');
        // By default, a new doctor might not have manage_workflows permission if not given
        // Let's check what the default for DOCTOR role is in our system.
        // In our RoleTemplateService, DOCTOR does NOT have 'view_workflows'.
        console.error('✗ Doctor was able to fetch workflows! (Potential Permission Leak if default says NO)');
        process.exit(1);
    } catch (e: any) {
        if (e.response?.status === 403) {
            console.log('✓ Doctor access to /workflows blocked (403 Forbidden)');
        } else {
            console.error(`! Unexpected error for doctor: ${e.response?.status} ${e.message}`);
            process.exit(1);
        }
    }

    console.log('\nPhase 2 Completed Successfully!');
}

runPhase2().catch(err => {
    console.error('Fatal error in Phase 2:', err);
    process.exit(1);
});
