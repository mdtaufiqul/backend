/**
 * String Utility Functions
 * Common string manipulation functions
 */

export class StringUtils {
    /**
     * Convert string to slug (URL-friendly)
     */
    static slugify(text: string): string {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    }

    /**
     * Truncate string to specified length
     */
    static truncate(text: string, length: number, suffix: string = '...'): string {
        if (text.length <= length) return text;
        return text.substring(0, length - suffix.length) + suffix;
    }

    /**
     * Capitalize first letter
     */
    static capitalize(text: string): string {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    /**
     * Convert to title case
     */
    static titleCase(text: string): string {
        return text
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Convert to camelCase
     */
    static camelCase(text: string): string {
        return text
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            })
            .replace(/\s+/g, '');
    }

    /**
     * Convert to snake_case
     */
    static snakeCase(text: string): string {
        return text
            .replace(/\W+/g, ' ')
            .split(/ |\B(?=[A-Z])/)
            .map(word => word.toLowerCase())
            .join('_');
    }

    /**
     * Remove HTML tags
     */
    static stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, '');
    }

    /**
     * Generate random string
     */
    static random(length: number = 10): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Check if string is email
     */
    static isEmail(text: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(text);
    }

    /**
     * Check if string is URL
     */
    static isUrl(text: string): boolean {
        try {
            new URL(text);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Mask sensitive data (e.g., email, phone)
     */
    static mask(text: string, visibleChars: number = 4, maskChar: string = '*'): string {
        if (text.length <= visibleChars) return text;
        const visible = text.slice(-visibleChars);
        const masked = maskChar.repeat(text.length - visibleChars);
        return masked + visible;
    }

    /**
     * Extract initials from name
     */
    static getInitials(name: string, maxLength: number = 2): string {
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, maxLength)
            .join('');
    }
}
