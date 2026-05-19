# Deprecate production render stack

**Date**: 2026-05-10

## Context

The repo previously carried a production-oriented HTTP API, Inngest worker,
R2 storage client, event contract package, Docker Compose stack, and deploy
docs. Real deployment attempts showed the render workload was too CPU-heavy
for the available production environments, and there is no active plan to run
the renderer as a hosted service.

## Decision

Make motion-shorts local-first again:

- Keep `apps/hyperframe` as the CLI render path.
- Keep `apps/mcp` as the agent entry point, but make tool handlers in-process.
- Delete the API, worker, storage, render-events, Docker, and deploy surfaces.
- Keep generated outputs local under app render folders or `MCP_OUTPUT_DIR`.

## Deleted Artifacts

- `apps/api/`
- `apps/worker/`
- `packages/storage/`
- `packages/render-events/`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- production/deployment and R2 setup docs

## Consequences

Remote zero-setup rendering is no longer a maintained goal for this repo. Agent
usage remains supported through local MCP stdio, which can lint, generate
audio, render compositions, and query the visual catalog from the same local
checkout.
