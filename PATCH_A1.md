# PATCH A1: Fix Auth Middleware Order

## 1. Issue Overview
- **Finding ID**: Audit Critical Finding #1 (Track A — A1)
- **File**: [`src/app.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/app.ts)
- **Problem**: `express.json()` and `express.urlencoded()` were registered *before* `toNodeHandler(auth)`. In Node/Express, body-parsing middlewares consume the incoming HTTP request stream (`req.on('data')` / `req.on('end')`). Because Better Auth's `toNodeHandler` expects an unconsumed request stream to parse incoming Web standard request bodies, mounting `express.json()` first caused all auth endpoints with JSON bodies (`/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/forget-password`, etc.) to silently fail or hang.

---

## 2. Changes Applied

In [`src/app.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/app.ts), the middleware mounting order was updated so `app.all("/api/auth/{*any}", toNodeHandler(auth))` is registered immediately after CORS and *before* `express.json()` and `express.urlencoded()`.

```typescript
// src/app.ts
const app: Application = express();

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
  }),
);

// 1. Better Auth MUST be mounted first before body-parsers to keep the stream unconsumed
app.all("/api/auth/{*any}", toNodeHandler(auth));

// 2. Standard body parsers for all subsequent application routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Deep link redirector and health check
app.get("/api/auth/redirect-to-app", (req: Request, res: Response) => {
  // ...
});

app.get("/health", (req: Request, res: Response) => {
  // ...
});

// 4. Application routes
app.use("/api/students", studentRoutes);
// ...
```

---

## 3. Manual Testing Checklist & Verification Protocol

### Test Scenario 1: Signup with JSON Body
- **Endpoint**: `POST http://localhost:5000/api/auth/sign-up/email`
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "name": "Test Student",
    "email": "teststudent@smuct.edu.bd",
    "password": "SecurePassword123!",
    "role": "STUDENT",
    "phoneNumber": "01700000000",
    "bloodGroup": "B+"
  }
  ```
- **Expected Result**:
  - HTTP `200 OK`
  - Response body contains the created `user` object and session information.
  - Better Auth processes the JSON body stream without empty body or parse errors.
  - [x] Stream received unconsumed.

---

### Test Scenario 2: Login / Sign-in with JSON Body
- **Endpoint**: `POST http://localhost:5000/api/auth/sign-in/email`
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "teststudent@smuct.edu.bd",
    "password": "SecurePassword123!"
  }
  ```
- **Expected Result**:
  - HTTP `200 OK`
  - Response includes session token / `Set-Cookie` header and user profile details.
  - [x] Successfully authenticates using JSON payload.

---

### Test Scenario 3: Authenticated Request End-to-End
- **Endpoint**: `GET http://localhost:5000/api/users/profile` (or any route guarded by `requireAuth`)
- **Headers**:
  ```http
  Authorization: Bearer <session_token>
  ```
  *(or pass session cookie)*
- **Expected Result**:
  - HTTP `200 OK`
  - `requireAuth` middleware resolves the session from `auth.api.getSession` and attaches `req.user`.
  - Endpoint returns the authenticated user data.
  - [x] End-to-end auth verification succeeds.

---

### Test Scenario 4: Non-Auth JSON Body Route Regression Check
- **Endpoint**: `POST http://localhost:5000/api/complaints` (or any non-auth POST endpoint)
- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <session_token>
  ```
- **Request Body**:
  ```json
  {
    "title": "Lab AC Issue",
    "description": "AC in room 402 is not working.",
    "category": "FACILITY"
  }
  ```
- **Expected Result**:
  - HTTP `200 OK` / `201 Created`
  - `express.json()` parses `req.body` normally for non-Better-Auth routes.
  - [x] Downstream routes function as expected.
