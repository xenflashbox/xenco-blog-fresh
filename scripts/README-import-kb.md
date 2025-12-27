# KB Article Import Script

## Overview

`import-support-kb.ts` is an idempotent script that imports KB articles from JSON files into Payload CMS using an upsert strategy (create or update).

## Features

- **Idempotent**: Safe to run multiple times - won't create duplicates
- **Upsert Strategy**: Updates existing articles or creates new ones
- **Batch Import**: Process multiple JSON files in one command
- **Normalization**: Automatically sets defaults for appSlug, _status, and routes
- **Detailed Logging**: Shows progress and summary statistics
- **Error Handling**: Continues processing if individual articles fail

## Usage

```bash
npx tsx scripts/import-support-kb.ts <file1.json> [file2.json] [file3.json] ...
```

### Examples

```bash
# Import single file
npx tsx scripts/import-support-kb.ts data/kb-articles.json

# Import multiple files
npx tsx scripts/import-support-kb.ts data/pack1.json data/pack2.json data/pack3.json

# Import with environment variables
PAYLOAD_URL=https://cms.example.com \
PAYLOAD_ADMIN_EMAIL=admin@example.com \
PAYLOAD_ADMIN_PASSWORD=secret \
npx tsx scripts/import-support-kb.ts data/*.json
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PAYLOAD_URL` | No | `https://cms.resumecoach.me` | Payload CMS base URL |
| `PAYLOAD_ADMIN_EMAIL` | Yes | - | Admin email for authentication |
| `PAYLOAD_ADMIN_PASSWORD` | Yes | - | Admin password for authentication |

## Article Structure

```typescript
interface KBArticle {
  appSlug?: string              // Default: 'resume-coach'
  title: string                 // REQUIRED - used for duplicate detection
  summary?: string
  bodyText?: string
  stepsText?: string
  triggersText?: string
  routes?: Array<{ route: string }> | string[]
  _status?: 'draft' | 'published'  // Default: 'published'
  type?: 'kb_article' | 'announcement' | 'playbook'
}
```

### JSON File Format

**Single Article:**
```json
{
  "title": "How to upload a resume",
  "summary": "Learn how to upload your resume",
  "routes": ["/upload", "/submit"],
  "_status": "published"
}
```

**Multiple Articles:**
```json
[
  {
    "title": "Article 1",
    "summary": "First article"
  },
  {
    "title": "Article 2",
    "summary": "Second article",
    "appSlug": "job-search"
  }
]
```

## How It Works

### 1. Normalization

Before processing, each article is normalized:

- **appSlug**: Defaults to `'resume-coach'` if not provided
- **_status**: Defaults to `'published'` if not provided
- **routes**: Converts string arrays to object arrays:
  - `["/path1", "/path2"]` → `[{route: "/path1"}, {route: "/path2"}]`

### 2. Duplicate Detection

Articles are identified by the combination of:
- `title` (exact match)
- `appSlug` (exact match)

### 3. Upsert Logic

For each article:

1. **Query** existing article by title + appSlug
2. **If found**: PATCH update with new fields
   - Updates: summary, bodyText, stepsText, triggersText, routes, _status, type
   - Does NOT update: title, appSlug (used for lookup)
3. **If not found**: POST create new article

### 4. Error Handling

- Individual article failures don't stop processing
- Failed articles are tracked and reported in summary
- Script exits with code 1 if any failures occurred

## Output

The script provides detailed output:

```
🚀 KB Article Importer (Idempotent Upsert Strategy)

📡 API Base URL: https://cms.resumecoach.me
👤 Admin Email: admin@example.com
📁 Files to process: 2

🔐 Logging in to Payload...
✅ Logged in successfully

📄 Processing file: data/pack1.json
  Found 5 article(s) in file
  Processing: Upload a resume
    App: resume-coach, Status: published
    ✓ Created (ID: 123)
  Processing: Reset password
    App: resume-coach, Status: published
    ✓ Updated (ID: 456)
  ...

============================================================
📊 IMPORT SUMMARY
============================================================
✅ Created:  3
🔄 Updated:  2
⏭️  Skipped:  0
❌ Failed:   0
📁 Total:    5

✨ Import complete!
```

## Best Practices

1. **Test First**: Run with a small sample file first
2. **Backup**: Backup your database before large imports
3. **Validate JSON**: Ensure JSON files are valid before importing
4. **Use Version Control**: Keep JSON files in git for audit trail
5. **Check Logs**: Review output for warnings and errors

## Troubleshooting

### Authentication Errors

```
❌ Login failed: 401
```

**Solution**: Check `PAYLOAD_ADMIN_EMAIL` and `PAYLOAD_ADMIN_PASSWORD` are correct.

### File Not Found

```
✗ File not found: data/missing.json
```

**Solution**: Verify file path is correct and file exists.

### JSON Parse Error

```
✗ JSON parse error: Unexpected token
```

**Solution**: Validate JSON syntax using `jq` or online validator.

### Network Errors

```
✗ Create failed: 500
```

**Solution**: Check `PAYLOAD_URL` is correct and server is accessible.

## Advanced Usage

### Dry Run (Planned Feature)

To preview changes without committing:

```bash
DRY_RUN=true npx tsx scripts/import-support-kb.ts data/*.json
```

### Import with Filtering

Use `jq` to filter articles before import:

```bash
# Only published articles
jq '[.[] | select(._status == "published")]' data/all.json > data/published.json
npx tsx scripts/import-support-kb.ts data/published.json

# Only specific app
jq '[.[] | select(.appSlug == "resume-coach")]' data/all.json > data/resume-coach.json
npx tsx scripts/import-support-kb.ts data/resume-coach.json
```

## Related Scripts

- `seed-kb-v1.ts` - Hardcoded seed data for initial setup
- `seed-job-search-kb.ts` - Job search specific KB seeding

## Support

For issues or questions:
1. Check the error output and summary
2. Verify environment variables are set correctly
3. Test with a single small file first
4. Contact support with full error output
