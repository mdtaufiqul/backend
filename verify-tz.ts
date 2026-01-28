
import { TimezoneUtils } from './src/shared/utils/timezone.utils';
import { fromZonedTime } from 'date-fns-tz';

const timezone = 'America/New_York';
const dateStr = '2026-01-12';

console.log('--- Testing Verification ---');
console.log(`Timezone: ${timezone}`);
console.log(`DateStr: ${dateStr}`);

try {
    const parsedDate = TimezoneUtils.parseDate(dateStr, timezone);
    console.log(`Parsed Date (UTC): ${parsedDate.toISOString()}`);

    const bounds = TimezoneUtils.getDayBoundsInUTC(parsedDate, timezone);
    console.log(`Day Start (UTC): ${bounds.start.toISOString()}`);
    console.log(`Day End (UTC): ${bounds.end.toISOString()}`);

    // Check specific appointments
    const apptDate1 = new Date('2026-01-12T04:00:00.000Z');
    console.log(`Appt 1 (04:00Z): ${apptDate1.toISOString()} >= Start? ${apptDate1 >= bounds.start}`);

    // Test raw fromZonedTime
    const raw = fromZonedTime('2026-01-12 00:00', timezone);
    console.log(`Raw fromZonedTime: ${raw.toISOString()}`);

} catch (error) {
    console.error('Error:', error);
}
