# Support KB QA - Quick Reference Card

## Commands

```bash
# Verify test suite
npx tsx scripts/verify-qa-setup.ts [suite-path]

# Run QA tests (default suite)
pnpm run test:kb-qa

# Run QA tests (custom suite)
npx tsx scripts/run-support-kb-qa.ts path/to/suite.json

# View report
cat support-kb-qa.report.json | jq
```

## Test Case Template

```json
{
  "name": "Descriptive test name",
  "app_slug": "resume-coach",
  "message": "User query here",
  "route": "/route/path",
  "page_url": "https://app.com/page",
  "conversation_history": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ],
  "expected": {
    "resolved": true,
    "action": "answer_now",
    "reason": "kb_hit",
    "expectedTitle": "KB Article Title",
    "topN": 3
  }
}
```

## Validation Rules

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `resolved` | Yes | `true`, `false` | Did KB answer? |
| `action` | No | `answer_now`, `create_ticket` | Triage action |
| `reason` | No | `kb_hit`, `no_kb_match`, `system_signal`, `bug_signal`, `feature_signal`, `forced` | Triage reason |
| `expectedTitle` | Recommended | String | KB article title to find in top N |
| `topN` | No | Number (default: 3) | Check top N sources for title |

## Common Patterns

### KB Should Answer (resolved=true)
```json
{
  "message": "How do I upload a resume?",
  "expected": {
    "resolved": true,
    "expectedTitle": "Upload a resume",
    "topN": 3
  }
}
```

### Should Create Ticket (resolved=false)
```json
{
  "message": "500 error when uploading",
  "expected": {
    "resolved": false,
    "action": "create_ticket",
    "reason": "system_signal"
  }
}
```

### With Route Context
```json
{
  "message": "error",
  "route": "/submit",
  "expected": {
    "resolved": true,
    "expectedTitle": "Fix upload errors"
  }
}
```

### With Conversation History
```json
{
  "message": "What about pasting?",
  "conversation_history": [
    { "role": "user", "content": "How do I upload?" },
    { "role": "assistant", "content": "Click upload button..." }
  ],
  "expected": {
    "resolved": true,
    "expectedTitle": "Copy and paste resume text"
  }
}
```

## Triage Reasons

| Reason | When Used | Example |
|--------|-----------|---------|
| `kb_hit` | KB article matched and answered | "How do I upload?" → Upload article |
| `no_kb_match` | No KB article found or weak match | "Random question" → Create ticket |
| `system_signal` | Hard/soft system signals detected | "500 error" → Create ticket |
| `bug_signal` | Bug keywords detected | "Upload broken" → Create ticket |
| `feature_signal` | Feature request detected | "Please add X" → Create ticket |
| `forced` | `force_ticket: true` set | Any query with force flag |

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed (check `support-kb-qa.report.json`)

## Files

- **Test Suites**: `data/kb_qa_suite.*.json`
- **Report**: `support-kb-qa.report.json`
- **Docs**: `docs/support-kb-qa-testing.md`
- **Runner**: `scripts/run-support-kb-qa.ts`
- **Validator**: `scripts/verify-qa-setup.ts`

## Environment

```bash
PAYLOAD_URL=https://cms.resumecoach.me  # Default API endpoint
```

## Typical Workflow

1. Write KB articles → `scripts/seed-kb-v1.ts`
2. Write test cases → `data/kb_qa_suite.phase1.json`
3. Verify suite → `npx tsx scripts/verify-qa-setup.ts`
4. Run tests → `pnpm run test:kb-qa`
5. Review failures → `cat support-kb-qa.report.json`
6. Fix issues (update KB triggers or test expectations)
7. Re-run until all pass
8. Commit for regression testing

---

**Full Documentation**: `docs/support-kb-qa-testing.md`
