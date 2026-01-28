
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst();
    if (!user) {
        console.log("No user found");
        return;
    }
    console.log("User Schedule for:", user.email);
    console.log(JSON.stringify(user.schedule, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
