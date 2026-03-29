Fineract Backoffice UI
A modern Angular-based backoffice interface for Apache Fineract—the open-source core banking platform for fintechs and community banks. This UI connects to Fineract's REST APIs and is designed to be deployed alongside Fineract, enabling users to understand and operate core banking functionality through role-specific experiences.

Overview
The Fineract Backoffice UI provides a user-friendly way to interact with Fineract's core features. It is built to mirror the capabilities of the Fineract platform and expose them through workflows tailored to key user profiles, so each role can focus on the tasks most relevant to them.

Key User Profiles & Core Functionality
1. Admin User
Admins manage the organizational setup, products, and staff. The UI supports:
CapabilityDescriptionOrganization & StructureManage offices, hierarchy, and organizational unitsProduct SetupConfigure loan products, savings products, and charges with interest rules, grace periods, and feesStaff & User ManagementCreate and manage staff, assign roles, set permissionsCustomer ManagementCreate and manage customers, profiles, and organizational structureCode ManagementManage custom codes and lookups used across the systemCurrency & ConfigurationConfigure currencies, interest rates, and organization-level settings
2. Loan Officer
Loan officers focus on customer relationships and loan lifecycle. The UI supports:
CapabilityDescriptionCustomer PortfolioView assigned customers, their profiles, financial history, and identificationLoan ApplicationsCreate and submit loan applications for customersDisbursementsProcess single or multi-stage disbursements based on milestonesRepaymentsRecord repayments and track collection statusLoan TrackingView loan status, amortization schedules, delinquency, and arrearsCollectionsMonitor overdue loans and apply penalties where configured
3. System Admin
System admins handle security, audit, and infrastructure. The UI supports:
CapabilityDescriptionUser Roles & PermissionsDefine roles and assign granular permissions to staffAudit & ReportingAccess audit logs, activity history, and system reportsSecurity ConfigurationManage authentication, passwords, and security settingsSystem HealthMonitor API status, integrations, and system healthBatch JobsView and manage scheduled batch jobs (e.g., interest posting, delinquency)Data ManagementExport data and manage system backups where applicable

Technology Stack

Framework: Angular (with standalone components)
Backend Integration: Fineract REST API (e.g. /fineract-provider/api/v1/)
Authentication: Fineract-based auth (basic auth or token-based)
i18n: Angular i18n with support for English, Hindi, and Korean
State Management: Angular signals for reactive state
Testing: Jasmine + Karma with 90%+ code coverage
Code Quality: ESLint + Prettier for consistent formatting
Deployment: Designed to run alongside Fineract (e.g. Docker, reverse proxy)


Architecture
┌─────────────────────┐         REST API          ┌─────────────────────┐
│  Fineract Backoffice │ ─────────────────────────▶│   Apache Fineract   │
│  UI (Angular SPA)   │  HTTPS (e.g. :8443)       │   (Core Platform)   │
└─────────────────────┘                            └─────────────────────┘
                                                              │
                                                              ▼
                                                    ┌─────────────────────┐
                                                    │   Database          │
                                                    │   (PostgreSQL /     │
                                                    │   MariaDB)          │
                                                    └─────────────────────┘

Prerequisites

Node.js (v18 or later recommended) and npm or yarn
Angular CLI (npm i -g @angular/cli)
Apache Fineract instance (e.g. via Docker: docker run -d -p 8443:8443 apache/fineract:latest)
Access to Fineract REST API (default demo: mifos / password on https://localhost:8443/fineract-provider/api/v1)


Getting Started
Development
bash# Install dependencies
npm install

# Configure API base URL (e.g. in environment files)
# Default: https://localhost:8443/fineract-provider/api/v1

# Run development server
ng serve
Access the app at http://localhost:4200 (or the configured port).
Configuration

API Base URL: Point to your Fineract instance (e.g. https://your-fineract-host:8443/fineract-provider/api/v1)
Authentication: Use Fineract credentials; the UI will send them according to your auth strategy
Tenant: Configured via environment files; defaults to default tenant


Development Workflow
Code Quality
bash# Run linter
npm run lint

# Check formatting
npm run format:check

# Auto-format code
npm run format

# Run tests
npm test

# Run tests with coverage
npm test -- --code-coverage
```

### Quality Standards

- **Test Coverage:** Minimum 90% statement coverage required
- **Linting:** ESLint passes without errors
- **Formatting:** Prettier compliance enforced
- **i18n:** All user-facing strings must use translation keys

---

## Current Features

### Authentication & Authorization

- Login with Fineract credentials
- Multi-tenant support with tenant persistence
- Protected routes with auth guards
- Automatic logout on session expiry

### Dashboard

- System status overview
- Active tenant display
- Environment indicators (DEV/UAT/PROD)
- Multi-language support

### Feature Modules (In Development)

- **Clients:** Customer management interface (placeholder)
- **Loans:** Loan lifecycle management (placeholder)
- **Organization:** Organizational setup and configuration (placeholder)

### Internationalization

- Full i18n support via Angular i18n
- Languages: English (en), Hindi (hi), Korean (ko)
- Translation-ready UI components
- Runtime language switching

---

## Deployment with Fineract

The UI is built as a static SPA and can be deployed together with Fineract:

1. **Standalone Build + Reverse Proxy**

   - Build: `ng build --configuration production`
   - Serve output (e.g. `dist/`) via NGINX or similar
   - Configure reverse proxy so the UI and Fineract share the same origin or CORS allow the API domain

2. **Docker (co-located)**

   - Use `apache/fineract` image for the backend
   - Add an Angular build step and serve the static files from NGINX or another web server alongside Fineract

3. **Single Domain Example (NGINX)**
```
   /          → Angular app (static files)
   /api/      → proxy to Fineract (https://fineract:8443/fineract-provider/api/v1)

Recent Changes
Navigation & Routing

Implemented lazy-loaded feature routes for Clients, Loans, and Organization
Fixed broken sidebar navigation links
Added route guards for authenticated feature modules

State Management

Refactored tenant state management using Angular signals
Tenant ID now persists in localStorage and syncs with auth state
Logout properly resets tenant to configured default

Testing

Increased test suite from 29 to 35 tests
Added comprehensive specs for all new components
Achieved 90%+ code coverage across statements, functions, and lines
All tests passing in headless Chrome

Internationalization

Removed all hardcoded user-facing strings
Added translation keys for dashboard, login, header, and feature placeholders
Extended translations to Hindi and Korean (English placeholders where applicable)
Full i18n compliance across the application

Code Quality

Applied Prettier formatting across entire codebase
All files now comply with project formatting standards
ESLint compliance restored
Consistent code style enforced
