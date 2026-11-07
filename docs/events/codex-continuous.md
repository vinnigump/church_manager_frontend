# Codex continuous delivery — frontend

Triggered after merge to `main`, manually via `workflow_dispatch`, or via `repository_dispatch` event type `backend-events-merged`. The selector processes frontend issues #4, #5, #6 in order, requiring a merged PR containing `Closes #N` and backend dependencies: #4 requires backend #32, #5 requires backend #37, #6 requires backend #48. No mock APIs or speculative auth allowed.

## Required configuration
1. Add Actions secret `OPENAI_API_KEY` (OpenAI API key with API billing).
2. Add Actions secret `BACKEND_READ_TOKEN` with **read-only** access to the private backend repository issues and pull requests (fine-grained PAT or GitHub App token).
3. Allow GitHub Actions to create PRs and use contents write, while protecting main and requiring human review/merge.
4. To wake frontend automatically when backend merges a dependency, configure a **backend workflow** that sends a `repository_dispatch` event to this repository, using a scoped token with Actions write access. Otherwise frontend will wake only after its own merges or manual workflow dispatch.
5. Once prerequisites exist, run `Codex continuous after merge` manually once to bootstrap, if #4 dependency is satisfied.

## Important limits
- One Codex CLI invocation follows three *roles*, not three independent agents.
- The workflow does not merge or deploy. Failed tests block PR creation.
- GitHub Actions PRs created with `GITHUB_TOKEN` might not trigger other workflows automatically.
- API credits and Actions usage are billed separately from ChatGPT Plus.
