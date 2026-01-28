import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const workflows = await prisma.workflowDefinition.findMany({
        select: {
            id: true,
            name: true,
            triggerType: true,
            patientType: true,
            formId: true,
            isActive: true
        }
    });
    console.log(JSON.stringify(workflows, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
