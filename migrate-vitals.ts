import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateVitals() {
    console.log('Starting migration: Vitals -> PatientObservation...');

    const vitals = await prisma.vitals.findMany();
    console.log(`Found ${vitals.length} vitals records to migrate.`);

    const mappings = [
        { key: 'weight', type: 'weight', unit: 'kg' },
        { key: 'height', type: 'height', unit: 'cm' },
        { key: 'bpSystolic', type: 'blood_pressure', isBP: true },
        { key: 'temperature', type: 'temperature', unit: 'Celsius' },
        { key: 'heartRate', type: 'heart_rate', unit: 'bpm' },
        { key: 'respiratoryRate', type: 'respiratory_rate', unit: 'bpm' },
        { key: 'spO2', type: 'spo2', unit: '%' },
    ];

    let count = 0;
    for (const v of vitals) {
        const observations: any[] = [];
        for (const m of mappings) {
            const val = (v as any)[m.key];
            if (val !== undefined && val !== null) {
                if (m.isBP) {
                    if (m.key === 'bpSystolic') {
                        observations.push({
                            patientId: v.patientId,
                            clinicId: v.clinicId,
                            recordedByUserId: v.doctorId,
                            type: 'blood_pressure',
                            value: `${v.bpSystolic}/${v.bpDiastolic || '--'}`,
                            unit: 'mmHg',
                            systolic: v.bpSystolic,
                            diastolic: v.bpDiastolic,
                            recordedAt: v.recordedAt,
                            status: 'FINAL'
                        });
                    }
                } else {
                    observations.push({
                        patientId: v.patientId,
                        clinicId: v.clinicId,
                        recordedByUserId: v.doctorId,
                        type: m.type,
                        value: val.toString(),
                        unit: m.unit,
                        recordedAt: v.recordedAt,
                        status: 'FINAL'
                    });
                }
            }
        }

        if (observations.length > 0) {
            await prisma.patientObservation.createMany({
                data: observations
            });
            count += observations.length;
        }
    }

    console.log(`Migration complete. Created ${count} observations.`);
}

migrateVitals()
    .catch(e => {
        console.error('Migration failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
