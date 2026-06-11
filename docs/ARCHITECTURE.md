# Urban Renewal OS – System Architecture

## C4 Context Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Urban Renewal OS                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Web App  │  │  CRM App │  │  Portal  │  │  Mobile  │   │
│  │ (Next.js)│  │ (Next.js)│  │ (Next.js)│  │  (RN)    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └─────────────┴─────────────┴──────────────┘         │
│                            │                                │
│                    ┌───────┴────────┐                       │
│                    │  API Gateway   │                       │
│                    │  (NestJS)      │                       │
│                    └───────┬────────┘                       │
│                            │                                │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │             │
│  ┌──────┴──────┐  ┌────────┴────┐  ┌──────────┴────────┐   │
│  │  Core DB    │  │   Search    │  │  Message Queue     │   │
│  │ (PostgreSQL)│  │(Elasticsearch│  │   (RabbitMQ)      │   │
│  └─────────────┘  └─────────────┘  └───────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │  Cache/Queue │  │  File Store │  │  External Services │  │
│  │   (Redis)   │  │   (AWS S3)  │  │ WhatsApp/DocuSign  │  │
│  └──────────────┘  └─────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Microservices Map

| Service | Responsibility | Port |
|---|---|---|
| api-gateway | Request routing, auth guard, rate limiting | 4000 |
| auth-service | JWT, OTP, MFA, SSO | 4001 |
| crm-service | Leads, pipeline, CRM operations | 4002 |
| project-service | Project lifecycle, stages, buildings | 4003 |
| resident-service | Resident management, risk scoring | 4004 |
| document-service | File management, OCR, versioning | 4005 |
| communication-service | WhatsApp, SMS, Email dispatch | 4006 |
| workflow-service | Automation engine, triggers, actions | 4007 |
| reporting-service | BI, dashboards, exports | 4008 |
| gis-service | Mapping, spatial queries | 4009 |
| ai-service | OpenAI/Claude integration | 4010 |
| notification-service | Multi-channel notification dispatch | 4011 |

---

## Database Architecture

### Multi-tenancy Strategy
- **Shared database, shared schema** with `tenantId` column on all tables
- Row-level security enforced at application layer
- All Prisma queries wrapped in middleware that injects `tenantId`

### Key Design Decisions
- `cuid()` for all primary keys (collision-resistant, URL-safe)
- Soft deletes via `status` field rather than physical deletion
- JSON columns for flexible settings/metadata (Postgres JSONB)
- Full-text search via Elasticsearch (not Postgres FTS) for multilingual support
- Audit log table captures all mutations

---

## Event-Driven Architecture

### RabbitMQ Exchanges & Queues

```
Exchange: urban-renewal.events (topic)

Routing Keys:
  resident.created           → [workflow-service, notification-service]
  resident.signature.signed  → [workflow-service, reporting-service, notification-service]
  project.stage.changed      → [workflow-service, notification-service, reporting-service]
  document.uploaded          → [document-service (OCR), search-service (index)]
  lead.created               → [workflow-service, crm-service]
  meeting.completed          → [ai-service (summary), workflow-service]
  message.sent               → [reporting-service]
  task.overdue               → [notification-service, workflow-service]
```

---

## Authentication Flow

```
CRM Login:
  1. POST /api/v1/auth/login (email + password)
  2. Server validates credentials, checks MFA
  3. Issues access_token (15min JWT) + refresh_token (30d, stored in DB)
  4. Client stores tokens, refreshes silently

Resident Portal Login:
  1. POST /api/v1/auth/otp/send (phone number)
  2. Server generates 6-digit OTP, stores in Redis (5min TTL)
  3. OTP sent via SMS (InfoRU or Twilio)
  4. POST /api/v1/auth/otp/verify (phone + code)
  5. Server validates OTP, issues tokens
```

---

## AWS Infrastructure

```
Region: il-central-1 (Israel) primary, eu-west-1 (Ireland) DR

Production:
  ECS Fargate          – All microservices (containerized)
  RDS PostgreSQL       – Multi-AZ, encrypted at rest
  ElastiCache Redis    – Cluster mode
  Amazon MQ            – RabbitMQ (managed)
  OpenSearch Service   – Elasticsearch (managed)
  S3                   – Document storage + CloudFront CDN
  SES                  – Transactional email
  SNS                  – SMS (for fallback to Twilio)
  Route53              – DNS + health checks
  ACM                  – SSL certificates
  WAF                  – Web Application Firewall
  CloudWatch           – Logs + metrics
  Secrets Manager      – API keys and credentials
```

---

## CI/CD Pipeline (GitHub Actions)

```yaml
Triggers:
  push to main     → deploy to production
  push to staging  → deploy to staging
  pull_request     → run tests + lint + typecheck

Stages:
  1. lint + typecheck
  2. unit tests
  3. integration tests (against Docker services)
  4. build Docker images
  5. push to ECR
  6. deploy to ECS (blue/green)
  7. run smoke tests
  8. notify Slack
```
