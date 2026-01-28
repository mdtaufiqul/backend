import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listWorkflows() {
    const workflows = await prisma.workflowDefinition.findMany({
        where: { isActive: true }
    });
    console.log(`Found ${workflows.length} active workflows.`);

    workflows.forEach(w => {
        console.log(`Workflow: ${w.name} (Trigger: ${w.triggerType})`);
        const nodes = typeof w.nodes === 'string' ? JSON.parse(w.nodes) : w.nodes;
        nodes.forEach((n: any) => {
            if (n.type === 'action') {
                console.log(`  - Action: ${n.data.actionType}`);
                console.log(`    Subject: ${n.data.subject}`);
                console.log(`    Recipient Logic (Implicit): context.email`);
                // Note: The orchestrator uses context.email hardcoded for email actions.
                // If we want to notify the doctor, we need a way to specify recipient in the workflow (e.g. "DOCTOR").
            }
        });
    });
}

listWorkflows()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
