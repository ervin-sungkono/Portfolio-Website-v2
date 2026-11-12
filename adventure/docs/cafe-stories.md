# Café conversation content

Edit `src/content/cafe.json` to add the owner's real stories. Each entry under `personalTopics` has a `question` (the visitor's menu choice) and an `answer` (the text shown in response). For example:

```json
{
  "question": "What have you been enjoying lately?",
  "answer": "Add your own answer here."
}
```

Add only experiences or answers the owner wants to share. `townTopics` provides general, non-personal conversation; incomplete entries with an empty question or answer stay hidden. When there are no personal answers, the café says more personal stories are on the way. Rebuild and redeploy after editing. Run `node tests/cafe.test.mjs` to check the conversation routes.
