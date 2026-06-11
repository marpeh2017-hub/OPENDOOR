# Urban Renewal OS – RBAC Permission Matrix

## Role Definitions

| Role | Description |
|---|---|
| SUPER_ADMIN | Platform-level admin across all tenants |
| COMPANY_ADMIN | Full access within their tenant |
| CEO | Read-all + reports, limited edit |
| PROJECT_MANAGER | Full access to assigned projects |
| RESIDENT_RELATIONS_MANAGER | Residents, communications, signatures |
| FIELD_AGENT | Mobile-focused: visits, resident meetings |
| LAWYER | Legal documents, contracts, signature review |
| ARCHITECT | Technical documents, planning |
| ENGINEER | Engineering documents, construction phase |
| DEVELOPER_REP | External developer representative view |
| MUNICIPALITY_USER | View-only for specific projects |
| EXTERNAL_CONSULTANT | View-only for assigned projects |
| RESIDENT | Portal only: own apartment data |

---

## Permission Matrix

| Resource | SUPER_ADMIN | COMPANY_ADMIN | CEO | PROJECT_MANAGER | RR_MANAGER | FIELD_AGENT | LAWYER | ARCHITECT | RESIDENT |
|---|---|---|---|---|---|---|---|---|---|
| **Tenants** | CRUD | R | - | - | - | - | - | - | - |
| **Users** | CRUD | CRUD | R | R (own project) | - | - | - | - | - |
| **Projects** | CRUD | CRUD | R | CRUD (assigned) | R | R (assigned) | R (assigned) | R (assigned) | R (own) |
| **Complexes/Buildings** | CRUD | CRUD | R | CRUD | R | R | R | CRUD | R (own) |
| **Apartments** | CRUD | CRUD | R | CRUD | R | R | R | R | R (own) |
| **Residents** | CRUD | CRUD | R | CRUD | CRUD | CRU | R | R | R (self) |
| **Leads** | CRUD | CRUD | R | CRUD | CRUD | CRU | - | - | - |
| **Documents** | CRUD | CRUD | R | CRUD | CRU | CRU | CRUD | CRUD | R (own) |
| **Signatures** | CRUD | CRUD | R | CRUD | CRUD | R | CRUD | R | R (self) |
| **Tasks** | CRUD | CRUD | R | CRUD | CRUD | CRU (own) | CRU (own) | CRU (own) | - |
| **Meetings** | CRUD | CRUD | R | CRUD | CRUD | CRU | R | R | R (own) |
| **Messages/Comms** | CRUD | CRUD | R | CRUD | CRUD | CRU | - | - | R (own) |
| **Campaigns** | CRUD | CRUD | R | CRUD | CRUD | - | - | - | - |
| **Automations** | CRUD | CRUD | R | CRUD | R | - | - | - | - |
| **Reports** | CRUD | CRUD | R | R (assigned) | R | - | - | - | - |
| **Audit Logs** | R | R | - | - | - | - | - | - | - |
| **AI Features** | All | All | Read | Read | Read | Limited | Limited | Limited | Chatbot only |
| **GIS/Maps** | CRUD | CRUD | R | CRUD | R | R | R | CRUD | R |
| **Votes** | CRUD | CRUD | R | CRUD | CRUD | - | R | - | Vote (own project) |
| **Tickets** | CRUD | CRUD | R | R | CRUD | R | - | - | CRU (own) |
| **Settings** | CRUD | CRUD | R | - | - | - | - | - | U (own profile) |

**Legend:** C=Create, R=Read, U=Update, D=Delete

---

## Tenant Isolation Rules

1. All queries MUST be scoped by `tenantId` — enforced at service layer
2. Users can only see data within their own tenant
3. SUPER_ADMIN can impersonate tenants (with audit log entry)
4. Residents only see data for their own apartment/project
5. Municipality/External users are scoped to specific project IDs

---

## JWT Payload Structure

```json
{
  "sub": "user_id",
  "tenantId": "tenant_id",
  "role": "PROJECT_MANAGER",
  "sessionId": "session_id",
  "iat": 1234567890,
  "exp": 1234568790
}
```
