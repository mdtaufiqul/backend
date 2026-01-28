import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database with Multi-Clinic Support and Default Templates...');

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('password123', saltRounds);

    // 1. Create a Clinic
    const mainClinic = await prisma.clinic.upsert({
        where: { id: 'test-clinic-id' },
        update: {},
        create: {
            id: 'test-clinic-id',
            name: 'Global Health Clinic',
            address: '123 Multi-Clinic Way, Health City',
            phone: '555-0100',
            timezone: 'America/New_York'
        }
    });

    console.log('Clinic created:', mainClinic.name);

    // Helper for Upsert Logic (since email is not unique anymore)
    async function upsertUser(email: string, createData: any) {
        const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
        if (existing) {
            return prisma.user.update({ where: { id: existing.id }, data: createData });
        }
        return prisma.user.create({ data: createData });
    }

    // 2. Create Clinic Admin
    await upsertUser('admin@globalclinic.com', {
        name: 'Chief Admin',
        email: 'admin@globalclinic.com',
        passwordHash: passwordHash,
        role: 'clinic_admin',
        clinicId: mainClinic.id
    });

    // 3. Create Clinic Representative
    await upsertUser('rep@globalclinic.com', {
        name: 'Representative Sarah',
        email: 'rep@globalclinic.com',
        passwordHash: passwordHash,
        role: 'clinic_representative',
        clinicId: mainClinic.id
    });

    // 4. Create Clinic-owned Doctor
    await upsertUser('dr.clinic@globalclinic.com', {
        name: 'Dr. Clinic Smith',
        email: 'dr.clinic@globalclinic.com',
        passwordHash: passwordHash,
        role: 'doctor',
        clinicId: mainClinic.id,
        specialties: ['General Medicine'],
        schedule: {
            days: [
                { day: 'Mon', active: true, slots: [{ start: '09:00', end: '17:00', type: 'in-person' }] },
                { day: 'Tue', active: true, slots: [{ start: '09:00', end: '17:00', type: 'in-person' }] },
                { day: 'Wed', active: true, slots: [{ start: '09:00', end: '17:00', type: 'in-person' }] },
                { day: 'Thu', active: true, slots: [{ start: '09:00', end: '17:00', type: 'in-person' }] },
                { day: 'Fri', active: true, slots: [{ start: '09:00', end: '17:00', type: 'in-person' }] }
            ],
            slotDuration: 30
        }
    });

    // 5. Create Solo Doctor (Backward Compatibility)
    await upsertUser('dr.solo@mediflow.com', {
        name: 'Dr. Solo Practitioner',
        email: 'dr.solo@mediflow.com',
        passwordHash: passwordHash,
        role: 'doctor',
        clinicId: null, // No clinic
        specialties: ['Psychiatry'],
        schedule: {
            days: [
                { day: 'Mon', active: true, slots: [{ start: '10:00', end: '16:00', type: 'in-person' }] }
            ],
            slotDuration: 60
        }
    });

    // 6. Create services for the clinic
    const services = [
        { name: 'Initial Consultation', description: 'Service provided to new clients', duration: '60 Minutes', price: 150.0 },
        { name: 'Routine Checkup', description: 'Service provided to returning clients', duration: '30 Minutes', price: 80.0 },
    ];

    for (const service of services) {
        await prisma.service.create({
            data: {
                ...service,
                // We'll need to link services to clinics/doctors later if needed, 
                // but for now keeping them global or mapping in appointments.
            }
        });
    }

    // 7. Create Default System Email Templates (Requested Feature)
    // Categories: APPOINTMENT, REMINDER, FOLLOW_UP, etc.
    // Logic: Online uses {{meetingLink}}, Offline passes empty link/shows location.

    // NOTE: Workflow Orchestration logic handles conditional replacement for us 
    // (e.g. if type != video, {{meetingLink}} is removed).
    // So we can put both in the template with labelling if needed, OR just use the specific variables.

    const defaultTemplates = [
        {
            name: 'Appointment Confirmation',
            category: 'APPOINTMENT',
            subject: 'Appointment Confirmed - {{appointmentDate}} at {{appointmentTime}}',
            bodyText: `Hi {{patientName}},

Your appointment with {{doctorName}} has been confirmed for {{appointmentDate}} at {{appointmentTime}}.

Type: {{appointmentType}}

{{meetingLink}}
{{clinicAddress}}
{{mapLink}}

Use this link to manage your booking: {{confirmLink}}`,
            bodyHtml: `<h3>Appointment Confirmed</h3>
<p>Hi {{patientName}},</p>
<p>Your appointment with <strong>{{doctorName}}</strong> has been confirmed.</p>
<ul>
  <li><strong>Date:</strong> {{appointmentDate}}</li>
  <li><strong>Time:</strong> {{appointmentTime}}</li>
  <li><strong>Type:</strong> {{appointmentType}}</li>
</ul>
<p>
  {{meetingLink}}
  {{clinicAddress}}
  {{mapLink}}
</p>
<p>
  <a href="{{confirmLink}}">Manage Booking</a>
</p>
`
        },
        {
            name: '24 Hour Reminder',
            category: 'REMINDER',
            subject: 'Reminder: Appointment Tomorrow at {{appointmentTime}}',
            bodyText: `Hi {{patientName}},

This is a reminder for your appointment tomorrow, {{appointmentDate}} at {{appointmentTime}} with {{doctorName}}.

{{meetingLink}}
{{clinicAddress}}
{{mapLink}}

See you soon!`,
            bodyHtml: `<p>Hi {{patientName}},</p>
<p>This is a polite reminder about your appointment tomorrow.</p>
<ul>
    <li><strong>Date:</strong> {{appointmentDate}}</li>
    <li><strong>Time:</strong> {{appointmentTime}}</li>
    <li><strong>Doctor:</strong> {{doctorName}}</li>
</ul>
<p>
  {{meetingLink}}
  {{clinicAddress}}
  {{mapLink}}
</p>
<p>See you soon!</p>`
        },
        {
            name: '1 Hour Reminder',
            category: 'REMINDER',
            subject: 'Starting Soon: Appointment in 1 Hour',
            bodyText: `Hi {{patientName}},

Your appointment with {{doctorName}} is starting in 1 hour ({{appointmentTime}}).

{{meetingLink}}
{{clinicAddress}}
{{mapLink}}

Please be ready.`,
            bodyHtml: `<p>Hi {{patientName}},</p>
<p>Your appointment is starting in <strong>1 hour</strong>.</p>
<p>
  {{meetingLink}}
  {{clinicAddress}}
  {{mapLink}}
</p>
<p>Please be ready.</p>`
        },
        {
            name: 'Appointment Rescheduled',
            category: 'APPOINTMENT',
            subject: 'Appointment Rescheduled to {{appointmentDate}}',
            bodyText: `Hi {{patientName}},

Your appointment has been successfully rescheduled to {{appointmentDate}} at {{appointmentTime}}.

{{meetingLink}}
{{clinicAddress}}
{{mapLink}}`,
            bodyHtml: `<p>Hi {{patientName}},</p>
<p>Your appointment has been successfully rescheduled.</p>
<p><strong>New Time:</strong> {{appointmentDate}} at {{appointmentTime}}</p>
<p>
  {{meetingLink}}
  {{clinicAddress}}
  {{mapLink}}
</p>`
        },
        {
            name: 'Appointment Cancelled',
            category: 'APPOINTMENT',
            subject: 'Appointment Cancelled',
            bodyText: `Hi {{patientName}},

Your appointment with {{doctorName}} on {{appointmentDate}} has been cancelled.

If you did not request this, please contact us immediately.`,
            bodyHtml: `<p>Hi {{patientName}},</p>
<p>Your appointment with {{doctorName}} on {{appointmentDate}} has been <strong>cancelled</strong>.</p>
<p>If you did not request this, please contact us immediately.</p>`
        },
        {
            name: 'Post-Appointment Follow-up',
            category: 'FOLLOW_UP',
            subject: 'How was your visit?',
            bodyText: `Hi {{patientName}},

Thank you for visiting {{doctorName}} today. We hope everything went well.

If you have any follow-up questions, please reply to this email.`,
            bodyHtml: `<p>Hi {{patientName}},</p>
<p>Thank you for seeing {{doctorName}} today. We hope everything went well.</p>
<p>If you have any follow-up questions, please reply to this email.</p>`
        }
    ];

    console.log('Seeding Default Email Templates...');
    for (const tmpl of defaultTemplates) {
        // Upsert by name to avoid duplicates on re-run
        // We need an ID for upsert, or use findFirst + update/create logic manually if name isn't unique in schema (it might not be)
        const existing = await prisma.emailTemplate.findFirst({ where: { name: tmpl.name } });
        if (!existing) {
            await prisma.emailTemplate.create({
                data: {
                    name: tmpl.name,
                    category: tmpl.category,
                    subject: tmpl.subject,
                    bodyText: tmpl.bodyText,
                    bodyHtml: tmpl.bodyHtml,
                    variables: ['patientName', 'doctorName', 'appointmentDate', 'appointmentTime'], // Simplified list
                }
            });
            console.log(`Created Template: ${tmpl.name}`);
        } else {
            console.log(`Skipped Template (Exists): ${tmpl.name}`);
        }
    }

    console.log('Seeding completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
