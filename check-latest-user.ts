import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
            clinic: true
        }
    });

    console.log('Latest User:', JSON.stringify(user, null, 2));
}

main()
    .catch((e) => {
        throw e;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
