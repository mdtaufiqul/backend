const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const workflows = await prisma.workflowDefinition.findMany();
    console.log('Workflows in DB:', workflows);
    console.log('Count:', workflows.length);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
