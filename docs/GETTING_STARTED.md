# Getting Started — Urban Renewal OS

## דרישות מקדימות

| תוכנה | גרסה מינימלית | הורדה |
|-------|--------------|-------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm i -g pnpm` |
| Docker Desktop | 4.x | https://www.docker.com/products/docker-desktop |

---

## 1 — Clone + התקנה

```bash
git clone https://github.com/your-org/urban-renewal-os.git
cd "urban-renewal-os"
pnpm install
```

---

## 2 — הגדרת משתני סביבה

```bash
cp .env .env.local
# ערוך .env.local לפי הצורך
```

> ✅ ערכי ברירת המחדל ב-`.env` עובדים עם Docker Compose ללא שינוי.

---

## 3 — הפעלת תשתית (Docker)

```bash
# הפעל PostgreSQL, Redis, RabbitMQ, MinIO
docker compose up -d

# אמת שהכל רץ
docker compose ps
```

---

## 4 — יצירת סכמת DB + Seed

```bash
cd packages/db

# יצור Prisma client
pnpm db:generate

# הרץ migrations
pnpm db:migrate

# טען נתוני demo
pnpm db:seed
```

---

## 5 — הרצת האפליקציות

### כל האפליקציות ביחד (Turborepo):
```bash
pnpm dev
```

### כל אפליקציה בנפרד:
```bash
# CRM (port 3001)
cd apps/crm && pnpm dev

# פורטל דיירים (port 3002)
cd apps/portal && pnpm dev

# אתר שיווקי (port 3000)
cd apps/web && pnpm dev

# API Gateway NestJS (port 4000)
cd services/api-gateway && pnpm start:dev
```

---

## 6 — URLs

| שם | URL |
|----|-----|
| CRM | http://localhost:3001/he |
| פורטל דיירים | http://localhost:3002/he/dashboard |
| אתר שיווקי | http://localhost:3000 |
| API Gateway | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api/docs |
| Prisma Studio | `pnpm db:studio` → http://localhost:5555 |
| MinIO Console | http://localhost:9001 (minioadmin / minioadmin) |

---

## 7 — פרטי כניסה לדמו

**CRM (staff login):**
- אימייל: `admin@opendoor.co.il`
- סיסמה: `demo1234`

**פורטל דיירים (OTP):**
- טלפון: `0501234567`
- OTP מוצג ב-console בסביבת dev

---

## 8 — Build לפרודקשן

```bash
pnpm build      # build כל האפליקציות
pnpm typecheck  # בדיקת TypeScript
```
