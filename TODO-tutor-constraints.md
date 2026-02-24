# Plan: Add Study Tutor Constraints to AI

## Information Gathered

**File Analyzed:** `app/api/chat/route.ts`

**Current Implementation:**
- Contains `BASE_SYSTEM_PROMPT` with humanized writing guidelines
- Has output formatting, AI patterns to avoid, and response tone instructions
- Uses mode-specific instructions (study, deepExplore, tutor, review)
- The prompt is built dynamically in `buildSystemPrompt()` function

## Plan

### Step 1: Add New Tutor Constraint Constants
Add the following new constant sections to `app/api/chat/route.ts`:

1. **COMPARATIVE_LEARNING** - For comparing concepts using Markdown Tables
2. **PROCESS_VISUALIZATION** - For sequences/hierarchies using Mermaid.js
3. **MATHEMATICAL_PRECISION** - For LaTeX formulas
4. **SCANNABILITY** - For bolded key terms and bulleted lists
5. **CHECK_FOR_UNDERSTANDING** - For the 2-column recap/practice table

### Step 2: Update BASE_SYSTEM_PROMPT
Integrate all the new constraints into the `BASE_SYSTEM_PROMPT` constant.

## Dependent Files
- `app/api/chat/route.ts` - Main file to edit

## Followup Steps
1. Test the AI by making a comparative question (e.g., Mitosis vs Meiosis)
2. Test with a process/sequence question (e.g., water cycle)
3. Test with a mathematical formula question
4. Verify all 5 constraints are being applied correctly

