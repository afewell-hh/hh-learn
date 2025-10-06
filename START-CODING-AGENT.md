# How to Start the Coding Agent for Work Packet 1

**Quick Start**: Copy the message below and start a new coding agent session.

---

## Message for Coding Agent

```
I need you to execute Work Packet 1 for the Hedgehog Learn project.

CRITICAL - Read these files FIRST (in this order):
1. docs/hubspot-architecture-correct.md - Understand HubSpot 2025.2 architecture
2. docs/CODING-AGENT-INSTRUCTIONS.md - Your specific instructions
3. docs/sprint1-work-packets-corrected.md - Work Packet 1 details

Task: Execute Work Packet 1 - Create HubSpot CMS theme structure

Key points:
- Use "hs create website-theme hedgehog-learn-theme" to create theme
- Upload with "hs upload hedgehog-learn-theme hedgehog-learn-theme"
- DO NOT use "hs project upload" (that's for Developer Projects, not themes)
- Create theme in hedgehog-learn-theme/ directory (NOT src/cms/)
- Follow Work Packet 1 in docs/sprint1-work-packets-corrected.md exactly

When done:
- Create PR with branch: feature/cms-theme-setup
- Verify theme appears in HubSpot Design Manager
- Comment in PR that Work Packet 1 is complete

Repository: /home/ubuntu/afewell-hh/hedgehog-learn
HubSpot Account ID: 21430285

Please confirm you've read the architecture doc before starting.
```

---

## What the Coding Agent Will Do

1. Read documentation (15 min)
2. Create theme boilerplate (10 min)
3. Customize theme.json and create base CSS (45 min)
4. Create base layout template (30 min)
5. Upload to HubSpot (5 min)
6. Verify and create PR (15 min)

**Total time**: ~2 hours

---

## What You'll Do After

Once the coding agent's PR is merged, you'll need to do these manual steps in HubSpot UI:

### 1. Create HubDB Tables (30 min)
- Content > HubDB
- Create "learning_pathways" table
- Create "learning_modules" table
- See: docs/MIGRATION-GUIDE.md Step 7

### 2. Activate Theme (5 min)
- Settings > Website > Themes
- Activate "hedgehog-learn-theme"
- See: docs/MIGRATION-GUIDE.md Step 8

### 3. Create Preview Pages (30 min)
- Content > Website Pages
- Create landing page preview
- Create module page preview
- See: docs/MIGRATION-GUIDE.md Step 9

### 4. Populate HubDB (30 min)
- Add module data to HubDB tables
- Publish tables
- See: docs/MIGRATION-GUIDE.md Step 10

**Your total time**: ~2 hours (after agent completes)

---

## Monitoring the Coding Agent

While the agent works, watch for:
- ✅ Agent reads docs/hubspot-architecture-correct.md first
- ✅ Agent uses `hs upload` (not `hs project upload`)
- ✅ Agent creates `hedgehog-learn-theme/` directory (not `src/cms/`)
- ✅ Agent verifies upload in HubSpot Design Manager
- ✅ Agent creates PR with proper branch name

If you see any of these ❌:
- Using `hs project upload`
- Creating `src/cms/` directory
- Not reading architecture doc first
- Adding `cms:*` scripts to package.json

Stop the agent and redirect to docs/CODING-AGENT-INSTRUCTIONS.md

---

## After Agent Completes

1. **Review the PR**
2. **Check HubSpot Design Manager** - verify theme uploaded
3. **Merge the PR** if everything looks good
4. **Start your manual steps** (HubDB tables, etc.)

---

## Timeline

**Today**:
- Coding agent executes Work Packet 1 (~2 hours)
- You review and merge PR (~15 min)

**Next**:
- You do manual HubSpot steps (~2 hours)
- Or assign Work Packet 2 to coding agent (templates)

**End result**: Working theme with preview pages ready to test!

---

## Questions?

- **Architecture**: See docs/hubspot-architecture-correct.md
- **Migration steps**: See docs/MIGRATION-GUIDE.md
- **Work details**: See docs/sprint1-work-packets-corrected.md
- **Troubleshooting**: See docs/MIGRATION-GUIDE.md (bottom section)

---

**Ready to start the coding agent? Copy the message above and create a new coding agent session!** 🚀
