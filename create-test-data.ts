import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestData() {
    console.log('Creating test data for PatientObservation trends...');

    // 1. Get the clinic and doctor created during seed
    const clinic = await prisma.clinic.findFirst({ where: { name: 'Global Health Clinic' } });
    const doctor = await prisma.user.findFirst({ where: { email: 'dr.clinic@globalclinic.com' } });

    if (!clinic || !doctor) {
        throw new Error('Seed data not found. Please run seed first.');
    }

    // 2. Create a test patient
    const patient = await prisma.patient.create({
        data: {
            name: 'John Trendtest',
            email: 'john.trend@example.com',
            clinicId: clinic.id,
            assignedDoctorId: doctor.id,
            dob: new Date('1985-05-15'),
        }
    });

    console.log(`Patient created: ${patient.name} (${patient.id})`);

    // 3. Create a clinical encounter
    const encounter = await prisma.clinicalEncounter.create({
        data: {
            patientId: patient.id,
            clinicId: clinic.id,
            doctorId: doctor.id,
            type: 'Wellness Check',
            status: 'DRAFT',
            subjective: 'Patient here for routine follow-up of vitals tracking.'
        }
    });

    console.log(`Encounter created: ${encounter.id}`);

    // 4. Create historical observations (Weight, HR, BP)
    const types = [
        { type: 'weight', unit: 'kg', base: 75, variance: 2 },
        { type: 'heart_rate', unit: 'bpm', base: 70, variance: 5 },
        { type: 'blood_pressure', unit: 'mmHg', isBP: true, base: 120, variance: 5 }
    ];

    const observations: any[] = [];
    const now = new Date();

    for (const t of types) {
        for (let i = 0; i < 5; i++) {
            const recordedAt = new Date(now.getTime() - (5 - i) * 24 * 60 * 60 * 1000); // Past 5 days
            const value = (t.base + (Math.random() * t.variance * 2) - t.variance).toFixed(1);

            if (t.isBP) {
                const systolic = Math.round(t.base + (Math.random() * t.variance * 2) - t.variance);
                const diastolic = Math.round(80 + (Math.random() * 5 * 2) - 5);
                observations.push({
                    patientId: patient.id,
                    clinicId: clinic.id,
                    recordedByUserId: doctor.id,
                    encounterId: i === 4 ? encounter.id : null, // Link last one to encounter
                    type: t.type,
                    value: `${systolic}/${diastolic}`,
                    unit: t.unit,
                    systolic,
                    diastolic,
                    recordedAt,
                    status: 'FINAL'
                });
            } else {
                observations.push({
                    patientId: patient.id,
                    clinicId: clinic.id,
                    recordedByUserId: doctor.id,
                    encounterId: i === 4 ? encounter.id : null,
                    type: t.type,
                    value: value.toString(),
                    unit: t.unit,
                    recordedAt,
                    status: 'FINAL'
                });
            }
        }
    }

    await prisma.patientObservation.createMany({ data: observations });
    console.log(`Created ${observations.length} historical observations.`);
}

createTestData()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
