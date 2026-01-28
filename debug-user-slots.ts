
import { PrismaClient } from '@prisma/client';
import { AppointmentsService } from './src/appointments/appointments.service';
import { TimezoneUtils } from './src/shared/utils';

// Mock Gateway/Orchestrator to satisfy dependency but we won't use them (or minimal mock)
const mockGateway = { notifyAppointmentUpdate: () => { } } as any;
const mockOrchestrator = { triggerEvent: async () => { } } as any;

// We need a real service instance to test logic, but let's just use raw prisma queries and logic copy for simplicity 
// in a script, OR verify the data that the service WOULD use.
// actually, let's just query the data.

const prisma = new PrismaClient();

async function main() {
    const targetUserId = '409bd730-c5f3-417b-a679-f2cbd7c94699'; // From User Logs

    console.log(`--- Investigating User ${targetUserId} ---`);
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
        console.log("User NOT FOUND!");
        return;
    }
    console.log(`User Found: ${user.email} (${user.name})`);

    // Check SMTP Config
    const smtp = await prisma.doctorSmtpConfig.findUnique({ where: { userId: targetUserId } });
    if (smtp) {
        console.log("SMTP Config: FOUND");
        console.log(`  Host: ${smtp.host}`);
        console.log(`  User: ${smtp.user}`);
    } else {
        console.log("SMTP Config: MISSING");
    }

    // Check Schedule Data
    console.log("\n--- Schedule Data ---");
    console.log(JSON.stringify(user.schedule, null, 2));

    // Simulate getAvailableSlots Logic for Monday (In-Person only in previous check)
    // Assuming current week or next Monday.
    // Let's pick a Monday. Jan 12 2026 is Monday.
    const date = '2026-01-12';
    console.log(`\n--- Simulating Slots for Monday ${date} (Should be In-Person) ---`);

    const schedule = user.schedule as any;
    const days = (schedule.days || []) as any[];
    const mon = days.find(d => d.day === 'Mon');
    console.log("Monday Schedule:", mon);

    if (mon && mon.active) {
        console.log(`Type: ${mon.type || 'undefined'}`);
        console.log("Slots defined:", mon.slots);

        const typeParam = 'online'; // User says "Select 5 days for online"

        // Slot Logic Simulation
        let generatedSlots: any[] = [];
        if (mon.slots && mon.slots.length > 0) {
            generatedSlots = mon.slots.map((s: any) => ({ ...s, type: normalizeType(s.type || mon.type) }));
        } else {
            generatedSlots.push({ start: mon.start, end: mon.end, type: normalizeType(mon.type) });
        }

        console.log("Generated Pattern:", generatedSlots);

        const filtered = generatedSlots.filter(s => s.type === typeParam || s.type === 'both');
        console.log(`Filtered for '${typeParam}':`, filtered);

        if (filtered.length > 0) {
            console.log("BUG CONFIRMED: Online slots generated for In-Person day.");
        } else {
            console.log("Logic seems correct (No online slots returned). Issue might be Frontend ignoring filter?");
        }
    }
}

function normalizeType(type: string) {
    if (!type) return 'both';
    const t = type.toLowerCase();
    if (t === 'online' || t === 'virtual') return 'online';
    if (t === 'in-person' || t === 'offline' || t === 'inperson') return 'in-person';
    return 'both';
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
