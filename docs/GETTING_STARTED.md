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

**שני קבצי הייחוס:**

| קובץ | מה הוא | מתי להשתמש |
|---|---|---|
| `.env.example` | כל משתנה שהקוד באמת קורא, כולל אופציונליים וברירות המחדל שלהם | פיתוח, ולהבין מה קיים |
| `.env.production.example` | מה שפריסה לפרודקשן חייבת להגדיר | פרודקשן — **זה הקובץ הקובע** |

ארבעה משתנים גורמים לכישלון עלייה מיידי אם הם חסרים בפרודקשן:

```
DATABASE_URL          Prisma
JWT_SECRET            JwtStrategy זורק ב-constructor
REDIS_URL             RedisModule זורק בפרודקשן
FIELD_ENCRYPTION_KEY  FieldEncryptionService זורק בפרודקשן
```

בפיתוח `FIELD_ENCRYPTION_KEY` נופל למפתח dev לא מאובטח ומדפיס אזהרה בעלייה.
זה תקין מקומית ואסור בפרודקשן.

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
# הפעל PostgreSQL, Redis, MinIO
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

## 7א — הרצת הטסטים

```bash
cd services/api-gateway
pnpm test:unit            # 195 טסטים, ללא תלויות חיצוניות
pnpm test:e2e             # 50 חבילות, 1,407 טסטים — דורש תשתית, ראו למטה
```

### שתי תלויות שה-e2e דורש, ושבלעדיהן הוא נכשל בלי לומר למה

שתיהן התגלו בדיעבד אחרי שחבילות שלמות נראו "שבורות" בעוד הקוד תקין. הן
רשומות כאן כדי שזה לא יקרה שוב:

**1. אחסון אובייקטים (S3 או תואם).** שש חבילות מעלות ומורידות קבצים —
`documents-upload`, `portal-documents`, `excel-import`, `signature-workflow`,
`cms-persistence`, `cms-project-security`. בלי הגדרה הן מייצרות **95 כשלים**,
וההודעה היחידה שמסבירה אותם מופיעה בלוג של השרת ולא בפלט של Jest:

```
Storage not configured (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY required)
```

```bash
S3_ENDPOINT=http://127.0.0.1:9000 \
S3_ACCESS_KEY=... S3_SECRET_KEY=... \
S3_BUCKET=<bucket> S3_REGION=us-east-1 S3_FORCE_PATH_STYLE=true \
pnpm test:e2e
```

MinIO מתאים (ראו 3ב). בסביבה ללא MinIO אפשר להסתפק ב-S3 מדומה:
`pip install "moto[s3]" flask_cors && python3 -m moto.server -p 9000`,
ואז ליצור את ה-bucket פעם אחת דרך boto3.

**2. דפדפן ל-ייצוא PDF.** `feasibility-foundation` מייצר PDF אמיתי דרך
Chrome/Edge. המועמדים בקוד הם `PDF_BROWSER_PATH` ושני נתיבי Windows קבועים —
כלומר **בכל סביבת Linux חייבים להגדיר אותו במפורש**, אחרת הטסט מחזיר 500:

```bash
PDF_BROWSER_PATH=/path/to/chrome pnpm test:e2e
```

> Chromium מסרב לרוץ כ-root בלי `--no-sandbox`. הדגל הזה **לא** נוסף לקוד
> המוצר בכוונה, כי הוא מחליש את ה-sandbox גם בפרודקשן. הריצו את הסוויטה
> כמשתמש רגיל.

כששתי התלויות מוגדרות הסוויטה עוברת במלואה: **50/50 חבילות, 1,407 טסטים.**

## 8 — Build לפרודקשן

```bash
pnpm build      # build כל האפליקציות
pnpm typecheck  # בדיקת TypeScript
```

---

## 9 — הקמת סביבת פרודקשן

### 9א — מיגרציות

```bash
# deploy, לא dev. `migrate dev` מייצר מיגרציות ועלול לאפס נתונים.
DATABASE_URL="..." pnpm --filter @urban-renewal/db exec   prisma migrate deploy --schema prisma/schema.postgres.prisma
```

`services/api-gateway/start.sh` כבר מריץ את זה לפני שהשרת עולה.

### 9ב — Tenant ומנהל ראשונים

**`pnpm db:seed` הוא נתוני דמו בלבד** — שלושה פרויקטים, דיירים ובעלים — והוא
יוצא בשגיאה כאשר `NODE_ENV=production`. זה נכון: אף אחד לא רוצה „הרצל 45 תל
אביב” בפריסה אמיתית.

לפרודקשן יש סקריפט נפרד שיוצר **רק** tenant ומנהל אחד:

```bash
BOOTSTRAP_TENANT_NAME="OpenDoor Group" BOOTSTRAP_TENANT_SLUG="opendoor" BOOTSTRAP_ADMIN_EMAIL="admin@opendoor.co.il" BOOTSTRAP_ADMIN_PASSWORD="..." pnpm --filter @urban-renewal/api-gateway bootstrap
```

- אין סיסמת ברירת מחדל. בלי `BOOTSTRAP_ADMIN_PASSWORD` הסקריפט מסרב לרוץ.
- הרצה חוזרת בטוחה: הוא מדווח מה כבר קיים ואינו משנה שורות קיימות.
- הוא **לא** מאפס סיסמה של מנהל קיים.
- הוא אינו יוצר פרויקטים, מבנים או דיירים.

### 9ג — גיבויים

```bash
# ריצה חד-פעמית
DATABASE_URL="..." bash scripts/backup/pg-backup.sh

# תזמון יומי במכונת הפיתוח (Windows)
pwsh scripts/backup/register-backup-task.ps1 -At "03:00"
```

כל dump מאומת מיד אחרי הכתיבה (`pg_restore --list` + ספירת טבלאות), ודump
שנכשל נמחק כדי שלא ייחשב בטעות לגיבוי תקין. שמירה: 30 יום, אך לעולם לא פחות
מ-7 גיבויים.

**שחזור — קראו את זה לפני שתצטרכו אותו:**

```bash
DATABASE_URL="postgresql://.../restore_drill"   bash scripts/backup/pg-restore.sh ./backups/<file>.dump
```

הסקריפט מסרב לשחזר לתוך מסד שכבר מכיל טבלאות אלא אם מועבר `--force`.

> ⚠️ הגיבויים נשמרים על אותה מכונה כמו המסד ואינם מוצפנים. dump מכיל את כל
> המידע האישי של הדיירים. העתיקו אותם למקום אחר לפני שמסתמכים עליהם.

### 9ד — מה עדיין לא קיים

| נושא | מצב |
|---|---|
| Dockerfile ל-CRM ול-Portal | חסר — רק ל-api-gateway יש |
| Reverse proxy / TLS | לא הוגדר |
| CI | אין `.github/workflows` — וכשיוקם, הוא חייב S3 ו-`PDF_BROWSER_PATH` (ראו 7א), אחרת 95 טסטים ייכשלו על תצורה ולא על קוד |
| לוגים מובנים | קונסולה בלבד |
| ניטור ו-alerting | אין |
