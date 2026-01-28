
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPatientFiles() {
    const email = 'taufiqul.developer+4949@gmail.com';
    console.log(`Checking for patient with email: ${email}`);

    // 1. Find the patient
    const patient = await prisma.patient.findFirst({
        where: { email: email },
        include: {
            files: true,
            formSubmissions: {
                include: {
                    form: true
                }
            }
        }
    });

    if (!patient) {
        console.log('Patient not found.');
        return;
    }

    console.log(`Found Patient: ${patient.name} (ID: ${patient.id})`);

    // 2. Check PatientFile relation
    console.log('\n--- Patient Files (PatientFile table) ---');
    if (patient.files.length === 0) {
        console.log('No files found in PatientFile table.');
    } else {
        patient.files.forEach(f => {
            console.log(`- [${f.type}] ${f.name} (Size: ${f.size} bytes) - URL: ${f.url}`);
        });
    }

    // 3. Check Form Submissions for any file data (often stored in JSON 'data' field)
    console.log('\n--- Form Submissions ---');
    if (patient.formSubmissions.length === 0) {
        console.log('No form submissions found.');
    } else {
        patient.formSubmissions.forEach(sub => {
            console.log(`Submission ID: ${sub.id} (Form: ${sub.form.title})`);

            // Inspect the JSON data for file-like structures
            // Usually file uploads in forms might be stored as an array of objects in a specific key
            const data = sub.data as Record<string, any>;
            let filesFoundInForm = false;

            Object.entries(data).forEach(([key, value]) => {
                if (Array.isArray(value) && value.length > 0 && IsFileObject(value[0])) {
                    filesFoundInForm = true;
                    console.log(`  Key '${key}' contains ${value.length} file(s):`);
                    value.forEach((v: any) => {
                        console.log(`    - ${v.name} (Size: ${v.size})`);
                    });
                } else if (IsFileObject(value)) {
                    filesFoundInForm = true;
                    console.log(`  Key '${key}' contains a file:`);
                    console.log(`    - ${value.name} (Size: ${value.size})`);
                }
            });

            if (!filesFoundInForm) {
                console.log('  No obvious file structures found in submission data.');
                console.log('  Data keys:', Object.keys(data).join(', '));
            }
        });
    }
}

function IsFileObject(obj: any): boolean {
    return obj && typeof obj === 'object' && (
        (obj.name && obj.size && obj.type) ||
        (obj.originalName && obj.path) ||
        (obj.url && obj.name) // Common patterns
    );
}

checkPatientFiles()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
