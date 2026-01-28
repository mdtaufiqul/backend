
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'taufiqul.developer+12@gmail.com';
    console.log(`Resetting role for ${email}...`);

    const password = 'Password123!';
    const hash = await bcrypt.hash(password, 10);

    try {
        const existingUser = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (!existingUser) {
            console.log('User not found');
            return;
        }

        const user = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                role: 'SYSTEM_ADMIN',
                passwordHash: hash,
                memberships: { deleteMany: {} } // Clear conflicting memberships
            }
        });
        console.log('Success! User reset to SYSTEM_ADMIN with password:', password);
        console.log(user);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
