Set active focus on this project and build a comprehensive mental map before any work begins.

## Your Task

Spawn agents in parallel to survey the entire codebase. Each agent covers a different area for full coverage.

### Agents to launch (all in a single message)

1. **Project docs & memory** (Explore, very thorough)
   Read all project documentation and memory files: CLAUDE.md, MEMORY.md, README, ARCHITECTURE.md, CHANGELOG.md, FLOW.md, `.claude/rules/*`, `.claude/skills/*/SKILL.md`, and any other docs. Extract the project's conventions, architecture decisions, and institutional knowledge.

2. **Project structure, code & data** (Explore, very thorough)
   Top-level config files (package.json, tsconfig, next.config, docker-compose, CI/CD), directory layout, dependencies, scripts. Then explore core application code: entry points in `src/app/`, business logic in `src/lib/`, API routes. Also cover types in `src/types/`, database schema in `prisma/`, and UI components in `src/components/`.

3. **Recent activity** (Bash)
   Run `git log --oneline -30` and `git diff --stat HEAD~10` to see what areas are actively being worked on.

### Important
- Launch all agents simultaneously in a single message
- The docs/memory agent is critical — its findings inform everything else
- The git agent is lightweight and fast; it just provides recent context

## After Agents Return

Synthesize findings into a single concise overview:
- What this codebase does (1-2 sentences)
- Key directories and what lives in each
- Entry points and main abstractions
- How data flows through the system
- Notable patterns, conventions, or gotchas
- What's been actively worked on recently (from git history)
- Key project rules or conventions from docs/memory

Keep it brief and structured — this is a map, not a novel.
