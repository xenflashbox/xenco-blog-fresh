# Database Migrations Reference

This document contains SQL migrations for manual schema updates when needed.

## Featured Image and Hero Image Columns

If the `featured_image_id` and `hero_image_id` columns don't exist on the `articles` table, run:

```sql
-- Add featured_image_id column
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS featured_image_id INTEGER REFERENCES media(id) ON DELETE SET NULL;

-- Add hero_image_id column
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS hero_image_id INTEGER REFERENCES media(id) ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS articles_featured_image_idx ON articles(featured_image_id);
CREATE INDEX IF NOT EXISTS articles_hero_image_idx ON articles(hero_image_id);
```

## Authors Collection Setup

If the `authors` table doesn't exist:

```sql
-- Create authors table
CREATE TABLE IF NOT EXISTS authors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  website VARCHAR(255),
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create unique index for slug per site
CREATE UNIQUE INDEX IF NOT EXISTS authors_slug_site_unique ON authors(slug, site_id);

-- Create index on site_id
CREATE INDEX IF NOT EXISTS authors_site_idx ON authors(site_id);
```

If the `author_id` column doesn't exist on articles:

```sql
-- Add author_id to articles
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS articles_author_idx ON articles(author_id);
```

For the payload_locked_documents_rels table:

```sql
-- Add authors_id to payload_locked_documents_rels if needed
ALTER TABLE payload_locked_documents_rels
ADD COLUMN IF NOT EXISTS authors_id INTEGER REFERENCES authors(id) ON DELETE CASCADE;
```

## API Key Columns for Users

If the API key columns are missing or named incorrectly:

```sql
-- Rename column if it exists with wrong name
ALTER TABLE users RENAME COLUMN enable_api_key TO enable_a_p_i_key;

-- Or add the columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS enable_a_p_i_key BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_index VARCHAR(255);
```

## Site Relationship for Categories and Tags

If categories and tags don't have site relationships:

```sql
-- Add site_id to categories
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE;

UPDATE categories SET site_id = (SELECT id FROM sites WHERE is_default = true LIMIT 1) WHERE site_id IS NULL;

ALTER TABLE categories ALTER COLUMN site_id SET NOT NULL;

-- Drop old unique index on slug and create new one with site
DROP INDEX IF EXISTS categories_slug_unique;
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_site_unique ON categories(slug, site_id);

-- Add site_id to tags
ALTER TABLE tags
ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE;

UPDATE tags SET site_id = (SELECT id FROM sites WHERE is_default = true LIMIT 1) WHERE site_id IS NULL;

ALTER TABLE tags ALTER COLUMN site_id SET NOT NULL;

-- Drop old unique index on slug and create new one with site
DROP INDEX IF EXISTS tags_slug_unique;
CREATE UNIQUE INDEX IF NOT EXISTS tags_slug_site_unique ON tags(slug, site_id);
```

## Verify Schema

To check current column definitions:

```sql
-- Check articles columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'articles'
ORDER BY ordinal_position;

-- Check authors columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'authors'
ORDER BY ordinal_position;

-- Check users columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```
