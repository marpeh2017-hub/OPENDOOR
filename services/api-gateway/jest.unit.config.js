/**
 * בדיקות יחידה — טהורות, ללא מסד נתונים.
 *
 * ── למה קונפיג נפרד ולא הרחבה של הקיים ─────────────────────────────────────
 *
 * `jest.config.js` מכוון ל-`test/*.e2e-spec.ts` וטוען `test/setup.ts`, שמרים
 * חיבור ל-PostgreSQL ול-MinIO. זה נכון ל-E2E ומיותר לחישוב אריתמטי: בדיקת
 * ריבית על יתרה לא צריכה מסד נתונים, ואם היא תלויה בו היא תיכשל מסיבות
 * שאינן קשורות למתמטיקה — וזו בדיוק הדרך שבה בדיקה טובה מאבדת אמון ובסוף
 * מסומנת `skip`.
 *
 * הפרדה גם עושה את הבדיקות האלה מהירות מספיק כדי להריץ אותן אחרי כל שינוי
 * במנוע, במקום פעם ביום.
 *
 *   pnpm --filter @urban-renewal/api-gateway test:unit
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 15000,
}
