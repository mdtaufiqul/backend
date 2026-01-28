import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: 'dr.solo@mediflow.com', mode: 'insensitive' } },
    select: { id: true, name: true, email: true, role: true, clinicId: true }
  });

  console.log('User details:', user);

  await prisma.$disconnect();
}

checkUser();
