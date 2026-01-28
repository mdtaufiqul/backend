
import { ApiClient } from '../api-client';

async function runPhase1() {
    const client = new ApiClient();
    const timestamp = Date.now();

    const testUsers = [
        { name: 'Test Sys Admin', email: `admin_${timestamp}@mediflow.test`, password: 'Password123!', role: 'clinic_admin' },
        { name: 'Test Doctor', email: `doctor_${timestamp}@mediflow.test`, password: 'Password123!', role: 'doctor' },
        { name: 'Test Patient', email: `patient_${timestamp}@mediflow.test`, password: 'Password123!', role: 'patient' },
    ];

    console.log('--- Phase 1: Registration Testing ---');

    for (const user of testUsers) {
        console.log(`Registering ${user.role}: ${user.email}...`);
        try {
            const regResponse = await client.post('/auth/register', user);
            console.log(`✓ Registered ${user.role} with ID: ${regResponse.user.id}`);
        } catch (e) {
            console.error(`✗ Registration failed for ${user.role}`);
            process.exit(1);
        }
    }

    console.log('\n--- Phase 1: Login Testing ---');

    for (const user of testUsers) {
        console.log(`Logging in as ${user.role}: ${user.email}...`);
        try {
            const loginResponse = await client.login(user.email, user.password);
            if (loginResponse.token) {
                console.log(`✓ Login success for ${user.role}`);
            } else if (loginResponse.requiresRoleSelection) {
                console.log(`! Role selection required for ${user.role}`);
                // Handle role selection if needed
                const match = loginResponse.availableRoles.find((r: any) => r.role === user.role);
                const session = await client.post('/auth/select-role', {
                    tempToken: loginResponse.tempToken,
                    profileId: match.id,
                    profileType: match.type
                });
                console.log(`✓ Session established for ${user.role}`);
            }
        } catch (e) {
            console.error(`✗ Login failed for ${user.role}`);
            process.exit(1);
        }
    }

    console.log('\n--- Phase 1: Auth Identity Check ---');
    for (const user of testUsers) {
        await client.login(user.email, user.password);
        const me = await client.get('/auth/me');
        if (me.email.toLowerCase() === user.email.toLowerCase() && me.role === user.role) {
            console.log(`✓ Identity verified for ${user.role}`);
        } else {
            console.error(`✗ Identity mismatch for ${user.role}. Expected: ${user.role}, Got: ${me.role}`);
            process.exit(1);
        }
    }

    console.log('\nPhase 1 Completed Successfully!');
}

runPhase1().catch(err => {
    console.error('Fatal error in Phase 1:', err);
    process.exit(1);
});
