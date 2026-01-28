
import { ApiClient } from './api-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const client = new ApiClient('http://127.0.0.1:3005/api');
const timestamp = Date.now();
jest.setTimeout(60000);

describe('AI Intake Copilot', () => {
    let doctor: any;
    let patient: any;
    let clinic: any;
    let appointmentId: string;
    let intakeToken: string;

    beforeAll(async () => {
        // Register SaaS Owner & Login
        const saasOwner = { name: 'Super Owner', email: `saas_intake_${timestamp}@mediflow.test`, password: 'Password123!', role: 'SAAS_OWNER' };
        await client.post('/auth/register', saasOwner);

        // Force Activate
        const user = await prisma.user.findFirst({ where: { email: saasOwner.email } });
        if (user) {
            await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
            const account = await prisma.account.findUnique({ where: { email: saasOwner.email } });
            if (account) await prisma.account.update({ where: { id: account.id }, data: { isEmailVerified: true, isActive: true } });
        }
        await client.login(saasOwner.email, saasOwner.password);

        // Create Clinic
        clinic = await client.post('/clinics', { name: `Intake Clinic ${timestamp}`, address: '123 Test St' });

        // Create Doctor
        doctor = await client.post('/users', {
            name: 'Dr. AI',
            email: `dr_ai_${timestamp}@mediflow.test`,
            password: 'Password123!',
            role: 'DOCTOR',
            clinicId: clinic.id,
            specialties: ['General']
        });

        // Force Activate Doctor
        const drUser = await prisma.user.findFirst({ where: { email: doctor.email } });
        if (drUser) {
            await prisma.user.update({ where: { id: drUser.id }, data: { status: 'ACTIVE' } });
            const drAccount = await prisma.account.findUnique({ where: { email: doctor.email } });
            if (drAccount) await prisma.account.update({ where: { id: drAccount.id }, data: { isEmailVerified: true, isActive: true } });
        }
    });

    afterAll(async () => {
        await prisma.intakeSession.deleteMany();
        // await prisma.appointment.deleteMany({ where: { clinicId: clinic.id } });
        await prisma.$disconnect();
    });

    it('1. Create Appointment', async () => {
        // Login as Doctor
        await client.login(doctor.email, 'Password123!');

        // Create Patient
        patient = await client.post('/patients', {
            name: 'Intake Patient',
            email: `pat_intake_${timestamp}@test.com`,
            phone: '+15550999',
            clinicId: clinic.id
        });

        // Create Appt
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const res = await client.post('/appointments', {
            patientId: patient.id,
            doctorId: doctor.id,
            clinicId: clinic.id,
            date: tomorrow.toISOString(),
            type: 'in-person'
        });

        appointmentId = res.result ? res.result.id : res.id;
        expect(appointmentId).toBeDefined();
    });

    it('2. Start Intake Session (Generate Token)', async () => {
        const res = await client.post('/intake/start', { appointmentId });
        expect(res.token).toBeDefined();
        intakeToken = res.token;
        console.log('Intake Token:', intakeToken);
    });

    it('3. Chat with AI (Mocked)', async () => {
        const res = await client.post('/intake/chat', { token: intakeToken, content: "I have a headache." });
        expect(res.messages).toBeDefined();
        const lastMsg = res.messages[res.messages.length - 1];
        expect(lastMsg.role).toBe('assistant');
        // AI Service mock should respond with specific text
        expect(lastMsg.content).toContain('How long');
    });

    it('4. Continue Chat', async () => {
        const res = await client.post('/intake/chat', { token: intakeToken, content: "For 3 days." });
        const lastMsg = res.messages[res.messages.length - 1];
        expect(lastMsg.content).toContain('scale of 1 to 10');
    });

    it('5. Finalize Session & Check Summary', async () => {
        const res = await client.post('/intake/finish', { token: intakeToken });
        expect(res.summary).toContain('[MOCK SUMMARY]');
        expect(res.summary).toContain('tension headache');

        // Check DB for Session Status
        const session = await prisma.intakeSession.findUnique({ where: { token: intakeToken } });
        expect(session!.status).toBe('COMPLETED');
        expect(session!.summary).toBeDefined();

        // Check Appointment Notes
        const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
        expect(appt!.notes).toContain('[AI INTAKE SUMMARY]');
    });
});
