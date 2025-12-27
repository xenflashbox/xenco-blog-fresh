# KB Import Quick Start

## 1. Set Environment Variables

```bash
export PAYLOAD_ADMIN_EMAIL="your-admin@example.com"
export PAYLOAD_ADMIN_PASSWORD="your-password"
export PAYLOAD_URL="https://cms.resumecoach.me"  # Optional, has default
```

Or create a `.env` file (don't commit this!):

```bash
PAYLOAD_ADMIN_EMAIL=admin@example.com
PAYLOAD_ADMIN_PASSWORD=secret123
PAYLOAD_URL=https://cms.resumecoach.me
```

Then load it:

```bash
source .env  # or: export $(cat .env | xargs)
```

## 2. Prepare Your JSON Data

Create a file like `data/my-articles.json`:

```json
[
  {
    "title": "How to sign in",
    "summary": "Learn how to access your account",
    "bodyText": "Detailed instructions here...",
    "stepsText": "1. Go to login page\n2. Enter email\n3. Enter password",
    "triggersText": "login signin sign in access account password",
    "routes": ["/login", "/signin"],
    "_status": "published",
    "type": "kb_article"
  }
]
```

**Minimal example:**

```json
[
  {
    "title": "Quick article",
    "summary": "Just the basics"
  }
]
```

## 3. Run the Import

```bash
npx tsx scripts/import-support-kb.ts data/my-articles.json
```

## 4. Import Multiple Files

```bash
npx tsx scripts/import-support-kb.ts data/pack1.json data/pack2.json data/pack3.json
```

Or use wildcards:

```bash
npx tsx scripts/import-support-kb.ts data/*.json
```

## Field Defaults

If you don't specify these fields, the script will set:

- `appSlug`: `"resume-coach"`
- `_status`: `"published"`
- `routes`: `[]` (empty array)

## How Duplicates Are Handled

The script identifies duplicates by **title + appSlug**.

- **If found**: Updates existing article (PATCH)
- **If not found**: Creates new article (POST)

You can safely run the script multiple times!

## Example Output

```
✅ Created:  3
🔄 Updated:  2
⏭️  Skipped:  0
❌ Failed:   0
📁 Total:    5
```

## Common Issues

**Missing credentials:**
```
❌ Missing credentials
```
→ Set `PAYLOAD_ADMIN_EMAIL` and `PAYLOAD_ADMIN_PASSWORD`

**File not found:**
```
✗ File not found: data/missing.json
```
→ Check file path is correct

**Login failed:**
```
❌ Login failed: 401
```
→ Verify email and password are correct

## Test Run

Test with sample data:

```bash
# Use the provided sample
npx tsx scripts/import-support-kb.ts data/sample-kb.json
```

## Full Documentation

See `scripts/README-import-kb.md` for complete documentation.
