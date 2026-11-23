# Memory

Current scope and resumption rules: [platform integration handoff](20-platform-integration-handoff.md).

Claude's persistent memory for this project is stored outside this repository
tree, in the user-level Claude Code memory directory:

```
C:\Users\Stone Smoker\.claude\projects\D--MyWebSite-vxturestudio-vxture-arda\memory\
```

The `MEMORY.md` index file in that directory lists all active memory entries.
Memory entries persist across conversations and are automatically loaded into
context when Claude Code is invoked in this project directory.

This `docs/90-memory/` directory exists to mirror the umbra repo structure. The
actual memory files live in the path above, not here.
