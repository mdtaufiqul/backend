
import { ApiClient } from '../api-client';

async function runPhase3() {
    const client = new ApiClient();
    const timestamp = Date.now();

    // 1. Create SaaS Owner
    const saasOwner = { name: 'Super Owner', email: `saas_${timestamp}@mediflow.test`, password: 'Password123!', role: 'SAAS_OWNER' };
    await client.post('/auth/register', saasOwner);
    await client.login(saasOwner.email, saasOwner.password);

    console.log('--- Phase 3: Clinic & Staff Management ---');

    // 2. Create Clinics
    console.log('Creating Clinic A...');
    const clinicA = await client.post('/clinics', { name: `Clinic A ${timestamp}`, address: '123 Alpha St' });
    console.log(`✓ Created Clinic A: ${clinicA.id}`);

    console.log('Creating Clinic B...');
    const clinicB = await client.post('/clinics', { name: `Clinic B ${timestamp}`, address: '456 Beta St' });
    console.log(`✓ Created Clinic B: ${clinicB.id}`);

    // 3. Create Doctors for each clinic
    console.log('Creating Doctor for Clinic A...');
    const drAResp = await client.post('/users', {
        name: 'Dr. Alpha',
        email: `dra_${timestamp}@mediflow.test`,
        password: 'Password123!',
        role: 'doctor',
        clinicId: clinicA.id
    });

    console.log('Activating Doctor A...');
    await client.post('/auth/verify-invite', { token: drAResp.verificationToken });

    console.log('Logging in as Doctor A to check profile...');
    const loginA = await client.login(`dra_${timestamp}@mediflow.test`, 'Password123!');
    console.log(`Doctor A Permissions: ${JSON.stringify(loginA.user.permissions)}`);

    console.log('Fetching own clinic (A)...');
    try {
        const myClinics = await client.get('/clinics');
        if (myClinics.length === 1 && myClinics[0].id === clinicA.id) {
            console.log('✓ Doctor A only sees Clinic A');
        } else {
            console.error(`✗ Doctor A isolation failure. Saw clinics: ${JSON.stringify(myClinics.map((c: any) => c.name))}`);
            process.exit(1);
        }
    } catch (e: any) {
        console.error(`✗ Doctor A could not fetch clinics: ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
        process.exit(1);
    }

    console.log('\nPhase 3 Completed Successfully!');
}

runPhase3().catch(err => {
    console.error('Fatal error in Phase 3:', err);
    process.exit(1);
});
