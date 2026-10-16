---
name: Import setup constraints
description: Non-obvious dependency installation constraint discovered while running the imported app.
---

Use npm's legacy peer resolution for this import unless a tested dependency update removes the need.

**Why:** The normal npm resolver crashed with `Cannot read properties of null (reading 'edgesOut')` on both Node.js 20 and 22. Compatibility mode installed the original graph successfully; the existing tests and build then passed.

**How to apply:** Preserve the install compatibility setting during routine setup. Do not replace the framework or upgrade unrelated libraries just to remove it.
