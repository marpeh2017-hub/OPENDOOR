@echo off
REM ── MinIO object storage for Urban Renewal OS (local development) ──────────
REM
REM Started at logon by the scheduled task "UROS MinIO" (see register-dev-infra.ps1).
REM
REM DATA PATH matters: MinIO formats an empty directory into a fresh pool on
REM first start, which silently produces a server with no buckets. If this path
REM changes, existing objects become invisible and every document download 404s
REM while the database still holds the rows.
set MINIO_ROOT_USER=minioadmin
set MINIO_ROOT_PASSWORD=minioadmin
"C:\Users\Me\minio.exe" server "C:\Users\Me\minio" --address ":9000" --console-address ":9001"
