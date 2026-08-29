# PATCH A2: Fix `validateRequest` Discarding Parsed Output

## 1. Issue Overview
- **Finding ID**: Audit High Finding #2 (Track A — A2)
- **File**: [`src/middleware/validateRequest.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/middleware/validateRequest.ts)
- **Problem**: The middleware was executing `await schema.parseAsync({ body: req.body, query: req.query, params: req.params })` solely for validation side-effects without assigning the transformed `parsed` result back to `req.body`, `req.query`, and `req.params`. As a result, all Zod transformations, type coercions (`z.preprocess` / `z.coerce`), and default values (`.default(...)`) were discarded, causing controllers and services to receive raw strings instead of `Date` objects and `undefined` instead of defaulted arrays/booleans.

---

## 2. Changes Applied

In [`src/middleware/validateRequest.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/middleware/validateRequest.ts), the parsed output is now re-assigned to `req.body`, `req.query`, and `req.params`:

```typescript
// src/middleware/validateRequest.ts
import { Request, Response, NextFunction } from "express";

interface ValidationSchema {
  parseAsync(data: unknown): Promise<unknown>;
}

export const validateRequest = (schema: ValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = (parsed as any).body ?? req.body;
      req.query = (parsed as any).query ?? req.query;
      req.params = (parsed as any).params ?? req.params;
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

---

## 3. Schema Verification Results

Each of the 8 target schemas was tested with inputs omitting defaulted fields or passing ISO date strings to confirm that `validateRequest` passes the coerced/defaulted data to downstream controllers and services:

| # | Schema File | Field(s) | Input Value | Expected Output | Status |
|---|-------------|----------|-------------|-----------------|:------:|
| 1 | `assessments.schema.ts` | `deadline` | `"2026-09-15T23:59:59.000Z"` | Real `Date` instance | ✅ PASS |
| 2 | `field.schema.ts` | `bookingDate`, `startTime`, `endTime` | `"2026-10-01"`, `"2026-10-01T14:00:00Z"`, `"2026-10-01T16:00:00Z"` | Real `Date` instances (ready for date math) | ✅ PASS |
| 3 | `calendar.schema.ts` | `startDate`, `isGlobal`, `targetFaculties`, `targetDepartments` | `startDate: "2026-09-01"`, omitted defaults | `startDate` is `Date`, `isGlobal: false`, arrays default to `[]` | ✅ PASS |
| 4 | `event.schema.ts` | `eventDate` | `"2026-11-20T10:00:00.000Z"` | Real `Date` instance | ✅ PASS |
| 5 | `alumni.schema.ts` | `skills` | *(omitted)* | `[]` (empty array) | ✅ PASS |
| 6 | `notice.schema.ts` | `copyTo` | *(omitted)* | `[]` (empty array) | ✅ PASS |
| 7 | `resources.schema.ts` | `isStudentNote` | *(omitted)* | `false` (boolean) | ✅ PASS |
| 8 | `reviews.schema.ts` | `isAnonymous` | *(omitted)* | `true` (boolean) | ✅ PASS |

---

## 4. Test Execution Details

```json
[
  {
    "test": "1. assessments.schema.ts (deadline is Date)",
    "passed": true,
    "isDate": true,
    "value": "2026-09-15T23:59:59.000Z"
  },
  {
    "test": "2. field.schema.ts (bookingDate, startTime, endTime are Dates)",
    "passed": true,
    "bookingDateIsDate": true,
    "startTimeIsDate": true,
    "endTimeIsDate": true
  },
  {
    "test": "3. calendar.schema.ts (startDate is Date, defaults applied)",
    "passed": true,
    "startDateIsDate": true,
    "isGlobal": false,
    "targetFaculties": []
  },
  {
    "test": "4. event.schema.ts (eventDate is Date)",
    "passed": true,
    "eventDateIsDate": true
  },
  {
    "test": "5. alumni.schema.ts (skills defaults to [])",
    "passed": true,
    "skills": []
  },
  {
    "test": "6. notice.schema.ts (copyTo defaults to [])",
    "passed": true,
    "copyTo": []
  },
  {
    "test": "7. resources.schema.ts (isStudentNote defaults to false)",
    "passed": true,
    "isStudentNote": false
  },
  {
    "test": "8. reviews.schema.ts (isAnonymous defaults to true)",
    "passed": true,
    "isAnonymous": true
  }
]
```
