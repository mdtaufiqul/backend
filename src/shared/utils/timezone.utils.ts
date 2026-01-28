import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Timezone utility functions for handling appointment scheduling
 * across different timezones.
 */
export class TimezoneUtils {
    /**
     * Convert a UTC date to clinic's local timezone
     * @param date - Date in UTC
     * @param timezone - IANA timezone string (e.g., 'America/New_York')
     * @returns Date object representing the same moment in the clinic's timezone
     */
    static toClinicTime(date: Date, timezone: string): Date {
        return toZonedTime(date, timezone);
    }

    /**
     * Convert a date from clinic's local timezone to UTC for storage
     * @param date - Date in clinic's timezone
     * @param timezone - IANA timezone string
     * @returns Date object in UTC
     */
    static toUTC(date: Date, timezone: string): Date {
        return fromZonedTime(date, timezone);
    }

    /**
     * Get the start and end of a day in the clinic's timezone, converted to UTC
     * This is useful for querying appointments for a specific day
     * @param date - Any date within the desired day
     * @param timezone - IANA timezone string
     * @returns Object with start and end dates in UTC representing the full day in clinic timezone
     */
    static getDayBoundsInUTC(date: Date, timezone: string): { start: Date; end: Date } {
        // Convert to clinic timezone
        const zonedDate = toZonedTime(date, timezone);

        // Get start of day in clinic timezone
        const startLocal = new Date(zonedDate);
        startLocal.setHours(0, 0, 0, 0);

        // Get end of day in clinic timezone
        const endLocal = new Date(zonedDate);
        endLocal.setHours(23, 59, 59, 999);

        // Convert back to UTC for database queries
        return {
            start: fromZonedTime(startLocal, timezone),
            end: fromZonedTime(endLocal, timezone)
        };
    }

    /**
     * Parse a date string and time string in clinic timezone and convert to UTC
     * @param dateStr - Date string (e.g., '2024-01-15')
     * @param timeStr - Time string (e.g., '14:30')
     * @param timezone - IANA timezone string
     * @returns Date object in UTC
     */
    static parseDateTime(dateStr: string, timeStr: string, timezone: string): Date {
        // Construct ISO-like string without offset: "YYYY-MM-DD HH:mm"
        const dateTimeStr = `${dateStr} ${timeStr}`;
        // fromZonedTime treats this string as being in the target timezone
        return fromZonedTime(dateTimeStr, timezone);
    }

    /**
     * Parse a date string in clinic timezone (at midnight)
     * @param dateStr - Date string (e.g., '2024-01-15')
     * @param timezone - IANA timezone string
     * @returns Date object in UTC representing midnight in the clinic's timezone
     */
    static parseDate(dateStr: string, timezone: string): Date {
        return fromZonedTime(`${dateStr} 00:00`, timezone);
    }

    /**
     * Check if two time ranges overlap
     * @param start1 - Start of first range
     * @param end1 - End of first range
     * @param start2 - Start of second range
     * @param end2 - End of second range
     * @returns true if ranges overlap
     */
    static hasOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
        return start1 < end2 && end1 > start2;
    }

    /**
     * Add minutes to a date
     * @param date - Starting date
     * @param minutes - Minutes to add
     * @returns New date with minutes added
     */
    static addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60000);
    }
}
