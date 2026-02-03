<!--
Sync Impact Report
==================
Version change: 1.3.0 → 1.4.0
Modified principles:
  - II. Testing Standards: Upgraded TDD from "encouraged" to MANDATORY
  - Development Workflow: Added TDD steps (write tests first, observe failure, implement)
Added sections: None
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ Already has Constitution Check section
  - .specify/templates/spec-template.md: ✅ Compatible (uses testable requirements format)
  - .specify/templates/tasks-template.md: ✅ Compatible (supports test-first workflow)
Follow-up TODOs: None

Previous changes (1.2.0 → 1.3.0):
  - I. Code Quality Standards: Added "Reusable Components" requirement

Previous changes (1.1.0 → 1.2.0):
  - III. User Experience Consistency: Added "DevExpress/DevExtreme Components" requirement

Previous changes (1.0.0 → 1.1.0):
  - I. Code Quality Standards: Added "Error Verification" and "Frequent Commits" requirements
  - Development Workflow: Enhanced steps 2-4 with mandatory error checking and commit requirements
-->

# Herbal Medicine ERP Constitution

## Core Principles

### I. Code Quality Standards

All code in this project MUST adhere to the following non-negotiable quality standards:

- **Type Safety**: All code MUST use TypeScript with strict mode enabled. No `any` types except when interfacing with untyped external libraries, and such cases MUST include explicit type assertions with comments justifying the exception.
- **Linting Compliance**: All code MUST pass ESLint checks with zero errors before merge. Warnings SHOULD be addressed unless documented with justification.
- **Code Review**: All changes MUST be reviewed before merge to main branch. Self-review is acceptable for urgent hotfixes but MUST be followed by post-merge peer review within 24 hours.
- **Single Responsibility**: Each module, component, and function MUST have a single, clearly defined purpose. Functions exceeding 50 lines SHOULD be refactored unless complexity justifies otherwise.
- **No Hardcoded Values**: Configuration values, API endpoints, and business logic conditions MUST NOT be hardcoded. Use environment variables, configuration files, or database-driven settings.
- **Error Handling**: All async operations MUST have explicit error handling. API endpoints MUST return appropriate HTTP status codes and structured error responses.
- **Error Verification**: After completing any code modification, developers MUST check for coding errors by running type checking (`pnpm tsc --noEmit`) and linting (`pnpm lint`). Code with errors MUST NOT be left in the codebase.
- **Frequent Commits**: Code MUST be committed frequently after each completed task or logical unit of work to prevent loss of progress and enable easy rollback. Uncommitted code is at risk of being lost and makes debugging harder.
- **Reusable Components**: Common UI patterns MUST be extracted into reusable components rather than inlined in pages. This includes:
  - **Search dialogs**: Item lookup, vendor search, customer search MUST use shared search dialog components.
  - **Data entry dialogs**: CRUD operations (create, edit, delete confirmations) MUST use shared dialog components.
  - **Form patterns**: Common form layouts, validation patterns, and submit handlers MUST be abstracted into reusable form components or hooks.
  - **Data grids**: Grid configurations for similar data types SHOULD share column definitions and behaviors.
  - **Location**: Reusable components MUST be placed in `src/components/shared/` or domain-specific folders (e.g., `src/components/purchasing/`). Page-specific components that are NOT reused SHOULD be co-located with their page.
  - **DRY Principle**: If the same UI pattern appears in 2+ places, it MUST be refactored into a shared component. Copy-pasting UI code across pages is PROHIBITED.

**Rationale**: Consistent code quality reduces bugs, improves maintainability, and enables faster onboarding of new team members. Frequent commits and immediate error verification prevent accumulated technical debt and reduce the risk of losing work. Reusable components ensure UI consistency, reduce code duplication, and make updates easier—fixing a bug or adding a feature in one shared component benefits all consumers.

### II. Testing Standards

Testing is MANDATORY for production code. The following standards apply:

- **Test-Driven Development (TDD)**: All new features and bug fixes MUST follow the TDD workflow:
  1. **Red**: Write a failing test that defines expected behavior BEFORE writing implementation code
  2. **Green**: Write the minimum code necessary to make the test pass
  3. **Refactor**: Clean up the code while keeping tests green
  - Tests MUST fail first - if a new test passes immediately, it is likely not testing the right thing
  - Implementation code MUST NOT be written until a failing test exists
  - This applies to: new features, bug fixes, API endpoints, UI components, and service functions
- **Test Coverage**: New features MUST include unit tests covering at least the primary success path and one error path. Critical business logic (inventory calculations, QC decisions, financial calculations) MUST have comprehensive test coverage.
- **Unit Test Isolation**: Unit tests MUST NOT depend on external services, databases, or network calls. Use mocks and in-memory databases (SQLite) for isolation.
- **Integration Tests**: API endpoints MUST have integration tests validating request/response contracts. Database operations MUST have integration tests validating data integrity.
- **Test Naming**: Test names MUST clearly describe the scenario being tested using the pattern: `[unit]_[scenario]_[expectedResult]` or descriptive prose.
- **Test Maintenance**: Failing tests MUST be fixed or explicitly skipped with documented justification and a TODO for resolution. Tests MUST NOT be deleted to make builds pass.

**Rationale**: TDD ensures code is testable by design, prevents over-engineering, and provides living documentation. Writing tests first forces clear thinking about requirements before implementation. Comprehensive testing prevents regressions, documents expected behavior, and enables confident refactoring.

### III. User Experience Consistency

The user interface MUST provide a consistent, accessible, and responsive experience:

- **Responsive Design**: All pages MUST be usable on desktop (1920px), tablet (768px-1024px), and mobile (320px-767px) viewports. iPad landscape orientation is a primary target.
- **Loading States**: All async operations MUST display appropriate loading indicators. Users MUST NOT see blank screens or unresponsive UI during data fetching.
- **Error Feedback**: All user-facing errors MUST display clear, actionable messages in the user's language (Thai or English based on context). Technical error details SHOULD be logged but NOT displayed to users.
- **Form Validation**: All forms MUST validate inputs on blur and before submission. Validation errors MUST be displayed inline next to the relevant field.
- **DevExpress/DevExtreme Components**: All UI components MUST use DevExpress/DevExtreme React components as the primary component library. The project has a purchased enterprise license for all DevExpress products. Native HTML elements or other component libraries (e.g., shadcn/ui, Material UI, Ant Design) MUST NOT be used when a DevExtreme equivalent exists. This ensures consistent look-and-feel, professional-grade functionality, and full utilization of the licensed software.
- **Consistent Styling**: Use Tailwind CSS utility classes for layout and spacing. DevExtreme theming MUST be used for component styling. Custom CSS SHOULD be avoided unless DevExtreme theming and Tailwind utilities are insufficient. Component styling MUST follow existing patterns in the codebase.
- **Accessibility**: Interactive elements MUST be keyboard accessible. Form inputs MUST have associated labels. Color MUST NOT be the only means of conveying information. DevExtreme components provide built-in accessibility features that SHOULD be utilized.

**Rationale**: Consistent UX builds user trust, reduces training time, and ensures the system is usable across devices common in warehouse and production environments. Using DevExpress/DevExtreme components exclusively maximizes the value of the enterprise license investment while providing enterprise-grade features like data grids, charts, forms, and reporting out of the box.

### IV. Performance Requirements

The system MUST meet the following performance standards:

- **Page Load**: Initial page load MUST complete within 3 seconds on a standard broadband connection. Subsequent navigation SHOULD complete within 1 second.
- **API Response**: API endpoints MUST respond within 500ms for simple queries and 2 seconds for complex reports. Endpoints exceeding these thresholds MUST implement pagination, caching, or background processing.
- **Database Queries**: Queries MUST use appropriate indexes. N+1 query patterns are PROHIBITED. Queries fetching more than 1000 rows MUST implement pagination.
- **Bundle Size**: Frontend bundle size SHOULD remain under 500KB gzipped. New dependencies MUST be justified and their size impact documented.
- **Memory Usage**: Server processes SHOULD NOT exceed 512MB memory under normal load. Memory leaks MUST be investigated and resolved promptly.
- **Concurrent Users**: The system MUST support at least 50 concurrent users without degradation.

**Rationale**: Performance directly impacts user productivity and system reliability in a production environment where delays can affect manufacturing schedules.

### V. Security and GMP Compliance

As a pharmaceutical manufacturing system, security and compliance are non-negotiable:

- **Authentication**: All API endpoints except public health checks MUST require authentication. JWT tokens MUST have appropriate expiration times.
- **Authorization**: Users MUST only access data and functions permitted by their role. Role checks MUST be enforced at the API layer, not just the UI.
- **Audit Trail**: All data modifications MUST be logged with timestamp, user ID, and before/after values. Audit logs MUST NOT be deletable through the application.
- **Data Integrity**: Lot numbers, batch records, and QC results MUST NOT be editable after QC approval without creating a deviation record.
- **Input Validation**: All user inputs MUST be validated and sanitized. SQL injection, XSS, and other OWASP Top 10 vulnerabilities MUST be prevented.
- **Secrets Management**: Passwords, API keys, and other secrets MUST NOT be committed to the repository. Use environment variables or secret management services.

**Rationale**: GMP compliance requires complete traceability and data integrity. Security vulnerabilities could compromise patient safety and regulatory standing.

## Quality Gates

All code changes MUST pass the following gates before merge:

| Gate | Requirement | Enforcement |
|------|-------------|-------------|
| Type Check | `pnpm tsc --noEmit` passes | CI pipeline |
| Lint | `pnpm lint` passes with no errors | CI pipeline |
| Unit Tests | `pnpm test:run` passes | CI pipeline |
| Build | `pnpm build` succeeds | CI pipeline |
| Code Review | At least one approval | GitHub branch protection |

## Development Workflow

The following workflow MUST be followed for all changes:

1. **Branch**: Create a feature branch from `main` with descriptive name.
2. **Write Test First (TDD Red Phase)**:
   - Write a failing test that defines expected behavior
   - Run the test and observe it FAIL (this is mandatory - skip means the test is wrong)
   - Commit the failing test with message like "test: add failing test for [feature]"
3. **Implement (TDD Green Phase)**:
   - Write the minimum code to make the test pass
   - Do NOT add extra functionality beyond what the test requires
4. **Refactor (TDD Refactor Phase)**:
   - Clean up implementation while keeping tests green
   - Extract common patterns, improve naming, reduce duplication
5. **Verify**: After EACH code modification, MUST run error checks:
   - Run `pnpm tsc --noEmit` to check for TypeScript errors
   - Run `pnpm lint` to check for linting errors
   - Run `pnpm test:run` to ensure all tests pass
   - Fix all errors before proceeding
6. **Commit**: MUST commit code immediately after completing each task or logical unit of work. Create atomic commits with clear messages. Include issue references where applicable.
7. **Push**: Push to remote and create pull request.
8. **Review**: Address review feedback.
9. **Merge**: Squash merge after approval and passing CI.

**TDD Cycle**: The Red-Green-Refactor cycle MUST be followed for each feature unit. Do not batch multiple features before testing. Small, incremental TDD cycles are more effective than large implementations.

**Commit Frequency**: Commit after completing each logical unit of work to prevent loss of progress and enable granular rollback. This is NON-NEGOTIABLE - uncommitted code represents unprotected work.

## Governance

This constitution governs all development practices for the Herbal Medicine ERP project.

### Amendment Process

1. Propose amendments via pull request modifying this file.
2. Document rationale for the change.
3. Obtain team review and approval.
4. Update version following semantic versioning:
   - **MAJOR**: Removing or fundamentally changing principles
   - **MINOR**: Adding new principles or expanding existing guidance
   - **PATCH**: Clarifications, typo fixes, non-semantic refinements
5. Update `LAST_AMENDED_DATE` to the amendment date.

### Compliance

- All pull requests SHOULD be checked against relevant constitution principles.
- Constitution violations MUST be documented and justified if exceptions are granted.
- Periodic reviews SHOULD assess whether principles remain appropriate as the project evolves.

### Runtime Guidance

For day-to-day development guidance, refer to:
- `README.md` for setup and project overview
- `.specify/` directory for feature specification workflows
- Code comments and existing patterns for implementation guidance

**Version**: 1.4.0 | **Ratified**: 2025-12-17 | **Last Amended**: 2026-02-03
