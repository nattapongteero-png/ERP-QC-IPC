# Implementation Plan: Reorganize Source Code Structure

**Branch**: `001-reorganize-src-structure` | **Date**: 2025-12-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-reorganize-src-structure/spec.md`

## Summary

Reorganize project files to create a cleaner root directory by moving Docker-related files to a dedicated `docker/` directory and documentation files to `docs/`. This is a file reorganization task that does not involve writing new application code, but requires updating paths in Docker configuration files to maintain functionality.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 15 project)
**Primary Dependencies**: Next.js 15, React 19, Drizzle ORM, Tailwind CSS
**Storage**: SQLite (dev) / MySQL (prod) - N/A for this task
**Testing**: Vitest - must pass after reorganization
**Target Platform**: Web application (Node.js server)
**Project Type**: Web application (Next.js monolith)
**Performance Goals**: N/A - file reorganization only
**Constraints**: Must preserve git history, must not break existing build/test/dev workflows
**Scale/Scope**: 7 files to relocate, 6 Docker files + 1 documentation file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Code Quality | Error Verification after modifications | ✅ PASS | Will run `pnpm tsc --noEmit` and `pnpm lint` after changes |
| I. Code Quality | Frequent Commits | ✅ PASS | Will commit after each logical file move group |
| II. Testing | Tests must pass | ✅ PASS | Will run `pnpm test:run` to verify no regressions |
| III. UX Consistency | N/A | ✅ PASS | No UI changes in this task |
| IV. Performance | N/A | ✅ PASS | No performance-impacting changes |
| V. Security | Secrets not in repo | ✅ PASS | No secrets involved |
| Quality Gates | Type check, lint, test, build | ✅ PASS | Will run all gates before completion |
| Development Workflow | Branch, Implement, Verify, Commit | ✅ PASS | Following workflow |

**Gate Status**: ✅ PASSED - No constitution violations

## Project Structure

### Documentation (this feature)

```text
specs/001-reorganize-src-structure/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output (verification steps)
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

**Current Structure** (before reorganization):
```text
herbal-medicine-erp/
├── Dockerfile              # → docker/Dockerfile
├── Dockerfile.dev          # → docker/Dockerfile.dev
├── docker-compose.yml      # → docker/docker-compose.yml
├── docker-compose.dev.yml  # → docker/docker-compose.dev.yml
├── .dockerignore           # → docker/.dockerignore
├── DOCKER.md               # → docker/README.md
├── HANDOFF_SUMMARY.md      # → docs/HANDOFF_SUMMARY.md
├── README.md               # stays
├── package.json            # stays
├── tsconfig.json           # stays
├── next.config.ts          # stays
├── drizzle.config.ts       # stays
├── vitest.config.ts        # stays
├── eslint.config.mjs       # stays
├── postcss.config.mjs      # stays
├── pnpm-lock.yaml          # stays
├── pnpm-workspace.yaml     # stays
├── .gitignore              # stays
├── src/                    # stays
├── tests/                  # stays
├── public/                 # stays
├── docs/                   # stays (add HANDOFF_SUMMARY.md)
├── data/                   # stays
├── .specify/               # stays
└── specs/                  # stays
```

**Target Structure** (after reorganization):
```text
herbal-medicine-erp/
├── docker/                 # NEW directory
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── .dockerignore
│   └── README.md           # renamed from DOCKER.md
├── docs/
│   ├── existing-docs...
│   └── HANDOFF_SUMMARY.md  # moved from root
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── drizzle.config.ts
├── vitest.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── .gitignore
├── src/
├── tests/
├── public/
├── data/
├── .specify/
└── specs/
```

**Structure Decision**: Web application structure retained. Only relocating Docker and documentation files to dedicated directories.

## Complexity Tracking

> No constitution violations - this section is empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Implementation Phases

### Phase 1: Create docker/ directory and move Docker files
1. Create `docker/` directory
2. Move Docker files using `git mv` to preserve history
3. Update paths in Docker files (context, volume mounts)

### Phase 2: Move documentation files
1. Move `HANDOFF_SUMMARY.md` to `docs/`
2. Rename `DOCKER.md` to `docker/README.md`

### Phase 3: Update Docker file paths
1. Update `docker-compose.yml` build context to `..`
2. Update `docker-compose.dev.yml` volume mounts
3. Update `Dockerfile` if any paths reference root

### Phase 4: Verification
1. Run `pnpm tsc --noEmit` - type check
2. Run `pnpm lint` - linting
3. Run `pnpm test:run` - all tests pass
4. Run `pnpm build` - build succeeds
5. Test Docker commands with new paths

### Phase 5: Cleanup
1. Remove `start_claude.sh` if no longer needed
2. Update README.md with new Docker command paths
3. Final commit
