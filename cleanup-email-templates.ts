import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Email Template Cleanup Started ---');

    // Find all system templates that have a clinicId
    const systemTemplatesWithClinic = await prisma.emailTemplate.findMany({
        where: {
            isSystem: true,
            clinicId: { not: null }
        }
    });

    console.log(`Found ${systemTemplatesWithClinic.length} clinic-specific system templates.`);

    let deletedCount = 0;
    for (const template of systemTemplatesWithClinic) {
        // Check if a global version exists for the same category
        const globalVersion = await prisma.emailTemplate.findFirst({
            where: {
                category: template.category,
                clinicId: null
            }
        });

        if (globalVersion) {
            // If a global version exists, we can safely delete the clinic-specific one
            // unless it has been customized (but isSystem: true usually means it's the default seeded one)
            console.log(`Deleting duplicate system template: ${template.name} for clinic ${template.clinicId}`);
            await prisma.emailTemplate.delete({
                where: { id: template.id }
            });
            deletedCount++;
        }
    }

    console.log(`--- Cleanup Finished: Deleted ${deletedCount} duplicates ---`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
