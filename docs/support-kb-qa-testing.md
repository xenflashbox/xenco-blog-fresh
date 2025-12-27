# Support KB QA Testing System

Automated QA testing framework for the Support Knowledge Base system. Tests validate that the `/api/support/ticket` endpoint correctly resolves user queries against KB articles or creates tickets when appropriate.

## Quick Start

```bash
# Run default test suite (data/kb_qa_suite.phase1.json)
pnpm run test:kb-qa

# Run custom test suite
npx tsx scripts/run-support-kb-qa.ts path/to/custom_suite.json
```

## How It Works

The QA runner:

1. **Loads** a JSON test suite containing test cases
2. **Executes** each test by POSTing to `/api/support/ticket`
3. **Validates** the response against expected outcomes
4. **Reports** results to `support-kb-qa.report.json`
5. **Exits** with code 1 if any failures, 0 if all pass

## Test Case Format

```typescript
{
  "name": "Upload resume - basic question",
  "app_slug": "resume-coach",
  "message": "How do I upload a resume?",
  "route": "/dashboard",                    // optional
  "page_url": "https://app.com/dashboard",  // optional
  "conversation_history": [                 // optional
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello!" }
  ],
  "expected": {
    "resolved": true,                       // required: did KB answer?
    "action": "answer_now",                 // optional: 'answer_now' | 'create_ticket'
    "reason": "kb_hit",                     // optional: triage reason
    "expectedTitle": "Upload a resume",     // optional: KB article title to find
    "topN": 3                               // optional: check top N sources (default: 3)
  }
}
```

## Expected Response Fields

The QA runner validates these fields from `/api/support/ticket`:

### For resolved=true (KB answered)
```json
{
  "ok": true,
  "resolved": true,
  "answer": "You can upload your resume by...",
  "sources": [
    {
      "id": "123",
      "type": "support_kb_article",
      "title": "Upload a resume",
      "summary": "Learn how to upload..."
    }
  ],
  "triage": {
    "category": "user_error",
    "action": "answer_now",
    "reason": "kb_hit",
    "confidence": 0.85
  },
  "gate": {
    "passed": true,
    "reason": "passed",
    "lexicalScore": 0.75,
    "rankingScore": 0.82
  }
}
```

### For resolved=false (ticket created)
```json
{
  "ok": true,
  "ticket": {
    "id": "456",
    "created_at": "2025-12-27T12:00:00Z",
    "app_slug": "resume-coach",
    "severity": "medium",
    "triage": {
      "category": "feature_request",
      "action": "create_ticket",
      "reason": "feature_signal"
    }
  }
}
```

## Validation Logic

The runner performs these checks:

1. **Resolved Status**: `resolved` matches expected (required)
2. **Triage Action**: `triage.action` matches expected (if specified)
3. **Triage Reason**: `triage.reason` matches expected (if specified)
4. **KB Title Match**: For resolved=true cases, checks if `expectedTitle` appears in top N sources

### Example Validations

```javascript
// PASS: Resolved correctly, title in top 3
{
  expected: { resolved: true, expectedTitle: "Upload a resume", topN: 3 },
  got: { resolved: true, sources: [
    { title: "Upload a resume" },  // ✅ Found in top 3
    { title: "Copy and paste" }
  ]}
}

// FAIL: Title not in top 3
{
  expected: { resolved: true, expectedTitle: "Upload a resume", topN: 3 },
  got: { resolved: true, sources: [
    { title: "Copy and paste" },
    { title: "Fix upload errors" },
    { title: "Find results" },
    { title: "Upload a resume" }  // ❌ Position 4, outside topN
  ]}
}

// FAIL: Wrong action
{
  expected: { resolved: false, action: "create_ticket" },
  got: { resolved: true, triage: { action: "answer_now" } }  // ❌ Should create ticket
}
```

## Report Format

Results are saved to `support-kb-qa.report.json`:

```json
{
  "timestamp": "2025-12-27T12:00:00.000Z",
  "suiteFile": "data/kb_qa_suite.phase1.json",
  "total": 20,
  "passed": 18,
  "failed": 2,
  "failures": [
    {
      "testName": "Upload resume - basic question",
      "query": "How do I upload a resume?",
      "route": "/dashboard",
      "expected": {
        "resolved": true,
        "expectedTitle": "Upload a resume",
        "topN": 3
      },
      "got": {
        "resolved": true,
        "sources": [
          { "id": "1", "title": "Copy and paste resume text" },
          { "id": "2", "title": "Fix upload errors" },
          { "id": "3", "title": "Find your results" }
        ],
        "gate": {
          "passed": true,
          "reason": "passed",
          "lexicalScore": 0.4
        },
        "confidence": 0.4
      },
      "reason": "Expected title \"Upload a resume\" not found in top 3 sources. Got: Copy and paste resume text, Fix upload errors, Find your results"
    }
  ]
}
```

## Sample Test Suite

See `data/kb_qa_suite.phase1.json` for a complete example with 20 test cases covering:

- ✅ Basic upload questions
- ✅ Account/auth issues
- ✅ Billing questions
- ✅ Error troubleshooting
- ✅ Privacy/security
- ✅ Feature requests (should create ticket)
- ✅ No KB match (should create ticket)

## Environment Variables

```bash
PAYLOAD_URL=https://cms.resumecoach.me  # API endpoint (default)
```

## Writing Good Test Cases

### DO ✅

```javascript
// Test natural language variations
{
  name: "Upload - how do I phrasing",
  message: "How do I upload a resume?",
  expected: { resolved: true, expectedTitle: "Upload a resume" }
},
{
  name: "Upload - what is phrasing",
  message: "What's the process for submitting my resume?",
  expected: { resolved: true, expectedTitle: "Upload a resume" }
}

// Test route-specific context
{
  name: "Upload error on submit page",
  message: "Upload failed",
  route: "/submit",
  expected: { resolved: true, expectedTitle: "Fix upload errors" }
}

// Test triage logic
{
  name: "Feature request detection",
  message: "Please add LinkedIn import",
  expected: { resolved: false, action: "create_ticket", reason: "feature_signal" }
}
```

### DON'T ❌

```javascript
// Too broad - won't help debug failures
{
  name: "Test 1",
  message: "upload",
  expected: { resolved: true }
}

// No expectedTitle for resolved=true cases
{
  message: "How do I upload?",
  expected: { resolved: true }  // ❌ Add expectedTitle to validate ranking
}

// Unrealistic expectations
{
  message: "Why is the moon made of cheese?",
  expected: { resolved: true }  // ❌ KB can't answer this
}
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Support KB QA Tests
  run: pnpm run test:kb-qa
  env:
    PAYLOAD_URL: ${{ secrets.PAYLOAD_URL }}
```

## Troubleshooting

### All tests failing with network errors

- Check `PAYLOAD_URL` is correct
- Verify API is running and accessible
- Check firewall/VPN settings

### Tests passing locally but failing in CI

- Ensure CI has access to API endpoint
- Check environment variables are set in CI
- Verify MeiliSearch index is populated

### Expected title not in top N sources

- Check if KB article exists with that title
- Review `triggersText` field - may need more keywords
- Increase `topN` if article ranks lower (4-5)
- Check `route` matching - article may need route added

### Resolved mismatch (expected true, got false)

- KB article may not exist yet - seed KB first
- Check query normalization - may need better triggers
- Review relevance gate - lexical/ranking scores too low
- Add conversation context if query is follow-up

## Development Workflow

1. **Write KB articles** using `scripts/seed-kb-v1.ts`
2. **Write test cases** in `data/kb_qa_suite.*.json`
3. **Run tests** with `pnpm run test:kb-qa`
4. **Review failures** in `support-kb-qa.report.json`
5. **Fix issues**:
   - Update KB article triggers/content
   - Adjust test expectations
   - Fix triage logic in `/api/support/ticket`
6. **Re-run** until all tests pass
7. **Commit** test suite for regression testing

## Advanced Test Cases

### Conversation Context

Test follow-up questions:

```json
{
  "name": "Follow-up question with context",
  "app_slug": "resume-coach",
  "message": "What about pasting it instead?",
  "conversation_history": [
    { "role": "user", "content": "How do I upload a resume?" },
    { "role": "assistant", "content": "You can upload by clicking..." }
  ],
  "expected": {
    "resolved": true,
    "expectedTitle": "Copy and paste resume text"
  }
}
```

### Route-Specific Ranking

Test route boost:

```json
{
  "name": "Upload on submit page (route boost)",
  "app_slug": "resume-coach",
  "message": "upload",
  "route": "/submit",
  "expected": {
    "resolved": true,
    "expectedTitle": "Upload a resume"
  }
}
```

### Triage Logic

Test signal detection:

```json
{
  "name": "Hard system signal - 500 error",
  "message": "Getting 500 error when uploading",
  "expected": {
    "resolved": false,
    "action": "create_ticket",
    "reason": "system_signal"
  }
},
{
  "name": "Bug signal - upload failed",
  "message": "Upload broken, keeps failing",
  "expected": {
    "resolved": false,
    "action": "create_ticket",
    "reason": "bug_signal"
  }
}
```

## Contributing

When adding new KB articles:

1. Add test cases to validate the article can be found
2. Test multiple phrasings (natural language variations)
3. Test route-specific context if article has routes
4. Run full test suite to avoid regressions

---

**Last Updated**: 2025-12-27
**Version**: 1.0.0
