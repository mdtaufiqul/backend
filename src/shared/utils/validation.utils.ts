/**
 * Validation Utility Functions
 * Common validation functions for data integrity
 */

export class ValidationUtils {
    /**
     * Validate email format
     */
    static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate phone number (basic)
     */
    static isValidPhone(phone: string): boolean {
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        // Check if it's between 10-15 digits
        return cleaned.length >= 10 && cleaned.length <= 15;
    }

    /**
     * Validate URL format
     */
    static isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate UUID format
     */
    static isValidUUID(uuid: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    /**
     * Validate date is not in the past
     */
    static isNotPast(date: Date): boolean {
        return date >= new Date();
    }

    /**
     * Validate date is within range
     */
    static isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
        return date >= startDate && date <= endDate;
    }

    /**
     * Validate string length
     */
    static isValidLength(text: string, min: number, max: number): boolean {
        return text.length >= min && text.length <= max;
    }

    /**
     * Validate number is within range
     */
    static isNumberInRange(num: number, min: number, max: number): boolean {
        return num >= min && num <= max;
    }

    /**
     * Validate required fields
     */
    static hasRequiredFields<T>(obj: T, fields: (keyof T)[]): boolean {
        return fields.every(field => {
            const value = obj[field];
            return value !== null && value !== undefined && value !== '';
        });
    }

    /**
     * Validate timezone string
     */
    static isValidTimezone(timezone: string): boolean {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Sanitize HTML to prevent XSS
     */
    static sanitizeHtml(html: string): string {
        return html
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Validate JSON string
     */
    static isValidJson(jsonString: string): boolean {
        try {
            JSON.parse(jsonString);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate credit card number (Luhn algorithm)
     */
    static isValidCreditCard(cardNumber: string): boolean {
        const cleaned = cardNumber.replace(/\D/g, '');
        if (cleaned.length < 13 || cleaned.length > 19) return false;

        let sum = 0;
        let isEven = false;

        for (let i = cleaned.length - 1; i >= 0; i--) {
            let digit = parseInt(cleaned.charAt(i), 10);

            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    }

    /**
     * Validate password strength
     */
    static isStrongPassword(password: string): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (!/[!@#$%^&*]/.test(password)) {
            errors.push('Password must contain at least one special character (!@#$%^&*)');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
