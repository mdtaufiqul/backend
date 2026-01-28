/**
 * Currency Utility Functions
 * Common currency formatting and conversion functions
 */

export class CurrencyUtils {
    /**
     * Format amount as currency
     */
    static format(
        amount: number,
        currency: string = 'USD',
        locale: string = 'en-US'
    ): string {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    /**
     * Format amount with custom options
     */
    static formatCustom(
        amount: number,
        options: {
            currency?: string;
            locale?: string;
            minimumFractionDigits?: number;
            maximumFractionDigits?: number;
        } = {}
    ): string {
        const {
            currency = 'USD',
            locale = 'en-US',
            minimumFractionDigits = 2,
            maximumFractionDigits = 2
        } = options;

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits,
            maximumFractionDigits
        }).format(amount);
    }

    /**
     * Parse currency string to number
     */
    static parse(currencyString: string): number {
        // Remove currency symbols and commas
        const cleaned = currencyString.replace(/[^0-9.-]+/g, '');
        return parseFloat(cleaned);
    }

    /**
     * Convert cents to dollars
     */
    static centsToDollars(cents: number): number {
        return cents / 100;
    }

    /**
     * Convert dollars to cents
     */
    static dollarsToCents(dollars: number): number {
        return Math.round(dollars * 100);
    }

    /**
     * Calculate percentage
     */
    static calculatePercentage(amount: number, percentage: number): number {
        return (amount * percentage) / 100;
    }

    /**
     * Calculate discount
     */
    static applyDiscount(amount: number, discountPercentage: number): number {
        const discount = this.calculatePercentage(amount, discountPercentage);
        return amount - discount;
    }

    /**
     * Calculate tax
     */
    static applyTax(amount: number, taxPercentage: number): number {
        const tax = this.calculatePercentage(amount, taxPercentage);
        return amount + tax;
    }

    /**
     * Round to 2 decimal places
     */
    static round(amount: number, decimals: number = 2): number {
        return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    /**
     * Get currency symbol
     */
    static getSymbol(currency: string, locale: string = 'en-US'): string {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        })
            .format(0)
            .replace(/\d/g, '')
            .trim();
    }

    /**
     * Format as compact currency (e.g., $1.2K, $3.4M)
     */
    static formatCompact(amount: number, currency: string = 'USD', locale: string = 'en-US'): string {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            notation: 'compact',
            compactDisplay: 'short'
        }).format(amount);
    }
}
