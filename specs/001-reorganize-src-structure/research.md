# Research: Reorganize Source Code Structure

**Date**: 2025-12-17
**Feature**: 001-reorganize-src-structure

## Research Summary

This document captures the analysis needed to safely relocate Docker files to a `docker/` subdirectory while maintaining full functionality.

## Docker File Path Analysis

### Current Docker Configuration

| File | Key Path References | Impact of Move |
|------|---------------------|----------------|
| `docker-compose.yml` | `context: .`, `dockerfile: Dockerfile` | Must update context to `..` and dockerfile to `Dockerfile` (relative to new location) |
| `docker-compose.dev.yml` | `context: .`, `dockerfile: Dockerfile.dev`, volumes: `.:/app` | Must update context to `..`, dockerfile path, and volume mount |
| `Dockerfile` | `COPY package.json pnpm-lock.yaml ./`, `COPY . .` | No changes needed - paths are relative to build context |
| `Dockerfile.dev` | `COPY package.json pnpm-lock.yaml ./`, `COPY . .` | No changes needed - paths are relative to build context |
| `.dockerignore` | N/A | Move to docker/ directory |

### Decision: Docker Compose Path Updates

**Decision**: Update `docker-compose.yml` and `docker-compose.dev.yml` to use parent directory as build context.

**Rationale**:
- Docker build context must be the project root to access `package.json`, `src/`, etc.
- Moving to `docker/` subdirectory requires context to be `..` (parent directory)
- Dockerfile paths become relative to the `docker/` directory

**Alternatives Considered**:
1. Keep Docker files in root - Rejected: defeats purpose of reorganization
2. Use absolute paths - Rejected: less portable
3. Symlinks - Rejected: adds complexity, may not work on all systems

### Required Changes to docker-compose.yml

```yaml
# Before (in root):
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile

# After (in docker/):
services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
```

### Required Changes to docker-compose.dev.yml

```yaml
# Before (in root):
services:
  app-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app

# After (in docker/):
services:
  app-dev:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dev
    volumes:
      - ..:/app
```

## Git History Preservation

**Decision**: Use `git mv` for all file moves.

**Rationale**: `git mv` is equivalent to moving + staging, and Git's rename detection preserves history when viewing with `git log --follow`.

**Command Pattern**:
```bash
mkdir -p docker
git mv Dockerfile docker/Dockerfile
git mv Dockerfile.dev docker/Dockerfile.dev
git mv docker-compose.yml docker/docker-compose.yml
git mv docker-compose.dev.yml docker/docker-compose.dev.yml
git mv .dockerignore docker/.dockerignore
git mv DOCKER.md docker/README.md
git mv HANDOFF_SUMMARY.md docs/HANDOFF_SUMMARY.md
```

## Docker Command Updates

After reorganization, Docker commands must be run differently:

| Before | After |
|--------|-------|
| `docker-compose up` | `docker-compose -f docker/docker-compose.yml up` |
| `docker-compose -f docker-compose.dev.yml up` | `docker-compose -f docker/docker-compose.dev.yml up` |
| `docker build .` | `docker build -f docker/Dockerfile .` |

**Alternative**: Run commands from the `docker/` directory, but this changes working directory expectations.

## README.md Updates Required

The main `README.md` references Docker commands that will need updating:
- Production deployment section
- Development setup section
- Any `docker-compose` command examples

## Verification Strategy

1. **Type Check**: `pnpm tsc --noEmit` - verify TypeScript compiles
2. **Lint**: `pnpm lint` - verify linting passes
3. **Unit Tests**: `pnpm test:run` - verify all tests pass
4. **Build**: `pnpm build` - verify Next.js builds
5. **Docker Build**: `docker build -f docker/Dockerfile .` - verify Docker builds
6. **Docker Compose**: `docker-compose -f docker/docker-compose.yml config` - verify compose file is valid

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Broken Docker builds | Medium | High | Test immediately after path updates |
| Lost git history | Low | Medium | Use `git mv`, verify with `git log --follow` |
| Broken CI/CD pipelines | Medium | High | Update any CI configs referencing Docker files |
| Developer confusion | Low | Low | Update documentation, clear commit messages |

## Conclusion

The reorganization is straightforward with well-defined path updates. The key changes are:
1. Move 7 files to `docker/` and `docs/` directories
2. Update build context in docker-compose files to `..`
3. Update dockerfile paths to include `docker/` prefix
4. Update volume mounts in dev compose file
5. Update documentation with new command syntax
