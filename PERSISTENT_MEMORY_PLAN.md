# Persistent Long-Term Memory System Implementation Plan

## Objective
Modify the AI application to remember user details (name, preferences) across different chat sessions using a local JSON file as the permanent database.

## Information Gathered

### Current State:
1. **Chat API** (`app/api/chat/route.ts`): Already has:
   - Session management with chat history
   - LONG_TERM_MEMORY_PROTOCOL in system prompt
   - User profile injection via `[USER_PROFILE]` tags
   - Uses Supabase for storage (existing student-memory.ts)

2. **Student Memory** (`lib/student-memory.ts`): Tracks:
   - Weak/strong areas
   - Learning patterns
   - User profile data

3. **What's Missing:**
   - Local JSON file storage (user wants user_profile.json)
   - Auto-update logic to detect new user facts from AI responses

### Key Files to Modify:
- `lib/user-profile-json.ts` (NEW - JSON file management)
- `app/api/chat/route.ts` (Add update logic integration)

## Plan

### Step 1: Create JSON-based User Profile Storage
Create `lib/user-profile-json.ts` with functions to:
- Load user profile from JSON file
- Save user profile to JSON file  
- Update specific fields (name, university, interests, etc.)
- Auto-detect new facts from conversation

### Step 2: Create Fact Extraction Logic
Add function to scan AI responses for user facts:
- Name patterns: "My name is X", "I'm X", "I am X"
- Education: "I study at X", "I'm at X university", "I go to X"
- Other permanent facts: location, job, skills, preferences

### Step 3: Integrate with Chat API
Modify `app/api/chat/route.ts`:
- Load profile from JSON on each request
- Inject into system prompt
- After AI response, check for new facts and update JSON

### Step 4: Testing
- Test restart scenario: "What is my name?" should work after restart
- Verify JSON file updates correctly

## Implementation Steps

1. [ ] Create `lib/user-profile-json.ts` - JSON file storage module
2. [ ] Add fact extraction logic to detect user facts from AI responses
3. [ ] Modify `app/api/chat/route.ts` to use JSON profile and auto-update
4. [ ] Test the complete flow

## Dependent Files
- `app/api/chat/route.ts` - Main chat API
- `lib/student-memory.ts` - Existing profile system (will work alongside)

## Language: TypeScript/Node.js (Next.js)

