
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'taufiqul.developer+30@gmail.com';
    console.log(`Checking logic for: ${email}`);

    // 1. Find User
    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, role: 'DOCTOR' }, // Specifically looking for the Doctor user
        select: {
            id: true,
            role: true,
            accountId: true,
            memberships: true
        }
    });

    if (!user) {
        console.error('User not found');
        return;
    }

    console.log('User found:', { id: user.id, role: user.role, accountId: user.accountId });
    console.log('User memberships:', user.memberships);

    // 2. Replicate getMe logic
    let siblingProfiles: any[] = [];
    if (user.accountId) {
        console.log('Fetching Account...');
        const account = await prisma.account.findUnique({
            where: { id: user.accountId },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        clinicId: true,
                        clinic: { select: { name: true } }
                    }
                }
            }
        });

        if (account) {
            console.log(`Account found: ${account.id}. Users count: ${account.users.length}`);
            account.users.forEach(u => console.log(` - User: ${u.role} (ID: ${u.id})`));

            if (account.users) {
                // Filter out current user
                siblingProfiles = account.users.filter(u => u.id !== user.id).map(u => ({
                    id: u.id, // User ID acting as "Profile ID"
                    role: u.role,
                    clinicId: u.clinicId,
                    type: 'USER', // Distinguish from MEMBER
                    clinic: u.clinic,
                    isSibling: true
                }));
            }
        } else {
            console.error('Account NOT found despite ID existing');
        }
    } else {
        console.log('User has NO accountId');
    }

    console.log('Sibling Profiles Derived:', siblingProfiles);

    const finalMemberships = [...user.memberships, ...siblingProfiles];
    console.log('Final Memberships Array:', finalMemberships);

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
