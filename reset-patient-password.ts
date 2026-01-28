import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPassword() {
    const email = 'taufiqul.developer+55@gmail.com';
    const newPassword = 'Patient123!';

    console.log(`🔍 Finding user: ${email}`);

    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!user) {
        console.error('❌ User not found!');
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword }
    });

    console.log(`✅ Password updated successfully!`);
    console.log(`   Email: ${email}`);
    console.log(`   New Password: ${newPassword}`);

    await prisma.$disconnect();
}

resetPassword().catch(console.error);
