
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserRoles() {
    const email = 'taufiqul.developer+12@gmail.com';

    console.log(`Checking roles for ${email}...`);

    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {
            clinic: true,
            memberships: {
                include: {
                    clinic: true
                }
            }
        }
    });

    if (!user) {
        console.log('User not found.');
        return;
    }

    console.log('Primary Identity:');
    console.log(`- ID: ${user.id}`);
    console.log(`- Role: ${user.role}`);
    console.log(`- Clinic: ${user.clinic?.name || 'None'} (${user.clinicId})`);

    console.log('\nMemberships:');
    if (user.memberships.length === 0) {
        console.log('- No memberships found.');
    } else {
        user.memberships.forEach(m => {
            console.log(`- [${m.id}] Role: ${m.role} at ${m.clinic.name} (${m.clinicId})`);
        });
    }
}

checkUserRoles()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
