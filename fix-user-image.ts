import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'taufiqul.developer+1@gmail.com';
    console.log(`Checking User Image for ${email}...`);
    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (user) {
        console.log(`Image DB Value: '${user.image}'`);
        // Also fix it if it's broken
        if (user.image !== '/uploads/avatars/b810214b244a13c29ff56151251cb0425.svg') {
            const knownImage = '/uploads/avatars/b810214b244a13c29ff56151251cb0425.svg';
            console.log(`Updating to known valid image: ${knownImage}`);
            await prisma.user.update({
                where: { id: user.id },
                data: { image: knownImage }
            });
        }
    } else {
        console.log("User not found");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
