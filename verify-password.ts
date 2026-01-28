import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'dr.solo@mediflow.com';
    console.log(`Checking password for ${email}...`);

    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!user) {
        console.log("User not found!");
        return;
    }

    const candidates = ['password', 'password123', 'admin', 'mediflow', 'dr.solo'];
    let found = false;

    for (const pass of candidates) {
        const isValid = await bcrypt.compare(pass, user.passwordHash || '');
        if (isValid) {
            console.log(`SUCCESS: Password is '${pass}'`);
            found = true;
            break;
        }
    }

    if (!found) {
        console.log("Password check failed for common candidates. Resetting to 'password'...");
        const newHash = await bcrypt.hash('password', 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newHash }
        });
        console.log("Reset complete. Password is now 'password'.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
