import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const templates = await prisma.emailTemplate.findMany({
        select: {
            id: true,
            name: true,
            category: true,
            clinicId: true,
            isSystem: true
        }
    });

    console.log('--- Email Templates ---');
    templates.forEach(t => {
        console.log(`ID: ${t.id}, Name: ${t.name}, Category: ${t.category}, ClinicId: ${t.clinicId}, isSystem: ${t.isSystem}`);
    });

    const duplicates = templates.reduce((acc: any, t) => {
        const key = `${t.category}_${t.clinicId}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(t.id);
        return acc;
    }, {});

    console.log('\n--- Duplicate Analysis ---');
    Object.entries(duplicates).forEach(([key, ids]: [string, any]) => {
        if (ids.length > 1) {
            console.log(`Key ${key} has duplicates: ${ids.join(', ')}`);
        }
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
