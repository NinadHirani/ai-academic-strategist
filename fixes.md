# 🔧 Complete Fix Guide — `ai-academic-strategist`
> Every broken, partial, and dead-wiring issue with exact code to paste.  
> Apply fixes in order — earlier fixes are dependencies of later ones.

---

## TABLE OF CONTENTS

| # | Fix | Severity | File(s) |
|---|-----|----------|---------|
| 1 | `ChatSession` type missing in ChatPanel | 🔴 Critical | `ChatPanel.tsx` |
| 2 | Phantom props `mode` and `updatedAt` in ChatPanelProps | 🔴 Critical | `ChatPanel.tsx` |
| 3 | `onDocumentsChange` never passed to ChatPanel | 🔴 Critical | `page.tsx` |
| 4 | Delete session button missing from Past Chats dropdown | 🟠 High | `ChatPanel.tsx` |
| 5 | Header "About" link is a dead `href="#"` | 🟠 High | `Header.tsx` |
| 6 | Wire `weakness-analyzer` into the chat route | 🟠 High | `app/api/chat/route.ts` |
| 7 | Sandbox Favorite Prompts lost on page reload | 🟡 Medium | `sandbox/page.tsx` |
| 8 | Copilot resource links open without safety check | 🟡 Medium | `copilot/page.tsx` |

---

## FIX 1 — `ChatSession` type missing in ChatPanel
**Severity:** 🔴 Critical — TypeScript compilation error  
**File:** `app/components/ChatPanel.tsx`  
**Problem:** `useState<ChatSession[]>` at line 252 uses a type that is only declared in `ChatHistory.tsx` (a dead file that's never imported). This will throw a TypeScript error.

**Find this block** (around line 14, inside the interface declarations at the top of the file):

```tsx
interface ChatPanelProps {
  activeMode: "study" | "deepExplore";
```

**Add the `ChatSession` interface directly above `ChatPanelProps`:**

```tsx
// ADD THIS — was only defined in ChatHistory.tsx (dead file, never imported)
interface ChatSession {
  id: string;
  title: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatPanelProps {
  activeMode: "study" | "deepExplore";
```

---

## FIX 2 — Remove phantom props `mode` and `updatedAt` from ChatPanelProps
**Severity:** 🔴 Critical — TypeScript error; breaks callers  
**File:** `app/components/ChatPanel.tsx`  
**Problem:** `mode: string` and `updatedAt: string` are declared as **required** props in `ChatPanelProps`. They are never passed by `page.tsx`, and never used anywhere in the component body. TypeScript will report a missing required prop error on every render.

**Find this exact block** (around line 14):

```tsx
interface ChatPanelProps {
  activeMode: "study" | "deepExplore";
  documents?: UploadedDocument[];
  onRequestUpload?: () => void;
  onClearDocuments?: () => void | Promise<void>;
  onDocumentsChange?: (docs: UploadedDocument[]) => void;
  mode: string;
  updatedAt: string;
}
```

**Replace with** (remove the two phantom lines):

```tsx
interface ChatPanelProps {
  activeMode: "study" | "deepExplore";
  documents?: UploadedDocument[];
  onRequestUpload?: () => void;
  onClearDocuments?: () => void | Promise<void>;
  onDocumentsChange?: (docs: UploadedDocument[]) => void;
}
```

---

## FIX 3 — Pass `onDocumentsChange` to `<ChatPanel>` in page.tsx
**Severity:** 🔴 Critical — state desync bug  
**File:** `app/page.tsx`  
**Problem:** ChatPanel has a doc-panel (📚 badge) that lets users delete individual documents. When a doc is deleted there, it calls `onDocumentsChange?.(updated)` to tell the parent. But `page.tsx` never passes this prop to `<ChatPanel>`, so the parent `documents` state is never updated. The deleted doc silently reappears on next render because the parent still holds the stale list.

**Find this block** (around line 109):

```tsx
        <ChatPanel 
          activeMode={activeMode} 
          documents={documents}
          onRequestUpload={handleRequestUpload}
          onClearDocuments={handleClearDocuments}
        />
```

**Replace with:**

```tsx
        <ChatPanel 
          activeMode={activeMode} 
          documents={documents}
          onRequestUpload={handleRequestUpload}
          onClearDocuments={handleClearDocuments}
          onDocumentsChange={handleDocumentsChange}
        />
```

---

## FIX 4 — Add "Delete session" button to Past Chats dropdown
**Severity:** 🟠 High — `DELETE /api/chat/sessions` is fully implemented but unreachable  
**File:** `app/components/ChatPanel.tsx`  
**Problem:** The backend `DELETE /api/chat/sessions?sessionId=...` route works perfectly. But there is no button in the UI to call it — users can never delete past conversations.

**Step A — Add a `handleDeleteSession` function.**

Find this function in ChatPanel.tsx (around line 260):

```tsx
  const fetchPastChats = async () => {
```

**Add the new function directly before it:**

```tsx
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // prevent the click from also selecting the session
    try {
      const resp = await fetch(
        `/api/chat/sessions?sessionId=${encodeURIComponent(sessionId)}`,
        { method: "DELETE" }
      );
      if (resp.ok) {
        // If the deleted session is the active one, reset to a new chat
        if (sessionId === sessionId) {
          setPastChats((prev) => prev.filter((c) => c.id !== sessionId));
        }
        // If currently viewing the deleted session, reset to fresh chat
        setSessionId((current) => {
          if (current === sessionId) {
            setMessages([{
              id: "welcome",
              role: "assistant",
              content: "welcome",
              timestamp: new Date(),
            }]);
            return null;
          }
          return current;
        });
        setPastChats((prev) => prev.filter((c) => c.id !== sessionId));
      }
    } catch (err) {
      console.error("[ChatPanel] Error deleting session:", err);
    }
  };

  const fetchPastChats = async () => {
```

**Step B — Add the delete button inside each past-chat list item.**

Find this block in the JSX (the `.map()` over `pastChats`, around line 510):

```tsx
                        <div
                          key={chat.id}
                          className={`past-chat-item ${sessionId === chat.id ? "active" : ""}`}
                          onClick={() => handleSessionSelect(chat.id)}
                        >
                          <span className="past-chat-icon">{chat.mode === "deepExplore" ? "🌐" : "📚"}</span>
                          <div className="past-chat-info">
                            <span className="past-chat-title">{chat.title}</span>
                            <span className="past-chat-date">{formatChatDate(chat.updatedAt)}</span>
                          </div>
                        </div>
```

**Replace with:**

```tsx
                        <div
                          key={chat.id}
                          className={`past-chat-item ${sessionId === chat.id ? "active" : ""}`}
                          onClick={() => handleSessionSelect(chat.id)}
                        >
                          <span className="past-chat-icon">{chat.mode === "deepExplore" ? "🌐" : "📚"}</span>
                          <div className="past-chat-info">
                            <span className="past-chat-title">{chat.title}</span>
                            <span className="past-chat-date">{formatChatDate(chat.updatedAt)}</span>
                          </div>
                          <button
                            className="past-chat-delete-btn"
                            title="Delete this conversation"
                            onClick={(e) => handleDeleteSession(e, chat.id)}
                          >
                            🗑️
                          </button>
                        </div>
```

**Step C — Add CSS for the delete button** in `app/globals.css`:

```css
.past-chat-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.past-chat-delete-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: opacity 0.15s, background 0.15s;
  flex-shrink: 0;
}

.past-chat-item:hover .past-chat-delete-btn {
  opacity: 1;
}

.past-chat-delete-btn:hover {
  background: rgba(239, 68, 68, 0.15);
}
```

---

## FIX 5 — Fix the dead "About" nav link
**Severity:** 🟠 High — broken nav item visible on every page  
**File:** `app/components/Header.tsx`

**Option A (Recommended) — Create a real About modal/page**

First create `app/about/page.tsx`:

```tsx
"use client";

import React from "react";
import Header from "../components/Header";

export default function AboutPage() {
  return (
    <div className="app-container">
      <Header />
      <main className="main-content" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 16 }}>About AI Academic Strategist</h1>
        <p style={{ fontSize: "1.1rem", lineHeight: 1.7, marginBottom: 16 }}>
          AI Academic Strategist is a study intelligence platform built to help university students
          learn smarter — not harder. It combines RAG-powered document Q&A, an AI Academic Copilot
          for syllabus-driven roadmaps, and a personalised memory system that tracks your weak areas
          over time.
        </p>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Features</h2>
        <ul style={{ lineHeight: 2, paddingLeft: 24 }}>
          <li>📚 <strong>Study Mode</strong> — Upload your notes and ask anything via RAG</li>
          <li>🌐 <strong>DeepExplore Mode</strong> — Structured deep-dives into complex topics</li>
          <li>🎓 <strong>Academic Copilot</strong> — Syllabus search, roadmap generation, topic expansion</li>
          <li>🧪 <strong>Prompt Builder</strong> — Craft and save custom study prompts</li>
          <li>🧠 <strong>Student Memory</strong> — Tracks weak and strong areas across sessions</li>
        </ul>
        <p style={{ marginTop: 32, color: "#6B7280", fontSize: "0.9rem" }}>
          Built with Next.js, Groq LLM, Supabase, and a custom vector store.
        </p>
      </main>
    </div>
  );
}
```

Then fix the link in `app/components/Header.tsx`:

**Find:**
```tsx
          <a href="#" className="nav-link">About</a>
```

**Replace with:**
```tsx
          <a href="/about" className="nav-link">About</a>
```

---

**Option B (Quick fix) — Remove the dead link entirely**

If you don't want an About page right now, just remove the broken link:

**Find in `app/components/Header.tsx`:**
```tsx
          <a href="#" className="nav-link">About</a>
```

**Delete that line.** No broken anchor in the nav.

---

## FIX 6 — Wire `weakness-analyzer` into the chat route
**Severity:** 🟠 High — fully-built personalization feature doing nothing  
**File:** `app/api/chat/route.ts`

**Problem:** `lib/weakness-analyzer.ts` exports `getWeaknessPromptContext()` which builds a personalised "Student Learning Profile" block from the user's weak and strong areas stored in Supabase. The chat route already fetches `weakAreas` and `strongAreas` but only puts them into `userProfile`. The richer, more instructive prompt addition from `weakness-analyzer` is never used.

Additionally, `recordInteraction()` should be called after each response so the weakness model learns from every conversation turn.

---

**Step A — Add the import.**

Find the existing imports at the top of `app/api/chat/route.ts` (around line 1–7):

```ts
import { getStudentProfile, getWeakAreas, getStrongAreas } from "@/lib/student-memory";
```

**Add the new import on the next line:**

```ts
import { getWeaknessPromptContext, recordInteraction } from "@/lib/weakness-analyzer";
```

---

**Step B — Inject the weakness context into the system prompt.**

Find this block (around line 747):

```ts
    const systemPrompt = buildSystemPrompt(
      mode,
      retrievedContext,
      sources,
      userProfile,
      academicContext,
      null,
      null
    );
```

**Replace with:**

```ts
    // Build weakness context string from student's history
    let weaknessContext = "";
    try {
      weaknessContext = await getWeaknessPromptContext(userId);
    } catch (e) {
      console.warn("[Chat] Could not load weakness context:", e);
    }

    const systemPrompt = buildSystemPrompt(
      mode,
      retrievedContext,
      sources,
      userProfile,
      academicContext,
      null,
      weaknessContext || null   // <-- passes weakness context as syllabusContext fallback
    );
```

> **Note:** `buildSystemPrompt`'s 7th argument is `contextString`. When non-null it overrides `syllabusContext` and is printed under "Syllabus Context:" in the prompt. If you already use syllabusContext for something else, instead append `weaknessContext` to the system prompt string directly:
> ```ts
> const finalSystemPrompt = weaknessContext
>   ? systemPrompt + "\n\n" + weaknessContext
>   : systemPrompt;
> // then use finalSystemPrompt in the messages array instead of systemPrompt
> ```

---

**Step C — Record the interaction after each AI response.**

Find this block (around line 930, just after `assistantMessage` is extracted):

```ts
    if (currentSessionId) {
      try {
        await addMessage(currentSessionId, "assistant", assistantMessage);
      } catch (e) {
        console.error("[Chat] Save error:", e);
      }
    }
```

**Add the `recordInteraction` call directly after it:**

```ts
    if (currentSessionId) {
      try {
        await addMessage(currentSessionId, "assistant", assistantMessage);
      } catch (e) {
        console.error("[Chat] Save error:", e);
      }
    }

    // Record this turn so weakness-analyzer can track topic confidence over time
    try {
      await recordInteraction(userId, message, assistantMessage);
    } catch (e) {
      // Non-critical — log and continue
      console.warn("[Chat] recordInteraction failed (non-fatal):", e);
    }
```

---

## FIX 7 — Persist Sandbox Favorite Prompts across page reloads
**Severity:** 🟡 Medium — saved prompts are lost on every page reload  
**File:** `app/sandbox/page.tsx`

**Problem:** `favoritePrompts` is stored only in React state. Refreshing the page wipes everything.

**Step A — Replace the initial state declaration to load from `localStorage`.**

Find (around line 42):

```tsx
    const [favoritePrompts, setFavoritePrompts] = useState<string[]>([]);
```

**Replace with:**

```tsx
    const [favoritePrompts, setFavoritePrompts] = useState<string[]>(() => {
      try {
        const saved = localStorage.getItem("sandbox_favorite_prompts");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    });
```

**Step B — Add a `useEffect` to save to `localStorage` whenever favorites change.**

Find the `return (` that starts the JSX (around line 58, just before `<div className="app-container">`):

```tsx
  return (
    <div className="app-container">
```

**Add this `useEffect` block directly above the `return`:**

```tsx
  // Persist favorites to localStorage whenever they change
  React.useEffect(() => {
    try {
      localStorage.setItem("sandbox_favorite_prompts", JSON.stringify(favoritePrompts));
    } catch {
      // localStorage unavailable (private browsing etc.) — fail silently
    }
  }, [favoritePrompts]);

  return (
    <div className="app-container">
```

**Step C — Add a "Clear all" button next to the Favorites heading.**

Find the favorites heading (around line 285):

```tsx
                <h4 className={styles.favoritesTitle}>Favorite Prompts</h4>
```

**Replace with:**

```tsx
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 className={styles.favoritesTitle}>Favorite Prompts</h4>
                  <button
                    onClick={() => setFavoritePrompts([])}
                    style={{ fontSize: "0.75rem", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}
                    title="Clear all favorites"
                  >
                    Clear all
                  </button>
                </div>
```

**Step D — Add a per-item delete button** so users can remove individual favorites.

Find the favorites list item (around line 287):

```tsx
                  {favoritePrompts.map((fp, i) => (
                    <li key={i} className={styles.favoriteItem}>
                      <div className={styles.favoritePrompt}>{fp}</div>
                      <button
                        onClick={() => setStudyPrompt(fp)}
                        className={styles.useButton}
                      >Use</button>
                    </li>
                  ))}
```

**Replace with:**

```tsx
                  {favoritePrompts.map((fp, i) => (
                    <li key={i} className={styles.favoriteItem}>
                      <div className={styles.favoritePrompt}>{fp}</div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => setStudyPrompt(fp)}
                          className={styles.useButton}
                        >Use</button>
                        <button
                          onClick={() => setFavoritePrompts((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: 4, cursor: "pointer", padding: "2px 6px", fontSize: "0.8rem", color: "#9CA3AF" }}
                          title="Remove this favorite"
                        >✕</button>
                      </div>
                    </li>
                  ))}
```

---

## FIX 8 — Copilot resource links: prevent navigation on unverified URLs
**Severity:** 🟡 Medium — LLM-hallucinated URLs open directly without warning  
**File:** `app/copilot/page.tsx`

**Problem:** The `ResourceSection` component renders all URLs as `<a href={r.url} target="_blank">`. These URLs are generated by the LLM and are frequently hallucinated or broken. `r.verified` is false for most of them, but the user is taken to the URL immediately with no intermediate warning. There is also no `rel="noopener noreferrer"` safety — the page is already there but it should also show a confirmation for unverified links.

**Find the `ResourceSection` function** (around line 584):

```tsx
function ResourceSection({ title, resources }: { title: string; resources: WebResource[] }) {
  return (
    <div className="copilot-resource-section">
      <h4>{title}</h4>
      <div className="copilot-resource-list">
        {resources.map((r, i) => (
          <a
            key={i}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`copilot-resource-card ${!r.verified ? "unverified" : ""}`}
          >
            <div className="copilot-resource-title">
              {r.type === "video" || r.type === "playlist" ? "🎬 " : r.type === "academic" ? "🎓 " : "📄 "}
              {r.title}
            </div>
            <div className="copilot-resource-url">{r.url}</div>
            {r.snippet && <div className="copilot-resource-snippet">{r.snippet}</div>}
            {!r.verified && <span className="copilot-unverified-badge">⚠️ Unverified</span>}
          </a>
        ))}
      </div>
    </div>
  );
}
```

**Replace with:**

```tsx
function ResourceSection({ title, resources }: { title: string; resources: WebResource[] }) {
  const handleResourceClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    r: WebResource
  ) => {
    if (!r.verified) {
      e.preventDefault();
      const confirmed = window.confirm(
        `This link was generated by AI and has not been verified.\n\nURL: ${r.url}\n\nDo you want to open it anyway?`
      );
      if (confirmed) {
        window.open(r.url, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div className="copilot-resource-section">
      <h4>{title}</h4>
      <div className="copilot-resource-list">
        {resources.map((r, i) => (
          <a
            key={i}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`copilot-resource-card ${!r.verified ? "unverified" : ""}`}
            onClick={(e) => handleResourceClick(e, r)}
          >
            <div className="copilot-resource-title">
              {r.type === "video" || r.type === "playlist" ? "🎬 " : r.type === "academic" ? "🎓 " : "📄 "}
              {r.title}
            </div>
            <div className="copilot-resource-url">{r.url}</div>
            {r.snippet && <div className="copilot-resource-snippet">{r.snippet}</div>}
            {!r.verified && (
              <span className="copilot-unverified-badge" title="This URL was generated by AI and may not exist">
                ⚠️ Unverified — click to confirm
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
```

---

## VERIFICATION CHECKLIST

Run through these after applying all fixes:

```bash
# 1. TypeScript — should produce zero errors
npx tsc --noEmit

# 2. Dev server — should start without errors
npm run dev

# 3. Manual checks:
```

| Check | Expected |
|-------|----------|
| Open `/` — inspect ChatPanel props in React DevTools | `onDocumentsChange` prop present |
| Upload a file → click 📚 badge → delete a doc from panel | Doc disappears and stays gone after re-render |
| Open Past Chats dropdown → hover over a chat | 🗑️ delete button appears |
| Click 🗑️ on a past chat | Chat removed from list; if active, resets to new chat |
| Click "About" in nav | Navigates to `/about` page |
| Open Sandbox → save a favorite → refresh page | Favorite still appears |
| Open Sandbox → save a favorite → click ✕ | Individual favorite removed |
| Open Copilot → expand a topic → click an unverified resource link | Confirmation dialog shown before opening |
| Send multiple chat messages → check Supabase or logs | `recordInteraction` calls appear in server logs |
| Send chat about a topic you've asked before | Response reflects learning history (extra examples on weak topics) |

---

## OPTIONAL — Quick-win cleanups (no logic risk)

These don't affect functionality but reduce confusion:

```bash
# Delete junk files committed by accident
rm "app/api/chat/route.ts.bak"
rm "app/sandbox/page.tsx.bak"
rm "test-document.txt"
rm "1"
rm -rf "Users/"
rmdir "app/components/Chat"

# Delete dead duplicate root-level components (superseded by app/components/ versions)
rm "app/Header.tsx"
rm "app/FileUpload.tsx"
rm "app/ModeSwitcher.tsx"

# Delete ChatHistory.tsx — replaced by inline dropdown in ChatPanel
rm "app/components/ChatHistory.tsx"
```