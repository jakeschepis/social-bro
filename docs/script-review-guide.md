# Script Review Guide

A step-by-step guide for reviewing repurposed scripts and improving prompt quality.

---

## What You Need

- The app running (the website where you repurpose scripts)
- Claude Code open in the project folder
- A repurposed script ready to review

---

## Step 0: Customize the Skills to Match Your Voice (One-Time Setup)

Before you start reviewing scripts, you need to make sure the review criteria and style profiles match **your** voice and style — not someone else's. The skills ship with defaults, but they need to be tuned to you.

1. Open Claude Code in the project folder:
   ```
   cd /path/to/social-bro
   claude
   ```

2. Run the start command so it knows the codebase:
   ```
   /start
   ```

3. Ask Claude to audit the skills:
   ```
   Read the skill files at .claude/skills/review-script/SKILL.md and .claude/skills/prompt-iterate/SKILL.md,
   and the style profiles at style/individual-animal/Individual Animal script_style_profile.json
   and style/multi-animal/Deep sea -script_style_profile.json.
   Explain what each one controls and what I might want to change to match my voice.
   ```

4. Claude will walk you through what each file does:
   - **`review-script/SKILL.md`** — Controls what the script reviewer checks for (signature phrases, casualness markers, voice targets, formatting rules). If your style doesn't use phrases like "Here's what surprised me..." or you want different targets, this is where you change it.
   - **`prompt-iterate/SKILL.md`** — Controls how prompt changes are diagnosed and proposed. Adjust if you want different voice/tone targets or analysis criteria.
   - **Style profiles** (`style/` folder) — These are JSON files that define your voice: sentence patterns, word choices, structural templates, section lengths. The review and iterate skills compare against these.
   - **Reference scripts** (`style/` folder) — These are the "gold standard" example scripts that everything gets compared to. **Replace these with your own best scripts.**

5. Tell Claude what to change. For example:
   - "I don't use the phrase 'Here's what surprised me', remove that from the review checklist"
   - "My scripts are shorter, around 800 words, update the word count targets"
   - "I want a more formal tone, remove the casualness marker checks"
   - "Replace the reference scripts with these ones" (then paste or provide your own)

6. Claude will make the edits. Say yes when it asks to confirm.

**You only need to do this once.** After that, the skills are tuned to your voice and you can jump straight to Step 1 every time.

---

## Step 1: Download Your Script

1. Open the app and go to your **Scripts** list
2. Click on the script you want to review
3. Make sure you're viewing the **repurposed** version (you'll see the green "Repurposed" badge)
4. Click the **Download** button in the top-right of the badge row
5. A `.md` file will download to your computer

---

## Step 2: Put the Script in the Right Folder

1. Find the downloaded `.md` file (usually in your Downloads folder)
2. Move it into the project at: `docs/scripts/`
   - On Mac: open Finder, navigate to the project folder, then `docs/scripts/`, and drag the file in
   - Or in your terminal: `mv ~/Downloads/your-script-name.md docs/scripts/`

---

## Step 3: Open Claude Code

1. Open your terminal
2. Navigate to the project folder:
   ```
   cd /path/to/social-bro
   ```
3. Start Claude Code:
   ```
   claude
   ```
4. Run the start command so it knows the codebase:
   ```
   /start
   ```
5. Wait for it to finish scanning (it will show you an overview when done)

---

## Step 4: Review the Script

Now you'll ask Claude to review your script against the style profiles.

1. Type this command:
   ```
   /review-script single-subject
   ```
   Or if it's a multi-subject script:
   ```
   /review-script multi-subject
   ```

2. If there are multiple scripts in `docs/scripts/`, it will ask you which one to review. Just tell it which file.

3. It will read your script, compare it against the reference scripts and style profiles, and give you back:
   - A **summary table** with ratings (PASS / WEAK / FAIL) for each area
   - **Pros** — what's working well
   - **Cons** — what's not working
   - **Priority fixes** — the most important things to fix, in order

4. **Read through the review.** This tells you exactly what's good and bad about the script output.

---

## Step 5: Iterate on the Prompts

This is where the magic happens. You're still in the same chat — don't close it.

1. Type this command:
   ```
   /prompt-iterate single-subject
   ```
   Or:
   ```
   /prompt-iterate multi-subject
   ```

2. It will pick up the review from Step 4 automatically (since you're in the same chat). It already knows what's wrong.

3. It will:
   - Load the current prompts and the changelog of past changes
   - Figure out whether each issue is a **prompt problem** (needs a prompt change) or a **post-processing problem** (needs a code change)
   - Check what's been tried before so it doesn't repeat failed fixes
   - Propose specific changes with reasoning

4. It will show you a table of proposed changes and ask: **"Should I implement these changes?"**

5. If you're happy with the proposals, say **yes**. It will:
   - Make the edits to the prompt files
   - Log the changes in the changelog
   - Run checks to make sure nothing is broken

6. If you're not happy, tell it what you disagree with and it will adjust.

---

## Step 6: Test the Changes

1. Go back to the app
2. Repurpose a new script (or re-repurpose the same one)
3. Download the new output and repeat from Step 2 if you want to review again

---

## Quick Reference

| Step | What to do | Command |
|------|-----------|---------|
| 0 | Customize skills and style profiles to your voice (once) | Ask Claude to walk you through it |
| 1 | Download your repurposed script from the app | Click **Download** button |
| 2 | Move the `.md` file into `docs/scripts/` | Drag and drop or `mv` command |
| 3 | Open Claude Code and initialize | `/start` |
| 4 | Review the script quality | `/review-script single-subject` |
| 5 | Iterate on the prompts | `/prompt-iterate single-subject` |
| 6 | Test by repurposing again in the app | Use the app |

---

## Tips

- **Always run `/review-script` before `/prompt-iterate`** — the review gives prompt-iterate the context it needs
- **Stay in the same chat** for both commands — prompt-iterate reads the review output from the conversation
- **Single-subject** = scripts about one topic (e.g., "Why Crows Are Smart")
- **Multi-subject** = scripts covering multiple topics (e.g., "5 Weirdest Deep Sea Creatures")
- If the review comes back mostly PASS, the script is in good shape — no need to run prompt-iterate
- You can keep multiple scripts in `docs/scripts/` — it will ask which one to review
- After prompt-iterate makes changes, always test with a fresh repurpose to see if it improved
- **Step 0 is a one-time thing** — once the skills and style profiles match your voice, you skip straight to Step 1 every time
- If your style changes over time, just redo Step 0 to update the profiles
- **Replace the reference scripts** in the `style/` folder with your own best work — the closer the reference is to your voice, the better the reviews will be
