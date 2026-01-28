
import { ApiClient } from './api-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const client = new ApiClient();
const timestamp = Date.now();
jest.setTimeout(60000);

describe('Smart Waitlist Automation', () => {
    let doctor: any;
    let patientA: any; // The one who cancels
    let patientB: any; // The one on waitlist
    let clinic: any;
    let service: any;
    let appointmentId: string;
    let saasOwner: any;

    beforeAll(async () => {
        // console.log('Initializing Test Environment...');

        // 1. Register SaaS Owner
        saasOwner = { name: 'Super Owner', email: `saas_wl_${timestamp}@mediflow.test`, password: 'Password123!', role: 'SAAS_OWNER' };
        await client.post('/auth/register', saasOwner);

        // FORCE ACTIVATE USER
        const user = await prisma.user.findFirst({ where: { email: saasOwner.email } });
        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { status: 'ACTIVE' }
            });
            // Also update Account if exists (just in case)
            const account = await prisma.account.findUnique({ where: { email: saasOwner.email } });
            if (account) {
                await prisma.account.update({ where: { id: account.id }, data: { isEmailVerified: true, isActive: true } });
            }
        }

        // Login
        await client.login(saasOwner.email, saasOwner.password);

        // 2. Create Clinic
        clinic = await client.post('/clinics', { name: `Waitlist Clinic ${timestamp}`, address: '123 Test St' });

        // 3. Create Doctor
        const drData = {
            name: 'Dr. Waitlist',
            email: `dr_wl_${timestamp}@mediflow.test`,
            password: 'Password123!',
            role: 'DOCTOR',
            clinicId: clinic.id,
            specialties: ['General']
        };
        const drResp = await client.post('/users', drData);
        doctor = drResp;

        // Force Activate Doctor
        const drUser = await prisma.user.findFirst({ where: { email: doctor.email } });
        if (drUser) {
            await prisma.user.update({ where: { id: drUser.id }, data: { status: 'ACTIVE' } });
            // Account check
            const drAccount = await prisma.account.findUnique({ where: { email: doctor.email } });
            if (drAccount) {
                await prisma.account.update({ where: { id: drAccount.id }, data: { isEmailVerified: true, isActive: true } });
            }
        }

        // 4. Create Service
        const serviceResp = await client.post('/services', {
            name: 'General Checkup',
            duration: '30',
            price: 50,
            clinicId: clinic.id,
            doctorId: doctor.id
        });
        service = serviceResp;

        // 5. Create Patients (as SaaS Owner)
        patientA = await client.post('/patients', {
            name: 'Patient A (Cancels)',
            email: `pat_a_${timestamp}@test.com`,
            phone: '+15550101',
            clinicId: clinic.id
        });

        patientB = await client.post('/patients', {
            name: 'Patient B (Waitlist)',
            email: `pat_b_${timestamp}@test.com`,
            phone: '+15550102',
            clinicId: clinic.id
        });

        // Login as Doctor for Appointment Operations
        await client.login(doctor.email, 'Password123!');
    });

    afterAll(async () => {
        await prisma.waitlistOffer.deleteMany();
        // await prisma.appointment.deleteMany({ where: { doctorId: doctor.id }});
        await prisma.$disconnect();
    });

    it('1. Setup: Book Appointment for Patient A', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);

        const res = await client.post('/appointments', {
            patientId: patientA.id,
            doctorId: doctor.id,
            clinicId: clinic.id,
            serviceId: service.id,
            date: tomorrow.toISOString(),
            type: 'in-person'
        });

        expect(res.id).toBeDefined();
        appointmentId = res.id;

        console.log(`Created Appointment ${appointmentId} for Patient A`);
    });

    it('2. Setup: Add Patient B to Waitlist', async () => {
        const res = await client.post('/appointments', {
            patientId: patientB.id,
            doctorId: doctor.id,
            clinicId: clinic.id,
            serviceId: service.id,
            date: new Date().toISOString(),
            status: 'waitlist',
            priority: 1,
            waitlistAddedAt: new Date().toISOString()
        });

        expect(res.status).toBe('waitlist');
        console.log(`Added Patient B to Waitlist`);
    });

    it('3. Trigger: Cancel Patient A Appointment', async () => {
        const res = await client.patch(`/appointments/${appointmentId}`, {
            status: 'cancelled'
        });

        expect(res.status).toBe('cancelled');
        console.log('Cancelled Appointment. Waiting for async waitlist processing...');

        await new Promise(r => setTimeout(r, 2000));
    });

    it('4. Verify: Waitlist Offer Created', async () => {
        const offers = await prisma.waitlistOffer.findMany({
            where: { appointmentId: appointmentId }
        });

        expect(offers.length).toBeGreaterThan(0);
        const offer = offers.find(o => o.patientId === patientB.id);
        expect(offer).toBeDefined();
        expect(offer!.status).toBe('PENDING');

        console.log('Found Valid Offer for Patient B:', offer!.token);
        (global as any).offerToken = offer!.token;
    });

    it('5. Action: Claim Slot via Token', async () => {
        const token = (global as any).offerToken;
        const res = await client.get(`/waitlist/claim?token=${token}`);
        expect(res.success).toBe(true);
    });

    it('6. Verify: Appointment Re-booked for Patient B', async () => {
        const appt = await prisma.appointment.findUnique({
            where: { id: appointmentId }
        });

        expect(appt!.status).toBe('scheduled');
        expect(appt!.patientId).toBe(patientB.id);
        expect(appt!.isConfirmed).toBe(true);
    });
});
