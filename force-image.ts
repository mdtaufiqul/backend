import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'dr.solo@mediflow.com';
    const knownImage = '/uploads/avatars/b810214b244a13c29ff56151251cb0425.svg'; // From ls output

    console.log(`Forcing image update for ${email} to ${knownImage}...`);

    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!user) {
        console.log("User not found!");
        return;
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { image: knownImage }
    });

    console.log("Update success.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
