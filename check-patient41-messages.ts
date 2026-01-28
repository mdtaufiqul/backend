import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPatient41Messages() {
    console.log('\n=== Checking Patient 41 Messages ===\n');

    // Find Patient 41
    const patient41 = await prisma.user.findFirst({
        where: {
            name: { contains: 'Patient 41', mode: 'insensitive' }
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true
        }
    });

    console.log('Patient 41 User:', patient41);

    if (!patient41) {
        console.log('❌ Patient 41 not found as User');
        return;
    }

    // Check if there's a Patient record
    const patientRecord = await prisma.patient.findFirst({
        where: {
            OR: [
                { name: { contains: 'Patient 41', mode: 'insensitive' } },
                { email: patient41.email }
            ]
        },
        select: {
            id: true,
            name: true,
            email: true,
            assignedDoctorId: true
        }
    });

    console.log('\nPatient Record:', patientRecord);

    // Find conversations involving Patient 41
    const conversations = await prisma.conversation.findMany({
        where: {
            OR: [
                { patientId: patientRecord?.id },
                { doctorId: patient41.id }
            ]
        },
        include: {
            doctor: { select: { id: true, name: true, email: true } },
            patient: { select: { id: true, name: true, email: true } },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    sender: { select: { id: true, name: true, role: true } }
                }
            }
        }
    });

    console.log(`\nFound ${conversations.length} conversations:\n`);

    conversations.forEach((conv, idx) => {
        console.log(`Conversation ${idx + 1}:`);
        console.log(`  ID: ${conv.id}`);
        console.log(`  Doctor: ${conv.doctor?.name || 'None'} (${conv.doctorId})`);
        console.log(`  Patient: ${conv.patient?.name || 'None'} (${conv.patientId})`);
        console.log(`  Type: ${conv.type}`);
        console.log(`  Status: ${conv.status}`);
        console.log(`  Messages: ${conv.messages.length}`);

        if (conv.messages.length > 0) {
            console.log('  Recent messages:');
            conv.messages.forEach(msg => {
                console.log(`    - ${msg.sender?.name || 'Unknown'} (${msg.senderType}): "${msg.content.substring(0, 50)}..." at ${msg.createdAt}`);
            });
        }
        console.log('');
    });

    // Check for messages sent by Patient 41 as a User
    const messagesSentByUser = await prisma.message.findMany({
        where: {
            senderId: patient41.id
        },
        include: {
            conversation: {
                include: {
                    doctor: { select: { name: true } },
                    patient: { select: { name: true } }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    console.log(`\nMessages sent by Patient 41 as User: ${messagesSentByUser.length}`);
    messagesSentByUser.forEach(msg => {
        console.log(`  - To conversation ${msg.conversationId} (Doctor: ${msg.conversation.doctor?.name}, Patient: ${msg.conversation.patient?.name})`);
        console.log(`    Content: "${msg.content.substring(0, 50)}..."`);
        console.log(`    Sent at: ${msg.createdAt}`);
    });

    await prisma.$disconnect();
}

checkPatient41Messages().catch(console.error);
