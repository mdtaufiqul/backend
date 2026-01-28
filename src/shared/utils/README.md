# Shared Utilities

This directory contains reusable utility functions that can be used across all modules in the application.

## Philosophy

- **DRY (Don't Repeat Yourself)**: Common functions are centralized here
- **Type-Safe**: All utilities are fully typed with TypeScript
- **Well-Tested**: Each utility should have comprehensive unit tests
- **Module-Agnostic**: Can be used in any module or even other projects

## Available Utilities

### 📅 Date & Time

**File**: `date.utils.ts`

Common date manipulation and formatting functions.

```typescript
import { DateUtils } from '@/shared/utils';

// Format dates
DateUtils.formatDate(new Date(), 'MMM dd, yyyy');
DateUtils.formatDateTime(new Date());

// Date calculations
DateUtils.addDays(new Date(), 7);
DateUtils.daysBetween(date1, date2);

// Date checks
DateUtils.isToday(date);
DateUtils.isPast(date);
DateUtils.isFuture(date);
```

---

### 🌍 Timezone

**File**: `timezone.utils.ts`

Timezone-aware date conversions and calculations.

```typescript
import { TimezoneUtils } from '@/shared/utils';

// Convert between timezones
const utcDate = TimezoneUtils.toUTC(localDate, 'America/New_York');
const localDate = TimezoneUtils.toClinicTime(utcDate, 'America/New_York');

// Get day bounds in UTC
const { start, end } = TimezoneUtils.getDayBoundsInUTC(date, timezone);

// Parse date/time strings
const date = TimezoneUtils.parseDateTime('2026-01-15', '14:30', 'America/New_York');
```

---

### 📝 String

**File**: `string.utils.ts`

String manipulation and formatting functions.

```typescript
import { StringUtils } from '@/shared/utils';

// Case conversion
StringUtils.slugify('Hello World'); // 'hello-world'
StringUtils.titleCase('hello world'); // 'Hello World'
StringUtils.camelCase('hello world'); // 'helloWorld'

// Truncation
StringUtils.truncate('Long text...', 10); // 'Long te...'

// Validation
StringUtils.isEmail('test@example.com'); // true
StringUtils.isUrl('https://example.com'); // true

// Utilities
StringUtils.getInitials('John Doe'); // 'JD'
StringUtils.mask('1234567890', 4); // '******7890'
```

---

### ✅ Validation

**File**: `validation.utils.ts`

Data validation functions.

```typescript
import { ValidationUtils } from '@/shared/utils';

// Email & Phone
ValidationUtils.isValidEmail('test@example.com');
ValidationUtils.isValidPhone('+1234567890');

// Dates
ValidationUtils.isNotPast(futureDate);
ValidationUtils.isDateInRange(date, start, end);

// Security
ValidationUtils.sanitizeHtml('<script>alert("xss")</script>');
const { isValid, errors } = ValidationUtils.isStrongPassword('password123');

// General
ValidationUtils.hasRequiredFields(obj, ['name', 'email']);
ValidationUtils.isValidUUID('123e4567-e89b-12d3-a456-426614174000');
```

---

### 💰 Currency

**File**: `currency.utils.ts`

Currency formatting and calculations.

```typescript
import { CurrencyUtils } from '@/shared/utils';

// Formatting
CurrencyUtils.format(1234.56, 'USD'); // '$1,234.56'
CurrencyUtils.formatCompact(1234567, 'USD'); // '$1.2M'

// Conversion
CurrencyUtils.dollarsToCents(12.34); // 1234
CurrencyUtils.centsToDollars(1234); // 12.34

// Calculations
CurrencyUtils.applyDiscount(100, 20); // 80
CurrencyUtils.applyTax(100, 10); // 110
CurrencyUtils.calculatePercentage(100, 15); // 15
```

---

### 📄 Template

**File**: `template.utils.ts`

Template rendering and variable replacement.

```typescript
import { TemplateUtils } from '@/shared/utils';

// Simple variable replacement
const template = 'Hello {{name}}, welcome to {{company}}!';
TemplateUtils.render(template, { name: 'John', company: 'MediFlow' });
// 'Hello John, welcome to MediFlow!'

// Conditional rendering
const template = '{{#if premium}}Premium User{{/if}}';
TemplateUtils.renderConditional(template, { premium: true });

// Email templates
TemplateUtils.renderEmail(emailTemplate, {
  recipientName: 'John Doe',
  appointmentDate: '2026-01-15'
});

// SMS templates (with length limit)
TemplateUtils.renderSMS(smsTemplate, variables, 160);
```

---

## Usage Guidelines

### Importing Utilities

```typescript
// Import specific utilities
import { DateUtils, StringUtils } from '@/shared/utils';

// Or import all
import * as Utils from '@/shared/utils';
```

### Adding New Utilities

1. Create a new file in `backend/src/shared/utils/`
2. Export a class with static methods
3. Add export to `index.ts`
4. Write unit tests
5. Update this README

### Naming Conventions

- **File names**: `kebab-case.utils.ts`
- **Class names**: `PascalCase` + `Utils` suffix
- **Method names**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Best Practices

✅ **DO**:
- Keep functions pure (no side effects)
- Add JSDoc comments
- Handle edge cases
- Return consistent types
- Write unit tests

❌ **DON'T**:
- Add module-specific logic
- Use external dependencies unnecessarily
- Mutate input parameters
- Throw errors without documentation

---

## Testing

Each utility file should have a corresponding test file:

```
utils/
├── date.utils.ts
├── date.utils.spec.ts      # Tests for date utils
├── string.utils.ts
├── string.utils.spec.ts    # Tests for string utils
└── ...
```

Run tests:
```bash
npm test -- shared/utils
```

---

## Module Reusability

These utilities are designed to be **project-agnostic**. They can be:

1. **Copied** to other projects
2. **Published** as an npm package
3. **Shared** via monorepo

Example usage in a law firm app:
```typescript
// Same utilities, different context
import { DateUtils, StringUtils } from '@/shared/utils';

const caseNumber = StringUtils.slugify(caseName);
const hearingDate = DateUtils.formatDate(hearing.date);
```

---

## Future Additions

Planned utilities:

- [ ] `array.utils.ts` - Array manipulation
- [ ] `object.utils.ts` - Object operations
- [ ] `file.utils.ts` - File handling
- [ ] `crypto.utils.ts` - Encryption/hashing
- [ ] `number.utils.ts` - Number formatting
- [ ] `color.utils.ts` - Color manipulation
- [ ] `geo.utils.ts` - Geolocation utilities

---

## Contributing

When adding new utilities:

1. Ensure they're truly reusable
2. Add comprehensive JSDoc
3. Include usage examples
4. Write unit tests
5. Update this README

---

## License

These utilities are part of the MediFlow project and follow the same license.
