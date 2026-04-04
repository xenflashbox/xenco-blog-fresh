#!/usr/bin/env python3
"""
Import AER Worldwide articles into Payload CMS site 47.
Converts markdown content to Payload Lexical JSON format.
"""
import json
import re
import requests

PAYLOAD_URL = "https://publish.xencolabs.com"
API_KEY = "d91793cd-9535-480e-b2fa-4f0b4c2cc8ec"
SITE_ID = 47
DEFAULT_AUTHOR_ID = 11  # Rik Krumins (isDefault: true for site 47)

# Category IDs created for site 47
CATEGORY_MAP = {
    "ITAD Compliance": 344,
    "Data Destruction": 345,
    "Data Center": 346,
    "Healthcare ITAD": 347,
    "Financial Services": 348,
    "Government & Defense": 349,
    "Value Recovery": 350,
    "Sustainability & ESG": 351,
    "Reverse Logistics": 352,
    "Industry News": 353,
}

# Image IDs uploaded for each article
ARTICLE_IMAGES = {
    "itad-compliance-checklist-2026": {"hero": 2197, "body": 2198},
    "how-to-choose-itad-provider": {"hero": 2199, "body": 2200},
    "data-center-decommissioning-guide": {"hero": 2201, "body": 2202},
    "healthcare-itad-hipaa-ephi-guide": {"hero": 2203, "body": 2204},
}


def make_paragraph_node(children):
    return {
        "type": "paragraph",
        "version": 1,
        "format": "",
        "indent": 0,
        "direction": "ltr",
        "textFormat": 0,
        "textStyle": "",
        "children": children,
    }


def make_text_node(text, format_val=0):
    return {
        "type": "text",
        "version": 1,
        "format": format_val,
        "mode": "normal",
        "style": "",
        "detail": 0,
        "text": text,
    }


def make_heading_node(tag, children):
    return {
        "type": "heading",
        "version": 1,
        "tag": tag,
        "format": "",
        "indent": 0,
        "direction": "ltr",
        "children": children,
    }


def make_list_node(list_type, items):
    """Create a list node (ul or ol)"""
    list_items = []
    for i, item_text in enumerate(items):
        # Parse inline formatting in list items
        children = parse_inline(item_text)
        list_items.append({
            "type": "listitem",
            "version": 1,
            "format": "",
            "indent": 0,
            "direction": "ltr",
            "value": i + 1,
            "checked": None,
            "children": children,
        })
    return {
        "type": "list",
        "version": 1,
        "listType": list_type,
        "format": "",
        "indent": 0,
        "direction": "ltr",
        "start": 1,
        "tag": "ul" if list_type == "bullet" else "ol",
        "children": list_items,
    }


def parse_inline(text):
    """Parse inline markdown (bold, italic, links) into Lexical text nodes."""
    nodes = []
    # Pattern to match **bold**, *italic*, `code`
    pattern = r'(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)'
    last = 0
    for m in re.finditer(pattern, text):
        start, end = m.span()
        if start > last:
            nodes.append(make_text_node(text[last:start]))
        if m.group(1).startswith('**'):
            # Bold = format 1
            nodes.append(make_text_node(m.group(2), format_val=1))
        elif m.group(1).startswith('*'):
            # Italic = format 2
            nodes.append(make_text_node(m.group(3), format_val=2))
        elif m.group(1).startswith('`'):
            # Code = format 16
            nodes.append(make_text_node(m.group(4), format_val=16))
        last = end
    if last < len(text):
        remaining = text[last:]
        if remaining:
            nodes.append(make_text_node(remaining))
    if not nodes:
        nodes.append(make_text_node(text))
    return nodes


def markdown_to_lexical(md_text, body_image_id=None):
    """Convert markdown text to Payload Lexical JSON."""
    lines = md_text.split('\n')
    nodes = []
    i = 0
    body_image_inserted = False

    while i < len(lines):
        line = lines[i]

        # H2 heading
        if line.startswith('## '):
            heading_text = line[3:].strip()
            nodes.append(make_heading_node("h2", [make_text_node(heading_text)]))
            i += 1
            continue

        # H3 heading
        if line.startswith('### '):
            heading_text = line[4:].strip()
            nodes.append(make_heading_node("h3", [make_text_node(heading_text)]))
            i += 1
            # Insert body image after the first H3 heading if not yet inserted
            if not body_image_inserted and body_image_id:
                nodes.append({
                    "type": "upload",
                    "version": 1,
                    "format": "",
                    "indent": 0,
                    "value": body_image_id,
                    "relationTo": "media",
                    "fields": {},
                })
                body_image_inserted = True
            continue

        # H4 heading
        if line.startswith('#### '):
            heading_text = line[5:].strip()
            nodes.append(make_heading_node("h4", [make_text_node(heading_text)]))
            i += 1
            continue

        # Horizontal rule (---)
        if line.strip() in ('---', '***', '___'):
            nodes.append({
                "type": "horizontalrule",
                "version": 1,
            })
            i += 1
            continue

        # Unordered list block
        if line.startswith('- ') or line.startswith('* '):
            items = []
            while i < len(lines) and (lines[i].startswith('- ') or lines[i].startswith('* ')):
                items.append(lines[i][2:].strip())
                i += 1
            nodes.append(make_list_node("bullet", items))
            continue

        # Ordered list (numbered)
        if re.match(r'^\d+\.\s', line):
            items = []
            while i < len(lines) and re.match(r'^\d+\.\s', lines[i]):
                items.append(re.sub(r'^\d+\.\s', '', lines[i]).strip())
                i += 1
            nodes.append(make_list_node("number", items))
            continue

        # Empty line - skip
        if not line.strip():
            i += 1
            continue

        # Regular paragraph
        inline_nodes = parse_inline(line.strip())
        if inline_nodes:
            nodes.append(make_paragraph_node(inline_nodes))
        i += 1

    return {
        "root": {
            "type": "root",
            "version": 1,
            "format": "",
            "indent": 0,
            "direction": "ltr",
            "children": nodes,
        }
    }


def import_article(article_file):
    with open(article_file) as f:
        article = json.load(f)

    slug = article["slug"]
    images = ARTICLE_IMAGES.get(slug, {})
    hero_id = images.get("hero")
    body_id = images.get("body")
    category_name = article["category"]
    category_id = CATEGORY_MAP.get(category_name)

    print(f"\nImporting: {article['title']}")
    print(f"  Slug: {slug}")
    print(f"  Category: {category_name} (ID: {category_id})")
    print(f"  Hero image ID: {hero_id}, Body image ID: {body_id}")

    # Convert markdown content to Lexical JSON
    lexical_content = markdown_to_lexical(article["content"], body_image_id=body_id)

    payload = {
        "title": article["title"],
        "slug": slug,
        "excerpt": article["excerpt"],
        "site": SITE_ID,
        "author": DEFAULT_AUTHOR_ID,
        "status": "published",
        "publishedAt": "2026-04-01T00:00:00.000Z",
        "metaTitle": article["seo"]["title"],
        "metaDescription": article["seo"]["description"][:160],
        "content": lexical_content,
    }

    if category_id:
        payload["categories"] = [category_id]
    if hero_id:
        payload["heroImage"] = hero_id
        payload["featuredImage"] = hero_id

    resp = requests.post(
        f"{PAYLOAD_URL}/api/articles",
        headers={"Authorization": f"API-Key {API_KEY}", "Content-Type": "application/json"},
        json=payload,
    )

    result = resp.json()
    if "doc" in result:
        doc_id = result["doc"]["id"]
        print(f"  SUCCESS: Article created with ID: {doc_id}")
        return doc_id
    else:
        print(f"  ERROR: {json.dumps(result, indent=2)[:500]}")
        return None


if __name__ == "__main__":
    import os
    articles = [
        "aer-article-01-itad-compliance.json",
        "aer-article-02-choose-itad-provider.json",
        "aer-article-03-data-center-decommissioning.json",
        "aer-article-04-healthcare-itad.json",
    ]

    results = {}
    for article_file in articles:
        path = os.path.join(os.path.dirname(__file__), article_file)
        article_id = import_article(path)
        results[article_file] = article_id

    print("\n=== Import Summary ===")
    for file, aid in results.items():
        status = f"ID: {aid}" if aid else "FAILED"
        print(f"  {file}: {status}")
