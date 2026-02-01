
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const messages = await prisma.message.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { conversation: { select: { doctorId: true, patientId: true } } }
  });
  console.log(JSON.stringify(messages, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
