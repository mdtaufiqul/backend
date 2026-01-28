
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'taufiqul.developer+12@gmail.com';

    console.log(`Resetting role for ${email}...`);

    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!user) {
        console.error('User not found!');
        process.exit(1);
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'SYSTEM_ADMIN' }
    });

    console.log(`Successfully reset ${email} to SYSTEM_ADMIN`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
