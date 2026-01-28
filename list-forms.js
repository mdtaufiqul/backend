const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const forms = await prisma.form.findMany();
    console.log(`Total Forms: ${forms.length}`);
    forms.forEach(f => console.log(`- ${f.title} (ID: ${f.id}, Default: ${f.isDefault})`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
