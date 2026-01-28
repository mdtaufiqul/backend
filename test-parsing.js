const { fromZonedTime } = require('date-fns-tz');

function parseDateTime(dateStr, timeStr, timezone) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const localDate = new Date(dateStr);
    console.log(`Initial Date (UTC midnight): ${localDate.toISOString()}`);
    localDate.setHours(hours, minutes, 0, 0);
    console.log(`After setHours (${hours}:${minutes}): ${localDate.toISOString()}`);
    return fromZonedTime(localDate, timezone);
}

const dateStr = "2026-01-12";
const timeStr = "10:00";
const timezone = "America/New_York";

const result = parseDateTime(dateStr, timeStr, timezone);
console.log(`Resulting UTC: ${result.toISOString()}`);

console.log('--- Comparison ---');
console.log('Expected (10 AM NY -> 15 PM UTC): 2026-01-12T15:00:00.000Z');
