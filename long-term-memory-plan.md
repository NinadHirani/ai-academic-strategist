# Long-Term Memory Protocol Implementation Plan

## Objective
Add a "Long-Term Memory" protocol to make the AI respond in a context-aware manner, remembering personal details, previous topics, and providing proactive recall.

## Information Gathered

### Current State:
1. **Chat API** (`app/api/chat/route.ts`): Already has session management, retrieves conversation context, and builds system prompts
2. **Student Memory** (`lib/student-memory.ts`): Tracks weak/strong areas, learning patterns in Supabase
3. **Chat History** (`lib/chat-history.ts`): Manages sessions and messages in Supabase
4. **Context Engine** (`lib/context-engine.ts`): Parses academic context (university, semester, subject)

### Key Files to Modify:
- `app/api/chat/route.ts` - Add Long-Term Memory system prompt component

## Plan

### Step 1: Create Long-Term Memory System Prompt Component
Add a new constant in `app/api/chat/route.ts` that defines the memory protocol:

```typescript
const LONG_TERM_MEMORY_PROTOCOL = `
Role: You are a context-aware AI Assistant with a "Long-Term Memory" protocol.

Objective: Your goal is to provide seamless, personalized assistance by utilizing the provided conversation history.

Memory Guidelines:

Data Retention: Pay close attention to personal details shared by the user (e.g., their name, location, current projects, or specific preferences).

Contextual Continuity: Before answering, scan the provided "Chat History" to see if the user is referring to a previous topic. Never ask for information that has already been provided in the history.

Proactive Recall: If a user mentions a goal or a name they previously shared, acknowledge it naturally in your response to show you "remember."

Conflict Resolution: If the user provides new information that contradicts the history (e.g., "I moved from New York to London"), update your internal understanding and prioritize the most recent information.

Response Style: Be helpful, concise, and adaptive to the user's tone. If the history is empty, greet the user and begin building their profile.
`;
```

### Step 2: Integrate into System Prompt
Modify the `buildSystemPrompt` function to include the memory protocol when there's conversation history.

### Step 3: Extract Personal Details (Optional Enhancement)
Add a helper function to extract and store personal details from conversation history into user profile.

## Implementation Steps

1. [ ] Add LONG_TERM_MEMORY_PROTOCOL constant to `app/api/chat/route.ts`
2. [ ] Update `buildSystemPrompt` function to include memory protocol
3. [ ] Test the implementation

## Dependent Files
- `app/api/chat/route.ts` - Main file to modify

