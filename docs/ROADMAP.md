# Urban Renewal OS – Development Roadmap

## Phase 1 – MVP (Months 1-4)

### Goal
Replace Excel + WhatsApp for core project operations. Get first 3 companies live.

### Deliverables

#### Month 1 – Foundation
- [ ] Monorepo setup (Turborepo + pnpm)
- [ ] Design system + brand tokens
- [ ] PostgreSQL schema + Prisma migrations
- [ ] Auth service (email login + SMS OTP)
- [ ] Multi-tenant infrastructure
- [ ] Docker local dev environment
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] AWS infrastructure (Terraform)

#### Month 2 – Core CRM
- [ ] Project management (CRUD + 12 stages)
- [ ] Building / Apartment hierarchy
- [ ] Resident management + profile pages
- [ ] Lead management + pipeline
- [ ] Task management
- [ ] Basic dashboard with KPIs
- [ ] CRM app frontend (Next.js)

#### Month 3 – Documents & Signatures
- [ ] Document upload + S3 storage + versioning
- [ ] Document categories and tagging
- [ ] OCR integration (AWS Textract)
- [ ] Comsign / DocuSign integration
- [ ] Signature workflow (send → view → sign)
- [ ] Signature tracking dashboard

#### Month 4 – Communications & Portal
- [ ] WhatsApp Business API integration
- [ ] SMS integration (InfoRU)
- [ ] Email templates (SES)
- [ ] Communication templates engine
- [ ] Resident portal launch (Next.js)
- [ ] Resident OTP login
- [ ] Portal: project status, documents, messages
- [ ] Notification system (in-app + push)

### MVP Success Criteria
- OpenDoor running all projects through the platform
- 3 tenant companies onboarded
- 500+ residents with portal access
- 0 critical security issues

---

## Phase 2 – Growth (Months 5-8)

### Goal
Automation, AI features, advanced analytics. Scale to 10+ tenants.

### Deliverables
- [ ] Visual automation workflow builder
- [ ] AI meeting summaries (Claude/OpenAI)
- [ ] AI signature prediction scoring
- [ ] Elasticsearch global search (Hebrew-aware)
- [ ] GIS / Maps integration (Google Maps + Mapbox)
- [ ] Voting system
- [ ] Support ticketing system
- [ ] Campaign management + broadcasts
- [ ] Advanced reporting & BI dashboards
- [ ] Bulk operations (mass send, bulk update)
- [ ] Resident sentiment analysis
- [ ] Export to Excel / PDF

---

## Phase 3 – Scale (Months 9-14)

### Goal
Mobile apps, international readiness, municipality integrations.

### Deliverables
- [ ] React Native field agent app (iOS + Android)
- [ ] React Native resident app (iOS + Android)
- [ ] Offline mode for field agent app
- [ ] AI resident chatbot (portal)
- [ ] Municipality portal/API
- [ ] Advanced AI risk analysis
- [ ] Multi-country support (France, Spain expansion)
- [ ] Advanced financial management module
- [ ] Developer selection workflow
- [ ] Post-delivery resident management
- [ ] SOC2 audit preparation

---

## Tech Debt & Ongoing
- Performance optimization (query analysis, caching)
- Security audits (quarterly)
- Dependency updates
- Documentation
- Test coverage target: >80%
