/**
 * Date Utility Functions
 * Common date manipulation and formatting functions
 */

import { format, parseISO, addDays, addMonths, startOfDay, endOfDay, differenceInDays } from 'date-fns';

export class DateUtils {
    /**
     * Format date to standard display format
     */
    static formatDate(date: Date | string, formatStr: string = 'MMM dd, yyyy'): string {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return format(dateObj, formatStr);
    }

    /**
     * Format date and time
     */
    static formatDateTime(date: Date | string, formatStr: string = 'MMM dd, yyyy HH:mm'): string {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return format(dateObj, formatStr);
    }

    /**
     * Get start of day
     */
    static getStartOfDay(date: Date): Date {
        return startOfDay(date);
    }

    /**
     * Get end of day
     */
    static getEndOfDay(date: Date): Date {
        return endOfDay(date);
    }

    /**
     * Add days to a date
     */
    static addDays(date: Date, days: number): Date {
        return addDays(date, days);
    }

    /**
     * Add months to a date
     */
    static addMonths(date: Date, months: number): Date {
        return addMonths(date, months);
    }

    /**
     * Calculate difference in days
     */
    static daysBetween(date1: Date, date2: Date): number {
        return differenceInDays(date2, date1);
    }

    /**
     * Check if date is in the past
     */
    static isPast(date: Date): boolean {
        return date < new Date();
    }

    /**
     * Check if date is in the future
     */
    static isFuture(date: Date): boolean {
        return date > new Date();
    }

    /**
     * Check if date is today
     */
    static isToday(date: Date): boolean {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    }

    /**
     * Parse ISO string to Date
     */
    static parseISO(dateString: string): Date {
        return parseISO(dateString);
    }

    /**
     * Get day name from date
     */
    static getDayName(date: Date, format: 'long' | 'short' = 'long'): string {
        return date.toLocaleDateString('en-US', { weekday: format });
    }

    /**
     * Get month name from date
     */
    static getMonthName(date: Date, format: 'long' | 'short' = 'long'): string {
        return date.toLocaleDateString('en-US', { month: format });
    }
}
