
import { ApiClient } from './api-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const client = new ApiClient('http://127.0.0.1:3005/api'); // Target verification server
const timestamp = Date.now();
jest.setTimeout(60000);

describe('Recall Agent', () => {
    let doctor: any;
    let patient: any;
    let clinic: any;
    let opportunityId: string;

    beforeAll(async () => {
        // Setup Account
        const saasOwner = { name: 'Recall Owner', email: `saas_recall_${timestamp}@test.com`, password: 'Password123!', role: 'SAAS_OWNER' };
        await client.post('/auth/register', saasOwner);
        const user = await prisma.user.findFirst({ where: { email: saasOwner.email } });
        if (user) {
            await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
            const acct = await prisma.account.findUnique({ where: { email: saasOwner.email } });
            if (acct) {
                await prisma.account.update({ where: { email: saasOwner.email }, data: { isEmailVerified: true, isActive: true } });
            }
        }
        await client.login(saasOwner.email, saasOwner.password);

        clinic = await client.post('/clinics', { name: `Recall Clinic ${timestamp}`, address: '123 Test St' });
        doctor = await client.post('/users', {
            name: 'Dr. Recall', email: `dr_recall_${timestamp}@test.com`, password: 'Password123!', role: 'DOCTOR', clinicId: clinic.id
        });
        const drUser = await prisma.user.findFirst({ where: { email: doctor.email } });
        if (drUser) {
            await prisma.user.update({ where: { id: drUser.id }, data: { status: 'ACTIVE' } });
            const drAcct = await prisma.account.findUnique({ where: { email: doctor.email } });
            if (drAcct) {
                await prisma.account.update({ where: { email: doctor.email }, data: { isEmailVerified: true, isActive: true } });
            }
        }

        // Seed Patient with OLD appointment
        await client.login(doctor.email, 'Password123!');
        patient = await client.post('/patients', {
            name: 'Recall Candidate', email: `pat_recall_${timestamp}@test.com`, phone: '+15550999', clinicId: clinic.id
        });

        // Create an appointment 7 months ago
        const pastDate = new Date();
        pastDate.setMonth(pastDate.getMonth() - 7);

        await prisma.appointment.create({
            data: {
                doctorId: doctor.id,
                patientId: patient.id,
                clinicId: clinic.id,
                date: pastDate,
                status: 'completed',
                type: 'in-person'
            }
        });
    });

    afterAll(async () => {
        await prisma.recallOpportunity.deleteMany();
        await prisma.$disconnect();
    });

    it('1. Scan for Opportunities', async () => {
        const res = await client.post('/marketing/recall/scan', {});
        expect(res.generated).toBeGreaterThan(0);
        console.log(`Generated ${res.generated} opportunities`);
    });

    it('2. List Opportunities', async () => {
        const res = await client.get('/marketing/recall/opportunities');
        expect(Array.isArray(res)).toBe(true);
        const opp = res.find((o: any) => o.patientId === patient.id);
        expect(opp).toBeDefined();
        expect(opp.status).toBe('PENDING');
        expect(opp.draftMessage).toContain('checkup');
        opportunityId = opp.id;
    });

    it('3. Dismiss Opportunity', async () => {
        await client.post(`/marketing/recall/${opportunityId}/dismiss`, {});
        const res = await client.get('/marketing/recall/opportunities');
        const opp = res.find((o: any) => o.id === opportunityId);
        expect(opp).toBeUndefined(); // Should filter out dismissed by default or change status

        const dbOpp = await prisma.recallOpportunity.findUnique({ where: { id: opportunityId } });
        expect(dbOpp?.status).toBe('DISMISSED');
    });
});
