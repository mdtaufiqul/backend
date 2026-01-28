const date = new Date('2026-01-12T04:00:00Z');
const timezone = 'America/New_York';
const timeStr = date.toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
});
console.log(`Original: ${date.toISOString()}`);
console.log(`Timezone: ${timezone}`);
console.log(`Formatted: "${timeStr}"`); // Quote to see whitespace
