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

> ✅ ערכי ברירת המחדל ב-`.env` מתאימים להתקנת ה-Windows המתוארת בסעיף 3א.

---

## 3 — הפעלת תשתית

> ⚠️ **מכונת הפיתוח הנוכחית אינה משתמשת ב-Docker.** PostgreSQL, Redis ו-MinIO
> רצים ישירות על Windows. ההוראות ל-Docker נשמרו בהמשך למי שמריץ בסביבה אחרת,
> אבל אינן משקפות את ההתקנה כאן.

### 3א — Windows (ההתקנה בפועל)

| שירות | פורט | הפעלה | נתיב נתונים |
|---|---|---|---|
| PostgreSQL 17 | 5432 | שירות Windows — עולה לבד בהפעלה | ברירת מחדל של ההתקנה |
| Redis | 6379 | `scripts/dev-infra/start-redis.cmd` | `%LOCALAPPDATA%\redis-windows` |
| MinIO | 9000 (API) / 9001 (קונסולה) | `scripts/dev-infra/start-minio.cmd` | `C:\Users\Me\minio` |

**הפעלה אוטומטית בכניסה למערכת.** Redis ו-MinIO אינם שירותי Windows ואינם
עולים לבד לאחר אתחול. הותקנו קיצורים בתיקיית ה-Startup שמפעילים אותם בכל
כניסה למשתמש:

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\UROS-start-minio.cmd
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\UROS-start-redis.cmd
```

זו הדרך שאינה דורשת הרשאות מנהל. אם יש גישת Administrator ורוצים שהם ירוצו
כמשימות מתוזמנות מלאות (עם restart אוטומטי בכשל), יש להריץ מ-PowerShell מוגבה:

```bash
powershell -ExecutionPolicy Bypass -File scripts/dev-infra/register-dev-infra.ps1
```

**אימות שהכל עלה:**

```bash
curl http://127.0.0.1:9000/minio/health/live
```

> ⚠️ **MinIO ונתיב הנתונים.** אם MinIO עולה עם תיקיית נתונים ריקה הוא מאתחל
> pool חדש ללא שום bucket — השרת יעלה בהצלחה אבל כל הורדת מסמך תיכשל בעוד
> שורות ה-Document עדיין קיימות ב-DB. אם ה-bucket `urban-renewal` נעלם, יש
> ליצור אותו מחדש בקונסולה שב-http://localhost:9001.

### 3ב — Docker (סביבות אחרות בלבד)

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
