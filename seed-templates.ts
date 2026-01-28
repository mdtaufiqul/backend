import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templates = [
    {
        name: 'Appointment Confirmation',
        subject: 'Appointment Confirmed - {{clinicName}}',
        html: `<h1>Appointment Confirmation</h1><p>Dear {{patientName}},</p><p>Your appointment with {{doctorName}} has been confirmed.</p><p><strong>Date:</strong> {{appointmentDate}}</p><p><strong>Time:</strong> {{appointmentTime}}</p><p><strong>For Video Appointments:</strong> <a href="{{meetingLink}}">Click here to join</a></p><p>Please arrive 10 minutes early.</p><p>Best regards,<br>{{clinicName}}</p>`,
        category: 'APPOINTMENT'
    },
    {
        name: '24-Hour Reminder',
        subject: 'Reminder: Appointment Tomorrow at {{clinicName}}',
        html: `<p>Dear {{patientName}},</p><p>This is a reminder for your appointment tomorrow.</p><p><strong>When:</strong> {{appointmentDate}} at {{appointmentTime}}</p><p><strong>With:</strong> {{doctorName}}</p><p>If you need to reschedule, please contact us immediately.</p><p>See you soon,<br>{{clinicName}}</p>`,
        category: 'APPOINTMENT'
    },
    {
        name: 'Morning Reminder',
        subject: 'Appointment Today: {{appointmentTime}}',
        html: `<p>Hi {{patientName}},</p><p>Just a quick reminder about your appointment today at <strong>{{appointmentTime}}</strong>.</p><p>We look forward to seeing you!</p><br><p>{{clinicName}} Team</p>`,
        category: 'APPOINTMENT'
    },
    {
        name: 'Post-Appointment Follow-up',
        subject: 'How was your visit? - {{clinicName}}',
        html: `<p>Dear {{patientName}},</p><p>Thank you for visiting {{clinicName}} today.</p><p>We hope everything went well. If you have any follow-up questions or require further assistance, please reply to this email.</p><p>Take care,<br>{{doctorName}}</p>`,
        category: 'FOLLOW_UP'
    },
    {
        name: 'No-Show Follow-up',
        subject: 'We missed you today - {{clinicName}}',
        html: `<p>Dear {{patientName}},</p><p>We noticed you missed your appointment today with {{doctorName}}.</p><p>We understand things come up. Please reschedule your appointment at your earliest convenience using the link below or by calling us.</p><p>[Reschedule Link]</p><p>Best,<br>{{clinicName}}</p>`,
        category: 'FOLLOW_UP'
    }
];

// Helper to strip HTML for bodyText (simple version)
function stripHtml(html: string) {
    return html.replace(/<[^>]*>?/gm, '');
}

async function main() {
    console.log('--- Seeding Email Templates (Corrected Schema) ---');

    let count = 0;
    for (const t of templates) {
        // Check by name
        const existing = await prisma.emailTemplate.findFirst({
            where: { name: t.name }
        });

        if (!existing) {
            await prisma.emailTemplate.create({
                data: {
                    name: t.name,
                    subject: t.subject,
                    bodyHasHtml: true,
                    bodyHtml: t.html,
                    bodyText: stripHtml(t.html),
                    category: t.category,
                    variables: ['patientName', 'doctorName', 'appointmentDate', 'appointmentTime', 'clinicName']
                }
            });
            console.log(`Created: ${t.name}`);
            count++;
        } else {
            console.log(`Skipped (Exists): ${t.name}`);
        }
    }

    console.log(`\nSeeding Complete. Added ${count} new templates.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
