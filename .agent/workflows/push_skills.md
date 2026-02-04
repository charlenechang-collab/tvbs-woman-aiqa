---
description: Automatically commits and pushes changes in the .antigravity/skills directory to the remote My-AI-Skills repository.
---

# Push Skills to Remote

This workflow ensures that any optimizations made to the Agent's skills are synchronized with the central repository.

1. Navigate to the skills directory and push changes.
   // turbo
   ```bash
   cd .antigravity/skills && git add . && git commit -m "Auto-update: Optimized skills definitions" && git push origin main
   ```
