# Timezone Documentation

## Critical Requirement: Central Time (America/Chicago)

**ALL date and time displays throughout the application MUST use Central Time (America/Chicago timezone).**

## Why This Matters

When dates are stored in the database as date strings (e.g., "2025-11-07"), JavaScript's `new Date()` constructor may interpret them inconsistently:
- Without timezone specification, the date may be parsed as UTC midnight
- In Central Time, UTC midnight is actually the previous day (6-7 hours behind)
- This causes dates to display incorrectly by one day

## Implementation Guidelines

### ✅ CORRECT: Use formatInTimeZone with America/Chicago

```typescript
import { formatInTimeZone } from 'date-fns-tz';

// For displaying dates from database
formatInTimeZone(new Date(inspection.date + 'T00:00:00'), 'America/Chicago', "MMM d, yyyy")

// For date comparisons
const dayKey = formatInTimeZone(day, 'America/Chicago', 'yyyy-MM-dd');
```

### ✅ CORRECT: Use toZonedTime for date initialization

```typescript
import { toZonedTime } from 'date-fns-tz';

// When fetching from database
const dateInChicago = toZonedTime(`${item.date}T00:00:00`, 'America/Chicago');
```

### ❌ INCORRECT: Using format() or toLocaleDateString() alone

```typescript
// DON'T DO THIS - uses browser's local timezone
format(new Date(inspection.date), "MMM d, yyyy")

// DON'T DO THIS - uses browser's locale
new Date(inspection.date).toLocaleDateString()
```

## Files That Must Use Central Time

All date/time displays in these files have been updated to use Central Time:

1. **src/components/InspectionDetailsDialog.tsx** - Date display, reschedule dates
2. **src/components/CompleteInspectionDialog.tsx** - Inspection date formatting
3. **src/components/DeleteInspectionDialog.tsx** - Inspection date formatting
4. **src/components/UnCompleteInspectionDialog.tsx** - Inspection date formatting
5. **src/components/AddFollowUpDialog.tsx** - Parent inspection date display
6. **src/components/InspectionCalendar.tsx** - All calendar dates
7. **src/components/WeeklyCalendar.tsx** - Week view dates
8. **src/pages/Index.tsx** - Date filtering and comparisons
9. **src/pages/Inspections.tsx** - Table and card date displays
10. **src/pages/Tasks.tsx** - Task inspection dates
11. **src/pages/Analytics.tsx** - Date-based analytics

## Best Practices

1. **Always import formatInTimeZone**: When displaying any date from the database
2. **Always specify 'America/Chicago'**: Never rely on local timezone
3. **Add 'T00:00:00' to date strings**: Ensures consistent parsing when converting date-only strings
4. **Test timezone behavior**: Verify dates display correctly regardless of user's local timezone

## Testing

To verify timezone handling:
1. Check that dates stored as "2025-11-07" display as "November 7, 2025"
2. Verify calendar navigation doesn't shift dates
3. Test from different timezones (PST, EST, UTC) to ensure Central Time is always used
4. Confirm rescheduling maintains correct dates

## Future Development

**REMEMBER**: Any new feature that displays or manipulates dates MUST use:
- `formatInTimeZone()` with `'America/Chicago'` for displays
- `toZonedTime()` with `'America/Chicago'` for date initialization
- Never use bare `format()` from date-fns for database dates
