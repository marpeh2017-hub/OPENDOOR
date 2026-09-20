@echo off
REM ── Redis for Urban Renewal OS (local development) ─────────────────────────
REM
REM Started at logon by the scheduled task "UROS Redis".
REM
REM Redis backs JWT session revocation (jwt:revoked:{sessionId}), the OTP resend
REM cap, and the geocoding cache. The API tolerates its absence in dev, but with
REM Redis down a logout does NOT revoke a live token.
"%LOCALAPPDATA%\redis-windows\redis-server.exe" --port 6379
