
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
    const email = 'taufiqul.developer+12@gmail.com';
    const newPassword = 'password123';
    const passwordHash = await bcrypt.hash(newPassword, 10);

    console.log(`Resetting password for ${email}...`);

    await prisma.user.updateMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        data: { passwordHash }
    });

    await prisma.account.updateMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        data: { passwordHash }
    });

    console.log('Password reset successfully.');
}

resetPassword()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
