
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugFormSubmission() {
    const email = 'taufiqul.developer+4949@gmail.com';
    const patient = await prisma.patient.findFirst({
        where: { email },
        include: {
            formSubmissions: true
        }
    });

    if (!patient) {
        console.log('Patient not found');
        return;
    }

    console.log(`Patient ID: ${patient.id}`);

    patient.formSubmissions.forEach(sub => {
        console.log(`\nSubmission ${sub.id}:`);
        const data = sub.data as any;
        Object.keys(data).forEach(key => {
            const val = data[key];
            console.log(`Key: ${key}`);
            console.log(`Value Type: ${typeof val}`);
            if (typeof val === 'object') {
                console.log('Value Content:', JSON.stringify(val, null, 2));
            } else {
                console.log('Value:', val);
            }
            console.log('---');
        });
    });
}

debugFormSubmission()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
