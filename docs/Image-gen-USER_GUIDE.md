# Xenco Labs Image Generation Service - Complete User Guide

**Version 2.0** | Last Updated: December 21, 2025

A production REST API service providing multi-provider AI image generation for all Xenco Labs infrastructure applications.

---

## Table of Contents

1. [Overview](#overview)
2. [Providers & Models](#providers--models)
3. [API Reference](#api-reference)
4. [Authentication](#authentication)
5. [Quick Start Examples](#quick-start-examples)
6. [Integration Guides](#integration-guides)
7. [Prompt Engineering](#prompt-engineering)
8. [Pricing & Cost Optimization](#pricing--cost-optimization)

---

## Overview

### What's Available

| Feature | Description |
|---------|-------------|
| **Multi-Provider Generation** | Generate images from Gemini (Google) or OpenAI models |
| **Dual Generation** | Compare results from both providers simultaneously |
| **Batch Processing** | Generate up to 10 images per request with per-item settings |
| **10 Aspect Ratios** | 1:1, 16:9, 9:16, 4:3, 3:4, 4:5, 5:4, 2:3, 3:2, 21:9 |
| **Transparent Backgrounds** | GPT-image models support transparent PNG output |
| **R2 CDN Storage** | Images served via Cloudflare CDN (90-day retention) |
| **Usage Tracking** | Full cost and usage analytics per API key |

### Base URL

```
https://image-gen.xencolabs.com
```

### Interactive Documentation

```
https://image-gen.xencolabs.com/docs
```

---

## Providers & Models

### Gemini (Google) Models

| Model | Use Case | Speed | Cost |
|-------|----------|-------|------|
| `gemini-2.5-flash-image` | Fast generation, everyday use (default) | ⚡ Fast | $ Low |
| `gemini-3-pro-image-preview` | High quality, up to 4K resolution | 🐢 Slower | $$ Medium |

### OpenAI Models

| Model | Use Case | Speed | Cost | Special Features |
|-------|----------|-------|------|------------------|
| `gpt-image-1.5` | Best quality, text rendering | 🐢 Slower | $$$ High | Transparent backgrounds |
| `gpt-image-1` | High quality | 🐢 Slower | $$ Medium | Transparent backgrounds |
| `gpt-image-1-mini` | Fast, cost-effective | ⚡ Fast | $ Cheapest | Transparent backgrounds |
| `dall-e-3` | Artistic, creative | Medium | $$ Medium | No verification needed |
| `dall-e-2` | Legacy, square only | ⚡ Fast | $ Low | Limited sizes |

### Quick Model Selection Guide

```
Need speed + low cost?      → gemini-2.5-flash-image or gpt-image-1-mini
Need quality?               → gemini-3-pro-image-preview or gpt-image-1.5
Need transparent PNG?       → gpt-image-1.5 (with background: "transparent")
Need text in image?         → gpt-image-1.5 (best text rendering)
Comparing providers?        → /api/v1/dual/generate endpoint
```

---

## API Reference

### Endpoints Overview

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `GET` | `/health` | Service health check | No |
| `GET` | `/docs` | Swagger documentation | No |
| `POST` | `/api/v1/generate` | Generate image (Gemini) | Yes |
| `POST` | `/api/v1/generate/batch` | Batch generation (Gemini) | Yes |
| `POST` | `/api/v1/openai/generate` | Generate image (OpenAI) | Yes |
| `POST` | `/api/v1/dual/generate` | Generate on both providers | Yes |
| `GET` | `/api/v1/images/{id}` | Get image metadata | Yes |
| `GET` | `/api/v1/images/{id}/download` | Download image file | Yes |
| `GET` | `/api/v1/jobs/{job_id}` | Get batch job status | Yes |
| `GET` | `/api/v1/stats` | Service statistics | Yes |
| `GET` | `/images/{path}` | Direct image access (public) | No |
| `GET` | `/images/download/{id}` | Redirect to image URL | No |

---

### 1. Gemini Single Generation

**Endpoint:** `POST /api/v1/generate`

Generate a single image using Google Gemini models.

#### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Image description (max 4000 chars) |
| `model` | string | No | `gemini-2.5-flash-image` | Model to use |
| `aspect_ratio` | string | No | `1:1` | Output aspect ratio |
| `resolution` | string | No | `1K` | `1K`, `2K`, `4K` (Pro only) |
| `use_pro` | boolean | No | `false` | Quick toggle for Pro model |
| `style_hints` | string | No | - | Additional style guidance |
| `source_app` | string | No | - | Your app identifier for tracking |

#### Example Request

```bash
curl -X POST https://image-gen.xencolabs.com/api/v1/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "A serene mountain landscape at golden hour, photorealistic",
    "aspect_ratio": "16:9",
    "source_app": "blogcraft"
  }'
```

#### Example Response

```json
{
  "success": true,
  "message": "Image generated successfully",
  "image": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "external_id": "8f0c61eba59",
    "prompt": "A serene mountain landscape at golden hour, photorealistic",
    "model": "gemini-2.5-flash-image",
    "status": "completed",
    "image_url": "https://image-storage.xencolabs.com/2025/12/21/8f0c61eba59.png",
    "download_url": "https://image-gen.xencolabs.com/images/download/8f0c61eba59",
    "aspect_ratio": "16:9",
    "resolution": "1K",
    "file_size_bytes": 847293,
    "created_at": "2025-12-21T05:30:00Z",
    "completed_at": "2025-12-21T05:30:05Z"
  }
}
```

---

### 2. Gemini Batch Generation

**Endpoint:** `POST /api/v1/generate/batch`

Generate multiple images in a single request (max 10). Supports two formats:

#### New Format (Recommended) - Per-Item Settings

```bash
curl -X POST https://image-gen.xencolabs.com/api/v1/generate/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "items": [
      {
        "ref": "hero-image",
        "prompt": "Professional hero image for tech blog",
        "aspect_ratio": "16:9",
        "meta": {"kind": "hero", "section_id": "intro"}
      },
      {
        "ref": "sidebar-thumb",
        "prompt": "Small icon representing cloud computing",
        "aspect_ratio": "1:1",
        "meta": {"kind": "thumbnail", "alt": "Cloud icon"}
      },
      {
        "ref": "section-2-image",
        "prompt": "Diagram showing API connections",
        "aspect_ratio": "4:3"
      }
    ],
    "default_aspect_ratio": "16:9",
    "source_app": "blogcraft"
  }'
```

#### Legacy Format - Global Settings

```bash
curl -X POST https://image-gen.xencolabs.com/api/v1/generate/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompts": [
      "Hero image for cloud computing article",
      "Diagram of microservices architecture",
      "Team collaboration in modern office"
    ],
    "aspect_ratio": "16:9"
  }'
```

#### Batch Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | array | Either items or prompts | - | Items with per-item settings |
| `prompts` | array | Either items or prompts | - | Legacy: simple prompt list |
| `default_aspect_ratio` | string | No | `1:1` | Default for items without aspect_ratio |
| `model` | string | No | `gemini-2.5-flash-image` | Model for all images |
| `resolution` | string | No | `1K` | Resolution for all images |
| `use_pro` | boolean | No | `false` | Use Pro model |

#### Batch Item Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ref` | string | Yes | Unique key for mapping responses |
| `prompt` | string | Yes | Image description |
| `aspect_ratio` | string | No | Override default aspect ratio |
| `meta` | object | No | Pass-through metadata (returned in response) |

#### Batch Response

```json
{
  "job_id": "abc123def456",
  "status": "completed",
  "total_images": 3,
  "completed_images": 3,
  "failed_images": 0,
  "images": [
    {
      "external_id": "img1abc",
      "prompt": "Professional hero image for tech blog",
      "status": "completed",
      "image_url": "https://image-storage.xencolabs.com/...",
      "aspect_ratio": "16:9",
      "input_index": 0,
      "ref": "hero-image",
      "meta": {"kind": "hero", "section_id": "intro"}
    },
    ...
  ],
  "created_at": "2025-12-21T05:30:00Z",
  "completed_at": "2025-12-21T05:30:15Z"
}
```

---

### 3. OpenAI Single Generation

**Endpoint:** `POST /api/v1/openai/generate`

Generate images using OpenAI's GPT-Image or DALL-E models.

#### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Image description (max 32000 chars) |
| `model` | string | No | `gpt-image-1.5` | OpenAI model to use |
| `aspect_ratio` | string | No | `1:1` | Output aspect ratio |
| `quality` | string | No | `auto` | `low`, `medium`, `high`, `auto` |
| `background` | string | No | `auto` | `transparent`, `opaque`, `auto` |
| `output_format` | string | No | `png` | `png`, `jpeg`, `webp` |
| `n` | integer | No | `1` | Number of images (1-10) |
| `source_app` | string | No | - | Your app identifier |

#### Example: High-Quality Generation

```bash
curl -X POST https://image-gen.xencolabs.com/api/v1/openai/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "A futuristic cityscape at night with neon lights and flying cars",
    "model": "gpt-image-1.5",
    "aspect_ratio": "16:9",
    "quality": "high"
  }'
```

#### Example: Transparent Background (Logo/Icon)

```bash
curl -X POST https://image-gen.xencolabs.com/api/v1/openai/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "A minimalist cloud icon in blue gradient",
    "model": "gpt-image-1.5",
    "aspect_ratio": "1:1",
    "background": "transparent",
    "quality": "medium"
  }'
```

#### Example: Fast & Cheap (gpt-image-1-mini)

```bash
curl -X POST https://image-gen.xencolabs.com/api/v1/openai/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "Simple illustration of a coffee cup",
    "model": "gpt-image-1-mini",
    "quality": "low"
  }'
```

---

### 4. Dual Generation (Compare Providers)

**Endpoint:** `POST /api/v1/dual/generate`

Generate the same prompt on both Gemini and OpenAI simultaneously. Perfect for comparing output styles or letting users choose their preferred result.

#### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Image description |
| `aspect_ratio` | string | No | `1:1` | Shared aspect ratio |
| `gemini_model` | string | No | `gemini-2.5-flash-image` | Gemini model |
| `gemini_use_pro` | boolean | No | `false` | Use Gemini Pro |
| `openai_model` | string | No | `gpt-image-1.5` | OpenAI model |
| `openai_quality` | string | No | `auto` | OpenAI quality level |

#### Example Request

```bash
curl -X POST https://image-gen.xencolabs.com/api/v1/dual/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "A majestic mountain landscape at sunset with a crystal clear lake",
    "aspect_ratio": "16:9",
    "openai_model": "gpt-image-1.5",
    "openai_quality": "high"
  }'
```

#### Example Response

```json
{
  "success": true,
  "message": "Both Gemini and OpenAI images generated successfully",
  "prompt": "A majestic mountain landscape at sunset with a crystal clear lake",
  "aspect_ratio": "16:9",
  "gemini": {
    "provider": "gemini",
    "success": true,
    "external_id": "4a244a76e4f",
    "image_url": "https://image-storage.xencolabs.com/2025/12/21/4a244a76e4f.png",
    "download_url": "https://image-gen.xencolabs.com/images/download/4a244a76e4f",
    "model": "gemini-2.5-flash-image",
    "latency_ms": 6705,
    "estimated_cost_usd": 0.0204
  },
  "openai": {
    "provider": "openai",
    "success": true,
    "external_id": "0152ec20a41",
    "image_url": "https://image-storage.xencolabs.com/openai/2025/12/21/oai-0152ec20a41.png",
    "download_url": "https://image-gen.xencolabs.com/images/download/0152ec20a41",
    "model": "gpt-image-1.5",
    "latency_ms": 50766,
    "estimated_cost_usd": 0.167
  },
  "total_latency_ms": 57471,
  "total_cost_usd": 0.1874,
  "created_at": "2025-12-21T05:46:36Z"
}
```

---

### 5. Retrieve Image Metadata

**Endpoint:** `GET /api/v1/images/{external_id}`

```bash
curl https://image-gen.xencolabs.com/api/v1/images/8f0c61eba59 \
  -H "X-API-Key: your-api-key"
```

---

### 6. Health Check

**Endpoint:** `GET /health`

```bash
curl https://image-gen.xencolabs.com/health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": true,
  "storage": true,
  "gemini_api": true,
  "openai_api": true,
  "openai_enabled": true,
  "r2_storage": true,
  "r2_enabled": true
}
```

---

## Authentication

### API Key Header

Include your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" ...
```

Or use Bearer token format:

```bash
curl -H "Authorization: Bearer your-api-key" ...
```

### Available API Keys

| Key | Purpose |
|-----|---------|
| `xgen-img-7f3k9m2p4q8r5t1v6w0y` | Primary/general use |
| `xgen-blogcraft-8h4l0n3p5q9s6u2w7x1z` | BlogCraft integration |

Use different keys per application to track usage separately.

---

## Quick Start Examples

### Python

```python
import httpx

response = httpx.post(
    "https://image-gen.xencolabs.com/api/v1/generate",
    headers={"X-API-Key": "your-api-key"},
    json={
        "prompt": "A modern blog header image about AI",
        "aspect_ratio": "16:9"
    }
)
data = response.json()
image_url = data["image"]["image_url"]
print(f"Generated: {image_url}")
```

### JavaScript/TypeScript

```typescript
const response = await fetch('https://image-gen.xencolabs.com/api/v1/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    prompt: 'A modern blog header image about AI',
    aspect_ratio: '16:9'
  })
});

const data = await response.json();
console.log('Image URL:', data.image.image_url);
```

### Make.com / Zapier

1. **HTTP Module Settings:**
   - URL: `https://image-gen.xencolabs.com/api/v1/generate`
   - Method: `POST`
   - Headers:
     - `X-API-Key: your-api-key`
     - `Content-Type: application/json`
   - Body: `{"prompt": "{{your_prompt}}", "aspect_ratio": "16:9"}`

2. **Parse Response:**
   - `{{result.image.image_url}}` - Direct URL to image
   - `{{result.image.external_id}}` - Image ID for reference
   - `{{result.success}}` - Boolean for error handling

---

## Aspect Ratios

| Aspect Ratio | Use Case | Gemini | OpenAI GPT-image | DALL-E 3 |
|--------------|----------|--------|------------------|----------|
| `1:1` | Thumbnails, social | 1024×1024 | 1024×1024 | 1024×1024 |
| `16:9` | Blog headers, video | 1024px wide | 1536×1024 | 1792×1024 |
| `9:16` | Stories, mobile | 1024px tall | 1024×1536 | 1024×1792 |
| `4:3` | Standard photos | 1024px wide | 1536×1024 | 1792×1024 |
| `3:4` | Portrait photos | 1024px tall | 1024×1536 | 1024×1792 |
| `4:5` | Instagram portrait | 1024px tall | 1024×1536 | 1024×1792 |
| `5:4` | Landscape | 1024px wide | 1536×1024 | 1792×1024 |
| `2:3` | Portrait | 1024px tall | 1024×1536 | 1024×1792 |
| `3:2` | Landscape | 1024px wide | 1536×1024 | 1792×1024 |
| `21:9` | Ultra-wide | 1024px wide | 1536×1024 | 1792×1024 |

---

## Pricing & Cost Optimization

### Estimated Costs Per Image

| Model | Quality | Approx. Cost |
|-------|---------|--------------|
| `gemini-2.5-flash-image` | Standard | ~$0.02 |
| `gemini-3-pro-image-preview` | High | ~$0.04 |
| `gpt-image-1-mini` | Low | ~$0.004 |
| `gpt-image-1-mini` | Medium | ~$0.011 |
| `gpt-image-1-mini` | High | ~$0.032 |
| `gpt-image-1.5` | Low | ~$0.011 |
| `gpt-image-1.5` | Medium | ~$0.042 |
| `gpt-image-1.5` | High | ~$0.167 |
| `dall-e-3` | Standard | ~$0.04 |
| `dall-e-3` | HD | ~$0.08-$0.12 |

### Cost Optimization Tips

1. **Use `gpt-image-1-mini` for bulk generation** - 4x cheaper than other GPT-image models
2. **Use `gemini-2.5-flash-image` as default** - Best balance of speed and cost
3. **Reserve `gpt-image-1.5 high` for hero images** - Quality matters for primary visuals
4. **Use batch generation** - Same cost, better organization
5. **Track via `source_app`** - Monitor costs per application

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "image": null
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid/missing API key | Check `X-API-Key` header |
| 403 Forbidden | OpenAI org not verified | Verify at platform.openai.com |
| 422 Validation Error | Invalid parameters | Check request body format |
| 500 Internal Error | Generation failed | Retry or check prompt |
| 503 Service Unavailable | Provider not configured | OpenAI env vars missing |

### Recommended Error Handling

```python
response = httpx.post(url, headers=headers, json=payload)
data = response.json()

if not data.get("success"):
    error_msg = data.get("message", "Unknown error")
    # Log error, notify, or retry
    print(f"Generation failed: {error_msg}")
else:
    image_url = data["image"]["image_url"]
    # Use the image
```

---

## Best Practices

### Prompts

1. **Be specific** - Include style, colors, mood, composition
2. **Keep it concise** - 15-40 words is optimal for Gemini
3. **Use style hints** - "photorealistic", "illustration", "minimalist"
4. **Avoid negative prompts** - Describe what you want, not what you don't

### Integration

1. **Store the `image_url`** - It's permanent (90-day retention)
2. **Use `source_app`** - Track usage by application
3. **Handle errors gracefully** - Check `success` field
4. **Use batch for multiple images** - Better organization and efficiency

### Performance

1. **Gemini is faster** - Use for time-sensitive generations
2. **OpenAI has better text** - Use for images with text content
3. **Dual generation for comparison** - Let users choose preferred style
4. **`gpt-image-1-mini` for previews** - Fast and cheap for drafts

---

## Storage & Retention

- **Primary Storage:** Cloudflare R2 CDN (`https://image-storage.xencolabs.com`)
- **Backup Storage:** NFS server (10.8.8.108)
- **Retention Period:** 90 days from creation
- **Auto-Cleanup:** Runs daily, removes expired images

Image URLs are permanent for the retention period and can be used directly in websites, CMS, or applications.

---

## Support

- **Swagger Docs:** https://image-gen.xencolabs.com/docs
- **Health Check:** https://image-gen.xencolabs.com/health
- **Repository:** https://github.com/xenflashbox/gemini-image-gen
