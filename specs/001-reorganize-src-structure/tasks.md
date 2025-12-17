# Tasks: Reorganize Source Code Structure

**Input**: Design documents from `/specs/001-reorganize-src-structure/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: No test tasks included - this is a file reorganization feature with no new application code.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Files to move from root: Dockerfile, Dockerfile.dev, docker-compose.yml, docker-compose.dev.yml, .dockerignore, DOCKER.md, HANDOFF_SUMMARY.md
- Target directories: docker/, docs/

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create target directory structure

- [x] T001 Create docker/ directory at project root
- [x] T002 Verify docs/ directory exists at project root

**Checkpoint**: Directory structure ready for file moves

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ensure clean git state before file operations

**⚠️ CRITICAL**: No file moves until this phase is complete

- [x] T003 Verify git working tree is clean (no uncommitted changes)
- [x] T004 Create backup branch for safety: `git branch backup-before-reorganize`

**Checkpoint**: Git state verified - file moves can begin

---

## Phase 3: User Story 1 - Clean Root Directory (Priority: P1) 🎯 MVP

**Goal**: Remove non-essential files from root directory by moving Docker files to docker/ and documentation to docs/

**Independent Test**: Run `ls -la | grep -E "^-" | wc -l` and verify 11 or fewer regular files in root

### Implementation for User Story 1

- [x] T005 [P] [US1] Move Dockerfile to docker/Dockerfile using `git mv Dockerfile docker/Dockerfile`
- [x] T006 [P] [US1] Move Dockerfile.dev to docker/Dockerfile.dev using `git mv Dockerfile.dev docker/Dockerfile.dev`
- [x] T007 [P] [US1] Move docker-compose.yml to docker/docker-compose.yml using `git mv docker-compose.yml docker/docker-compose.yml`
- [x] T008 [P] [US1] Move docker-compose.dev.yml to docker/docker-compose.dev.yml using `git mv docker-compose.dev.yml docker/docker-compose.dev.yml`
- [x] T009 [P] [US1] Move .dockerignore to docker/.dockerignore using `git mv .dockerignore docker/.dockerignore`
- [x] T010 [P] [US1] Move and rename DOCKER.md to docker/README.md using `git mv DOCKER.md docker/README.md`
- [x] T011 [US1] Move HANDOFF_SUMMARY.md to docs/HANDOFF_SUMMARY.md using `git mv HANDOFF_SUMMARY.md docs/HANDOFF_SUMMARY.md`
- [x] T012 [US1] Remove start_claude.sh from root if not needed using `rm start_claude.sh`
- [x] T013 [US1] Commit file moves with message "refactor: move Docker files to docker/ and docs reorganization"

**Checkpoint**: Root directory now contains only configuration files and standard directories

---

## Phase 4: User Story 2 - Organized Docker Configuration (Priority: P2)

**Goal**: Update Docker configuration files with correct paths so Docker commands work from new location

**Independent Test**: Run `docker-compose -f docker/docker-compose.yml config` and verify valid YAML output

### Implementation for User Story 2

- [x] T014 [US2] Update docker/docker-compose.yml: change build context from `.` to `..` for app service
- [x] T015 [US2] Update docker/docker-compose.yml: change dockerfile from `Dockerfile` to `docker/Dockerfile` for app service
- [x] T016 [US2] Update docker/docker-compose.yml: change build context from `.` to `..` for app-mysql service
- [x] T017 [US2] Update docker/docker-compose.yml: change dockerfile from `Dockerfile` to `docker/Dockerfile` for app-mysql service
- [x] T018 [US2] Update docker/docker-compose.dev.yml: change build context from `.` to `..`
- [x] T019 [US2] Update docker/docker-compose.dev.yml: change dockerfile from `Dockerfile.dev` to `docker/Dockerfile.dev`
- [x] T020 [US2] Update docker/docker-compose.dev.yml: change volume mount from `.:/app` to `..:/app`
- [x] T021 [US2] Validate docker-compose.yml with `docker-compose -f docker/docker-compose.yml config`
- [x] T022 [US2] Validate docker-compose.dev.yml with `docker-compose -f docker/docker-compose.dev.yml config`
- [x] T023 [US2] Commit Docker path updates with message "fix: update Docker paths for new directory structure"

**Checkpoint**: Docker configuration files have correct paths for new directory structure

---

## Phase 5: User Story 3 - Preserve Build and Test Functionality (Priority: P3)

**Goal**: Verify all build, test, and development workflows continue to work after reorganization

**Independent Test**: Run `pnpm test:run && pnpm build` and verify both pass

### Implementation for User Story 3

- [ ] T024 [US3] Run TypeScript check: `pnpm tsc --noEmit`
- [ ] T025 [US3] Run linting check: `pnpm lint`
- [ ] T026 [US3] Run test suite: `pnpm test:run`
- [ ] T027 [US3] Run build process: `pnpm build`
- [ ] T028 [US3] Verify git history preserved: `git log --follow docker/Dockerfile` shows history
- [ ] T029 [US3] Commit verification results with message "test: verify all checks pass after reorganization"

**Checkpoint**: All build and test functionality verified working

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates and final cleanup

- [ ] T030 Update README.md Docker commands section with new paths (docker-compose -f docker/docker-compose.yml)
- [ ] T031 [P] Verify root directory item count: `ls -la | grep -v "^d" | wc -l` shows ≤ 11 files
- [ ] T032 [P] Verify docker/ directory contains 6 files: Dockerfile, Dockerfile.dev, docker-compose.yml, docker-compose.dev.yml, .dockerignore, README.md
- [ ] T033 [P] Verify docs/ directory contains HANDOFF_SUMMARY.md
- [ ] T034 Final commit with message "docs: update README with new Docker command paths"
- [ ] T035 Delete backup branch if all verification passed: `git branch -d backup-before-reorganize`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Story 1 (Phase 3)**: Depends on Foundational - file moves
- **User Story 2 (Phase 4)**: Depends on US1 - path updates require files to be in new location
- **User Story 3 (Phase 5)**: Depends on US2 - verification requires correct paths
- **Polish (Phase 6)**: Depends on US3 - documentation updates after verification

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 - Docker files must be moved before paths can be updated
- **User Story 3 (P3)**: Depends on US2 - Paths must be correct before verification

### Within Each User Story

- File moves (US1) can be parallelized - different files
- Path updates (US2) should be done file by file to avoid conflicts
- Verification (US3) is sequential - each check depends on previous passing

### Parallel Opportunities

- T005-T010 can all run in parallel (different files being moved)
- T031-T033 can all run in parallel (independent verification checks)

---

## Parallel Example: User Story 1 File Moves

```bash
# Launch all file moves together (they operate on different files):
Task: "Move Dockerfile to docker/Dockerfile"
Task: "Move Dockerfile.dev to docker/Dockerfile.dev"
Task: "Move docker-compose.yml to docker/docker-compose.yml"
Task: "Move docker-compose.dev.yml to docker/docker-compose.dev.yml"
Task: "Move .dockerignore to docker/.dockerignore"
Task: "Move DOCKER.md to docker/README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (create directories)
2. Complete Phase 2: Foundational (verify git state)
3. Complete Phase 3: User Story 1 (move files)
4. **STOP and VALIDATE**: Root directory is clean
5. Can demo clean project structure even without Docker path fixes

### Incremental Delivery

1. Complete Setup + Foundational → Directories ready
2. Add User Story 1 → Files moved → Clean root achieved
3. Add User Story 2 → Docker paths fixed → Docker works
4. Add User Story 3 → All verified → Feature complete

### Single Developer Strategy (Recommended)

For this file reorganization task, sequential execution is recommended:

1. Execute all phases in order
2. Commit after each user story checkpoint
3. Verify each checkpoint before proceeding

---

## Notes

- All file moves use `git mv` to preserve git history
- Commit after each logical group of changes per constitution requirement
- Run verification commands after each phase
- If any verification fails, fix before proceeding
- Keep backup branch until final verification passes
