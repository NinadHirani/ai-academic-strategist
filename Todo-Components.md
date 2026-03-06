# 🧹 Master Cleanup TODO — `ai-academic-strategist`
> Covers: dead code removal + redundancy consolidation
> Work top-to-bottom. Each phase is independently committable.

---

## PHASE 1 — Delete Junk & Accidental Files
> Zero risk. None of these are imported or referenced by any code.

- [ ] `rm "app/api/chat/route.ts.bak"`
- [ ] `rm 'app/api/chat/route.ts</path'`  ← malformed filename from a corrupted tool edit
- [ ] `rm "app/sandbox/page.tsx.bak"`
- [ ] `rm "test-document.txt"`
- [ ] `rm "1"`  ← bare file at repo root
- [ ] `rm '<parameter name="path">test2.txt</parameter>'`
- [ ] `rm '<parameter name="path">/Users/ninadhirani/Desktop/ai-project/table-fix.md</parameter>'`
- [ ] `rm '<parameter name="path">/Users/ninadhirani/Desktop/ai-project/test.txt</parameter>'`
- [ ] `rm -rf "Users/"`  ← entire stale local-machine path tree accidentally committed
- [ ] `rmdir "app/components/Chat"`  ← empty directory, leftover from planned refactor

---

## PHASE 2 — Delete Orphaned Root-Level Component Duplicates
> `app/page.tsx` imports from `./components/` — these root-level files are never used.

- [ ] `rm "app/Header.tsx"`  ← older version with dead "⚙️ Settings" button and "Beta" badge
- [ ] `rm "app/ModeSwitcher.tsx"`  ← identical to `app/components/ModeSwitcher.tsx`
- [ ] `rm "app/FileUpload.tsx"`  ← older version missing DOCX support, progress bars, bulk delete
- [ ] Confirm: `grep -r "from.*['\"]./Header\|from.*['\"]./FileUpload\|from.*['\"]./ModeSwitcher" app/` → no results

---

## PHASE 3 — Delete Unused ChatHistory Component
> Replaced by the inline Past Chats dropdown inside `ChatPanel`. Never imported anywhere.

- [ ] `rm "app/components/ChatHistory.tsx"`
- [ ] Confirm: `grep -r "ChatHistory" app/` → no results

---

## PHASE 4 — Fix ChatPanel Interface (Phantom Props)
> `mode` and `updatedAt` are in `ChatPanelProps` but never passed by the parent and never read inside the component.

- [ ] Open `app/components/ChatPanel.tsx`
- [ ] In the `ChatPanelProps` interface, **remove** these two lines:
  ```ts
  mode: string;
  updatedAt: string;
  ```
- [ ] Run `npx tsc --noEmit` — should produce zero new errors

---

## PHASE 5 — Extract Shared Types into `lib/types.ts`
> The `Document` interface is copy-pasted identically in 4 places. Consolidate into one shared file.

**Current duplicates:**
- `app/page.tsx` → `interface Document { id, name, type, status, chunkCount? }`
- `app/FileUpload.tsx` (dead, deleted in Phase 2) → same shape
- `app/components/FileUpload.tsx` → same + `size?, error?, progress?`
- `app/components/ChatPanel.tsx` → `interface UploadedDocument` — same base shape, different name

**Steps:**
- [ ] Create `lib/types.ts` with a single canonical interface:
  ```ts
  export interface UploadedDocument {
    id: string;
    name: string;
    type: string;
    status: "ready" | "processing" | "error";
    chunkCount?: number;
    size?: number;
    error?: string;
    progress?: number;
  }
  ```
- [ ] In `app/page.tsx`: remove local `interface Document`, import `UploadedDocument` from `@/lib/types`, rename usages
- [ ] In `app/components/FileUpload.tsx`: remove local `interface Document`, import `UploadedDocument` from `@/lib/types`
- [ ] In `app/components/ChatPanel.tsx`: remove local `interface UploadedDocument`, import from `@/lib/types`
- [ ] Run `npx tsc --noEmit` to confirm no type errors

---

## PHASE 6 — Consolidate File Upload Constants
> `ALLOWED_TYPES`, `ALLOWED_EXTENSIONS`, and `MAX_FILE_SIZE` are scattered across frontend and backend with slight inconsistencies (old `app/FileUpload.tsx` was missing `.docx` entirely).

- [ ] Add to `lib/types.ts` (same file from Phase 5):
  ```ts
  export const ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/csv",
  ];
  export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv"];
  export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  ```
- [ ] In `app/components/FileUpload.tsx`: remove the local `ALLOWED_TYPES`, `ALLOWED_EXTENSIONS`, `MAX_FILE_SIZE` constants, import from `@/lib/types`
- [ ] In `lib/document-processor.ts`: replace the local `supportedExtensions` array with `ALLOWED_EXTENSIONS` imported from `@/lib/types`; replace the hardcoded 10MB check with `MAX_FILE_SIZE`
- [ ] In `app/api/documents/upload/route.ts`: replace local `MAX_FILE_SIZE` with import from `@/lib/types`
- [ ] In `app/components/FileUpload.tsx` JSX `<input accept=...>`: replace the hardcoded string with `ALLOWED_EXTENSIONS.join(",")` — single source of truth going forward

---

## PHASE 7 — Deduplicate Document Delete Logic
> Document deletion is implemented in three separate places with duplicated raw fetch calls.

**Current duplicate locations:**
1. `app/page.tsx` → `handleClearDocuments()` — fetches all docs then deletes each
2. `app/components/FileUpload.tsx` → `handleDelete()` + `handleDeleteAll()` — best implementation
3. `app/components/ChatPanel.tsx` line ~551 — inline `onClick` fetch DELETE inside JSX

**Steps:**
- [ ] Extract a shared `lib/documents.ts` with two helpers:
  ```ts
  export async function deleteDocument(id: string): Promise<void> { ... }
  export async function deleteAllDocuments(): Promise<void> { ... }
  ```
- [ ] In `app/components/FileUpload.tsx`: replace the internal fetch calls in `handleDelete` and `handleDeleteAll` with the shared helpers
- [ ] In `app/page.tsx`: replace `handleClearDocuments` implementation with a call to `deleteAllDocuments()` from `lib/documents.ts`
- [ ] In `app/components/ChatPanel.tsx`: replace the inline raw `fetch(...DELETE...)` in the doc list panel with a call to `deleteDocument(doc.id)` then update state

---

## PHASE 8 — Extract `formatChatDate` to a Shared Utility
> Near-identical date-formatting logic exists in both `ChatHistory.tsx` (deleted in Phase 3) and `ChatPanel.tsx`. Extract now to prevent re-duplication.

- [ ] Create `lib/utils.ts` with:
  ```ts
  export function formatChatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) return "Today";
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
      if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateString;
    }
  }
  ```
- [ ] In `app/components/ChatPanel.tsx`: remove the local `formatChatDate` function, import from `@/lib/utils`

---

## PHASE 9 — Deduplicate `GROQ_MODEL` Constant
> `GROQ_MODEL = "llama-3.3-70b-versatile"` is hardcoded in **two separate files** independently.

**Current locations:**
- `app/api/chat/route.ts` line 69: `const GROQ_MODEL = "llama-3.3-70b-versatile";`
- `lib/copilot-engine.ts` line 24: `const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";`

**Steps:**
- [ ] Add to `lib/config.ts` (new file) or `lib/types.ts`:
  ```ts
  export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  ```
- [ ] Remove the local `const GROQ_MODEL` from `app/api/chat/route.ts`; import from `@/lib/config`
- [ ] Remove the local `const GROQ_MODEL` from `lib/copilot-engine.ts`; import from `@/lib/config`

---

## PHASE 10 — Consolidate `"anonymous"` User ID
> The string `"anonymous"` is hardcoded in 5 separate places. A future auth integration should only need to change one constant.

**Current occurrences:**
- `app/api/chat/route.ts` → `const DEFAULT_USER_ID = "anonymous"` ✅ already a constant
- `app/api/chat/sessions/route.ts` → `|| "anonymous"` (appears twice)
- `app/api/documents/upload/route.ts` → `const userId = "anonymous"; // TODO`
- `app/components/ChatPanel.tsx` → `?userId=anonymous` hardcoded in a fetch URL

**Steps:**
- [ ] Move `DEFAULT_USER_ID` from `app/api/chat/route.ts` into `lib/config.ts`
- [ ] In `app/api/chat/sessions/route.ts`: replace both `"anonymous"` literals with `DEFAULT_USER_ID` imported from `@/lib/config`
- [ ] In `app/api/documents/upload/route.ts`: replace `"anonymous"` with `DEFAULT_USER_ID` import; keep the `// TODO: Get from session/auth` comment
- [ ] In `app/components/ChatPanel.tsx`: replace the hardcoded `?userId=anonymous` with a constant or prop

---

## PHASE 11 — Fix Sandbox / Chat Mode Type Mismatch
> `app/sandbox/page.tsx` uses mode keys like `"concept-refresh"`, `"formula-drill"` etc. for prompt building. `app/components/ChatPanel.tsx`'s `modeContent` uses `"study"` and `"deepExplore"`. These are completely different enumerations with no shared type, silently diverging.

- [ ] Add to `lib/types.ts`:
  ```ts
  export type ChatMode = "study" | "deepExplore";

  export type SandboxStudyMode =
    | "concept-refresh"
    | "formula-drill"
    | "past-paper"
    | "flashcards"
    | "mistake-fix"
    | "compare-contrast"
    | "case-study"
    | "step-by-step";
  ```
- [ ] In `app/components/ChatPanel.tsx`: replace `"study" | "deepExplore"` literals with imported `ChatMode`
- [ ] In `app/sandbox/page.tsx`: replace the local `string` type for `studyMode` state with `SandboxStudyMode`
- [ ] This is a type-safety fix — no runtime behaviour change, but TypeScript will catch future mode key typos

---

## PHASE 12 — Wire Up the Weakness Analyzer
> `lib/weakness-analyzer.ts` is fully built and exports `analyzeMessageForWeakness` and `generateWeaknessPromptAddition`. The student memory system that feeds it IS already active in the chat route. This is a 10-line wiring job.

- [ ] Open `app/api/chat/route.ts`
- [ ] Add import:
  ```ts
  import { analyzeMessageForWeakness, generateWeaknessPromptAddition } from "@/lib/weakness-analyzer";
  ```
- [ ] Find the section where `weakAreas` is fetched from `getWeakAreas()` and add directly after:
  ```ts
  const weaknessAnalysis = analyzeMessageForWeakness(message, studentProfile);
  const weaknessAddition = generateWeaknessPromptAddition(weakAreas, weaknessAnalysis);
  ```
- [ ] Append `weaknessAddition` to the system prompt string (before sending to the LLM)
- [ ] Test: have a multi-turn chat on a topic, then ask the same topic again — verify the response acknowledges prior weakness patterns

---

## PHASE 13 — Expose PYQ Engine in the UI
> `lib/pyq-store.ts` + `lib/pyq-analyzer.ts` + `app/api/pyq` form a complete Past Year Question intelligence system. There is no UI entry point anywhere in the app.

- [ ] Create `app/pyq/page.tsx`
- [ ] Add nav link in `app/components/Header.tsx`:
  ```tsx
  <a href="/pyq" className="nav-link">📋 Past Papers</a>
  ```
- [ ] Minimum viable page UI:
  - Subject selector dropdown → calls `GET /api/pyq?action=subjects`
  - "Analyze" button → calls `GET /api/pyq?action=insights&subject=<selected>`
  - Topic frequency table → calls `GET /api/pyq?action=analyze-topics&subject=<selected>`
  - Marks distribution chart → calls `GET /api/pyq?action=marks-distribution&subject=<selected>`
  - Optional: "Upload PYQs" section → calls `POST /api/pyq` with `{ questions: [...] }`

---

## PHASE 14 — Wire Mini GPT Lab to Its API Routes
> The Header nav links to `/sandbox` as "🧪 Mini GPT Lab" — but `sandbox/page.tsx` is only a prompt builder and never calls `/api/mini-gpt` or `/api/mini-gpt-karpathy`. Both proxy routes exist but are completely unreachable from the UI.

- [ ] Add a third tab `"lab"` to `app/sandbox/page.tsx` alongside `"study"` and `"about"`
- [ ] In the "lab" tab, build a minimal interface:
  - **Status check** on load → `GET /api/mini-gpt?endpoint=health` — show whether the Python server is running
  - **Train** button with configurable epochs/learning rate → `POST /api/mini-gpt?endpoint=train`
  - **Generate** input → `POST /api/mini-gpt?endpoint=generate` — display AI output
  - Loading states and error messages for when the Python server is offline
- [ ] Update the nav label in `app/components/Header.tsx` from `"🧪 Mini GPT Lab"` to something accurate, or keep it and ensure the lab tab is the default active tab on that page

---

## PHASE 15 — Add a Debug Panel Page (Dev-Only)
> Three powerful diagnostic routes exist (`/api/debug/documents`, `/api/debug/pipeline`, `/api/debug/vector-store`) but they're only accessible by manually typing URLs. No UI surfaces them.

- [ ] Create `app/debug/page.tsx` — guarded at the top with:
  ```ts
  if (process.env.NODE_ENV !== "development" && !process.env.NEXT_PUBLIC_DEBUG) {
    redirect("/");
  }
  ```
- [ ] Three collapsible panels on the page:
  - **Pipeline Health** → `GET /api/debug/pipeline?full=true` — shows pass/warn/fail per step
  - **Documents & Chunks** → `GET /api/debug/documents` — table of stored docs and chunk counts
  - **Vector Store** → `GET /api/debug/vector-store` — stats + retrieval logs; "Clear Logs" button → `DELETE /api/debug/vector-store`
- [ ] Do NOT add a nav link — access via direct URL `/debug` in development only

---

## Summary Table

| # | Phase | Type | Est. Time |
|---|---|---|---|
| 1 | Delete junk/accidental files | Dead code | 2 min |
| 2 | Delete root-level duplicate components | Dead code | 2 min |
| 3 | Delete unused ChatHistory component | Dead code | 2 min |
| 4 | Fix ChatPanel phantom props | Dead code | 5 min |
| 5 | Extract shared Document type → `lib/types.ts` | Redundancy | 20 min |
| 6 | Consolidate file upload constants | Redundancy | 15 min |
| 7 | Deduplicate document delete logic | Redundancy | 30 min |
| 8 | Extract `formatChatDate` utility | Redundancy | 10 min |
| 9 | Deduplicate `GROQ_MODEL` constant | Redundancy | 10 min |
| 10 | Consolidate `"anonymous"` userId | Redundancy | 10 min |
| 11 | Fix sandbox/chat mode type mismatch | Redundancy | 15 min |
| 12 | Wire weakness analyzer | Feature wiring | 30 min |
| 13 | Expose PYQ engine in UI | Feature wiring | 2–3 hrs |
| 14 | Wire Mini GPT Lab to API routes | Feature wiring | 1–2 hrs |
| 15 | Add dev debug panel page | Feature wiring | 1 hr |