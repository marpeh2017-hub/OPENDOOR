# Urban Renewal OS – Product Requirements Document (PRD)

**Product:** Urban Renewal OS  
**Company:** OpenDoor התחדשות עירונית  
**Version:** 1.0  
**Date:** June 2026  
**Website:** https://odg.co.il

---

## 1. Executive Summary

Urban Renewal OS is a complete enterprise SaaS platform for urban renewal and evacuation-reconstruction companies in Israel. It replaces fragmented Excel spreadsheets, WhatsApp group chats, and manual document handling with a single, unified operating system.

The platform manages the entire lifecycle of urban renewal projects — from lead acquisition through resident organization, legal signatures, municipal permits, construction, and apartment delivery.

**Target customer:** Urban renewal companies operating in Israel (initial) with international expansion planned.

**Primary customer:** OpenDoor התחדשות עירונית, Jerusalem & Central Israel.

---

## 2. Problem Statement

Urban renewal companies currently suffer from:

| Problem | Impact |
|---|---|
| Data scattered across Excel files | No single source of truth, errors, version conflicts |
| Communication via personal WhatsApp | Messages lost, no audit trail, GDPR issues |
| Manual document collection | Slow, error-prone, missing documents cause project delays |
| No resident transparency | Low trust, high objection rates, slow signature collection |
| Multiple disconnected systems | CRM + legal + documents + tasks = 5+ systems |
| No data-driven decisions | No KPIs, no dashboards, no predictive analytics |

---

## 3. Primary Business Objectives

1. **Centralize** all company operations into one platform
2. **Increase signature rates** via better resident engagement
3. **Improve transparency** for residents via self-service portal
4. **Automate** repetitive communication and task creation
5. **Scale** to support thousands of projects and hundreds of thousands of residents
6. **Reduce time-to-close** for each project stage

---

## 4. Platform Components

### 4.1 Public Marketing Website (apps/web)
- Lead generation and brand awareness
- RTL Hebrew-first, SEO optimized
- Lead capture forms integrated with CRM

### 4.2 CRM Platform (apps/crm)
- Internal operations management for company staff
- Project lifecycle management, resident management, task management
- Role-based access control (13 roles)
- Hebrew-first, RTL

### 4.3 Resident Portal (apps/portal)
- Self-service portal for residents
- Project status, documents, signatures, messages
- Mobile-first, multilingual (Hebrew, Russian, Arabic, English)
- SMS/OTP authentication — no password required

### 4.4 Mobile Applications
- Field Agent App: resident visits, digital signatures, offline support
- Resident App: mirrors portal features in mobile-native experience

### 4.5 AI Layer
- Resident chatbot, meeting summaries, signature prediction, risk scoring
- Integrated into CRM and Portal

---

## 5. User Personas

### Internal Users (CRM)
| Role | Primary Use Case |
|---|---|
| CEO | Executive dashboards, KPIs |
| Project Manager | Full project lifecycle management |
| Resident Relations Manager | Resident engagement, signature tracking |
| Field Agent | Mobile resident visits, signature collection |
| Lawyer | Document review, legal workflows |
| Architect | Technical document management |

### External Users (Portal/App)
| Role | Primary Use Case |
|---|---|
| Resident | View project progress, sign documents, communicate |
| Municipality User | View project status, approve submissions |

---

## 6. Feature Requirements by Priority

### Priority 1 – MVP (Phase 1)
- Multi-tenant authentication (email + SMS OTP)
- Project management with 12-stage lifecycle
- Resident management with signature tracking
- Document management (upload, categorize, version)
- Digital signature integration (Comsign / DocuSign)
- WhatsApp + SMS + Email communication
- Basic dashboard with KPIs
- Resident portal (project status + documents + messages)
- Task management

### Priority 2 – Phase 2
- Automation engine (visual workflow builder)
- AI meeting summaries
- GIS mapping integration
- Voting system
- Advanced reporting & BI
- Support ticketing system
- Campaign management

### Priority 3 – Phase 3
- AI signature prediction & risk scoring
- AI resident chatbot
- Mobile apps (React Native)
- Municipality integration APIs
- Multi-language AI support
- International market features

---

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Availability | 99.95% uptime |
| Performance | Sub-second search, <200ms API P95 |
| Scale | 100,000+ residents, 10,000+ projects, 1,000 concurrent users |
| Security | AES-256, TLS 1.3, RBAC, MFA, audit logs |
| Compliance | GDPR ready, ISO 27001 ready, SOC2 ready |
| Accessibility | WCAG AA |
| Languages | Hebrew (primary), English, Russian, Arabic |
| RTL | Full RTL native for Hebrew and Arabic |

---

## 8. Success Metrics

| Metric | Target (12 months post-launch) |
|---|---|
| Active projects on platform | 50+ |
| Resident portal adoption | >70% of project residents registered |
| Signature rate improvement | +15% vs. baseline |
| Time saved per project manager | 5+ hours/week |
| Resident satisfaction score | >4.2/5 |
| NPS | >50 |
