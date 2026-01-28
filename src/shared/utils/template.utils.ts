/**
 * Template Utility Functions
 * Common template rendering and variable replacement functions
 */

export class TemplateUtils {
    /**
     * Replace variables in template string
     * Example: "Hello {{name}}" with { name: "John" } => "Hello John"
     */
    static render(template: string, variables: Record<string, any>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] !== undefined ? String(variables[key]) : match;
        });
    }

    /**
     * Replace variables with custom delimiters
     */
    static renderCustom(
        template: string,
        variables: Record<string, any>,
        startDelimiter: string = '{{',
        endDelimiter: string = '}}'
    ): string {
        const regex = new RegExp(
            `${this.escapeRegex(startDelimiter)}(\\w+)${this.escapeRegex(endDelimiter)}`,
            'g'
        );
        return template.replace(regex, (match, key) => {
            return variables[key] !== undefined ? String(variables[key]) : match;
        });
    }

    /**
     * Extract variable names from template
     */
    static extractVariables(template: string): string[] {
        const matches = template.match(/\{\{(\w+)\}\}/g);
        if (!matches) return [];
        return matches.map(match => match.replace(/\{\{|\}\}/g, ''));
    }

    /**
     * Validate template has all required variables
     */
    static hasAllVariables(template: string, variables: Record<string, any>): boolean {
        const requiredVars = this.extractVariables(template);
        return requiredVars.every(varName => variables[varName] !== undefined);
    }

    /**
     * Get missing variables
     */
    static getMissingVariables(template: string, variables: Record<string, any>): string[] {
        const requiredVars = this.extractVariables(template);
        return requiredVars.filter(varName => variables[varName] === undefined);
    }

    /**
     * Render template with conditional blocks
     * Example: "{{#if premium}}Premium{{/if}}" with { premium: true } => "Premium"
     */
    static renderConditional(template: string, variables: Record<string, any>): string {
        // Handle if blocks
        let result = template.replace(
            /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs,
            (match, condition, content) => {
                return variables[condition] ? content : '';
            }
        );

        // Handle unless blocks
        result = result.replace(
            /\{\{#unless\s+(\w+)\}\}(.*?)\{\{\/unless\}\}/gs,
            (match, condition, content) => {
                return !variables[condition] ? content : '';
            }
        );

        // Replace simple variables
        return this.render(result, variables);
    }

    /**
     * Render template with loops
     * Example: "{{#each items}}{{name}}{{/each}}" with { items: [{name: "A"}, {name: "B"}] } => "AB"
     */
    static renderLoop(template: string, variables: Record<string, any>): string {
        return template.replace(
            /\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs,
            (match, arrayName, itemTemplate) => {
                const array = variables[arrayName];
                if (!Array.isArray(array)) return '';
                return array.map(item => this.render(itemTemplate, item)).join('');
            }
        );
    }

    /**
     * Escape special regex characters
     */
    private static escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Render email template with common variables
     */
    static renderEmail(
        template: string,
        data: {
            recipientName?: string;
            senderName?: string;
            companyName?: string;
            [key: string]: any;
        }
    ): string {
        const defaultVars = {
            recipientName: 'Valued Customer',
            senderName: 'Team',
            companyName: 'Company',
            year: new Date().getFullYear(),
            ...data
        };

        return this.render(template, defaultVars);
    }

    /**
     * Render SMS template (with character limit)
     */
    static renderSMS(
        template: string,
        variables: Record<string, any>,
        maxLength: number = 160
    ): string {
        const rendered = this.render(template, variables);
        if (rendered.length > maxLength) {
            return rendered.substring(0, maxLength - 3) + '...';
        }
        return rendered;
    }
}
