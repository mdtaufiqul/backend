
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const patients = await prisma.patient.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(patients, null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
