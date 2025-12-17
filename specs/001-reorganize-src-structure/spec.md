# Feature Specification: Reorganize Source Code Structure

**Feature Branch**: `001-reorganize-src-structure`
**Created**: 2025-12-17
**Status**: Draft
**Input**: User description: "Reorganize code to correct location in folder src, no unnecessary files on root folder (including Dockerfile)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Root Directory (Priority: P1)

As a developer, I want the project root directory to contain only essential configuration files so that I can quickly understand the project structure and find relevant files without clutter.

**Why this priority**: A clean root directory is the foundation of good project organization. Developers spend significant time navigating file structures, and a cluttered root creates confusion and slows down onboarding.

**Independent Test**: Can be verified by listing the root directory and confirming only standard configuration files remain (package.json, tsconfig.json, config files, README).

**Acceptance Scenarios**:

1. **Given** the project root directory, **When** I list its contents, **Then** I see only configuration files (package.json, tsconfig.json, etc.), documentation (README.md), and standard directories (src, tests, public, docs, node_modules).
2. **Given** the project root directory, **When** I look for Docker-related files, **Then** I find them in a dedicated location within a deployment directory, not scattered in root.
3. **Given** any developer-created source file, **When** I search for it, **Then** I find it under the src directory hierarchy.

---

### User Story 2 - Organized Docker Configuration (Priority: P2)

As a DevOps engineer, I want Docker configuration files (Dockerfile, docker-compose files, .dockerignore) to be located in a predictable, organized location so that deployment workflows are clear and maintainable.

**Why this priority**: Docker files in the root create clutter and mix deployment concerns with application code. Organizing them improves separation of concerns.

**Independent Test**: Can be verified by checking that Docker files exist in their designated location and that Docker commands work correctly from the new structure.

**Acceptance Scenarios**:

1. **Given** the reorganized project, **When** I navigate to the deployment/Docker directory, **Then** I find all Docker-related files (Dockerfile, Dockerfile.dev, docker-compose.yml, docker-compose.dev.yml, .dockerignore, DOCKER.md).
2. **Given** the reorganized project, **When** I run Docker build commands from the project root, **Then** they work correctly with appropriate file path references.
3. **Given** the reorganized project, **When** I look at the root directory, **Then** no Docker files are present.

---

### User Story 3 - Preserve Build and Test Functionality (Priority: P3)

As a developer, I want all existing build commands, test commands, and development workflows to continue working after reorganization so that there is no disruption to the development process.

**Why this priority**: Reorganization must not break existing functionality. This ensures the refactoring delivers value without introducing regressions.

**Independent Test**: Can be verified by running the full test suite, build process, and development server after reorganization.

**Acceptance Scenarios**:

1. **Given** the reorganized project, **When** I run the build command, **Then** the build completes successfully without errors.
2. **Given** the reorganized project, **When** I run the test command, **Then** all existing tests pass.
3. **Given** the reorganized project, **When** I run the development server, **Then** the application starts and functions correctly.
4. **Given** the reorganized project, **When** I run Docker commands, **Then** containers build and run successfully.

---

### Edge Cases

- What happens when relative imports reference old file locations? All imports must be updated to reflect new paths.
- How does the system handle IDE/editor configurations that may cache old file paths? Developers should restart their IDE after reorganization.
- What if Docker build context assumptions are broken? Docker files must be updated to use correct context paths.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Project MUST have a clean root directory containing only standard configuration files and essential directories.
- **FR-002**: Docker configuration files (Dockerfile, Dockerfile.dev, docker-compose.yml, docker-compose.dev.yml, .dockerignore, DOCKER.md) MUST be moved to a dedicated `docker/` directory within the project.
- **FR-003**: All Docker files MUST be updated with correct paths to maintain functionality after relocation.
- **FR-004**: All import statements and file references MUST be updated to reflect new file locations.
- **FR-005**: Build process MUST continue to work after reorganization.
- **FR-006**: Test suite MUST continue to pass after reorganization.
- **FR-007**: Development server MUST continue to function after reorganization.
- **FR-008**: Git history MUST be preserved using appropriate move commands for relocated files.

### Files to Relocate

The following files currently in the root should be relocated:

| Current Location       | Proposed Location           | Rationale            |
|------------------------|-----------------------------|----------------------|
| Dockerfile             | docker/Dockerfile           | Deployment concern   |
| Dockerfile.dev         | docker/Dockerfile.dev       | Deployment concern   |
| docker-compose.yml     | docker/docker-compose.yml   | Deployment concern   |
| docker-compose.dev.yml | docker/docker-compose.dev.yml | Deployment concern |
| .dockerignore          | docker/.dockerignore        | Deployment concern   |
| DOCKER.md              | docker/README.md            | Docker documentation |
| HANDOFF_SUMMARY.md     | docs/HANDOFF_SUMMARY.md     | Documentation        |

### Files to Keep in Root

These files are standard and should remain in root:

- package.json, pnpm-lock.yaml, pnpm-workspace.yaml (package management)
- tsconfig.json (configuration)
- next.config.ts (application config)
- drizzle.config.ts (database config)
- vitest.config.ts (test config)
- eslint.config.mjs, postcss.config.mjs (linting/styling config)
- .gitignore (source control config)
- README.md (project documentation)

### Directory Structure After Reorganization

- `src/` - Application source code (unchanged)
- `tests/` - Test files (unchanged)
- `public/` - Static assets (unchanged)
- `docs/` - Documentation (add HANDOFF_SUMMARY.md)
- `data/` - Data files (unchanged)
- `docker/` - NEW: All Docker configuration files
- `.specify/` - Specification tooling (unchanged)
- `specs/` - Feature specifications (unchanged)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Root directory contains 15 or fewer visible items (excluding hidden configuration files), reduced from the current count.
- **SC-002**: 100% of existing tests pass after reorganization.
- **SC-003**: Build process completes successfully with zero errors.
- **SC-004**: Development server starts and serves the application correctly.
- **SC-005**: Docker build and compose commands work correctly when executed with updated paths.
- **SC-006**: New developers can identify where Docker files are located within 30 seconds of viewing the project structure.
- **SC-007**: All file moves preserve git history (verifiable via git log with follow option).

## Assumptions

- The project uses standard conventions for source directory structure.
- Docker commands will be updated in documentation to reference new file locations.
- No additional source code files need to be created; this is purely a reorganization task.
- The `.specify/` and `specs/` directories are tooling-related and should remain in root.
- The `start_claude.sh` script in root is a development convenience script and can be evaluated for removal or relocation.
