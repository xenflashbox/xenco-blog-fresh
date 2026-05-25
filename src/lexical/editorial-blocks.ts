// src/lexical/editorial-blocks.ts
//
// Xenco Editorial Block System v2 — Lexical block registrations.
// Source of truth: docs/01-block-system-v2-spec.md §4 (block catalog) + §6.2.
//
// The spec names 22 conceptual block TYPES; this file registers 37 BLOCKS because
// the preset variants (tip-callout / warning-callout → callout; the badge variants)
// need distinct slash-menu entries for editor UX. On the front end those variants
// resolve to the same React component with a preset prop — see the divergence note
// in docs/03-sprint-b-divergences.md so Sprint A reconciles to 22 components.
//
// Block type import is from 'payload' (Payload 3.68.4 exports it there, NOT from
// the v2-era 'payload/types').
import type { Block } from 'payload'

// ── 4.1 Structural ──────────────────────────────────────────────────────────
export const TopTakeawaysBlock: Block = {
  slug: 'top-takeaways',
  labels: { singular: 'Top Takeaways', plural: 'Top Takeaways' },
  // Block description (not a Payload Block field): 'Article-level 3-5 bullet summary, surfaced at article top.'
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 3,
      maxRows: 5,
      fields: [{ name: 'text', type: 'text', required: true }],
    },
  ],
}

export const TocBlock: Block = {
  slug: 'toc',
  labels: { singular: 'Table of Contents', plural: 'Tables of Contents' },
  // Block description (not a Payload Block field): 'Auto-generated TOC. Inserts where you place it.'
  fields: [
    {
      name: 'auto_generate',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Build TOC from H2/H3 headings automatically.' },
    },
  ],
}

export const H2SectionBlock: Block = {
  slug: 'h2-section',
  labels: { singular: 'H2 Section', plural: 'H2 Sections' },
  // Block description (not a Payload Block field): 'Heading + body content under an H2.'
  fields: [
    { name: 'heading', type: 'text', required: true },
    {
      name: 'anchor_id',
      type: 'text',
      admin: { description: 'URL anchor (auto-generated from heading if blank).' },
    },
    // Nested richText: paragraphs and inline formatting only — no nested blocks
    // (per Sprint B "What NOT to do"). Uses the default lexical editor.
    { name: 'content', type: 'richText' },
  ],
}

// ── 4.2 Editorial-voice ─────────────────────────────────────────────────────
export const PullQuoteBlock: Block = {
  slug: 'pull-quote',
  labels: { singular: 'Pull Quote', plural: 'Pull Quotes' },
  // Block description (not a Payload Block field): 'Editorial centerpiece quote with attribution.'
  fields: [
    {
      name: 'quote',
      type: 'textarea',
      required: true,
      minLength: 15,
      maxLength: 280,
      admin: {
        description: 'The quote text (15-280 chars). Treat as the centerpiece of a section.',
      },
    },
    {
      name: 'attribution',
      type: 'text',
      required: true,
      admin: { description: 'Name of the person being quoted.' },
    },
    {
      name: 'title',
      type: 'text',
      admin: { description: 'Job title (optional). Example: "Director of ITAD Strategy".' },
    },
    {
      name: 'company',
      type: 'text',
      admin: { description: 'Company or affiliation (optional).' },
    },
    {
      name: 'style',
      type: 'select',
      defaultValue: 'editorial',
      options: [
        { label: 'Editorial (full-width, large)', value: 'editorial' },
        { label: 'Callout (right-aligned card)', value: 'callout' },
      ],
    },
  ],
}

export const CalloutBlock: Block = {
  slug: 'callout',
  labels: { singular: 'Callout', plural: 'Callouts' },
  // Block description (not a Payload Block field): 'Tinted info box. Three variants.'
  fields: [
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: [
        { label: 'Info (neutral, brand-primary tint)', value: 'info' },
        { label: 'Warning (amber tint)', value: 'warning' },
        { label: 'Note (subtle, grey tint)', value: 'note' },
      ],
    },
    { name: 'heading', type: 'text' },
    { name: 'body', type: 'richText' },
  ],
}

export const TipCalloutBlock: Block = {
  slug: 'tip-callout',
  labels: { singular: 'Tip Callout', plural: 'Tip Callouts' },
  // Block description (not a Payload Block field): 'Tip box (for how-to templates). Equivalent to a Callout with variant=info preset.'
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'body', type: 'richText' },
  ],
}

export const WarningCalloutBlock: Block = {
  slug: 'warning-callout',
  labels: { singular: 'Warning Callout', plural: 'Warning Callouts' },
  // Block description (not a Payload Block field): 'Warning box (for how-to templates). Equivalent to a Callout with variant=warning preset.'
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'body', type: 'richText' },
  ],
}

// ── 4.3 Data-density ────────────────────────────────────────────────────────
export const DataCardBlock: Block = {
  slug: 'data-card',
  labels: { singular: 'Data Card', plural: 'Data Cards' },
  // Block description (not a Payload Block field): 'Single statistic with label and optional source. Stacks horizontally when consecutive.'
  fields: [
    {
      name: 'value',
      type: 'text',
      required: true,
      admin: { description: 'Large display value (e.g. "$60M").' },
    },
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: { description: 'Small descriptor (e.g. "Morgan Stanley penalty").' },
    },
    { name: 'source', type: 'text' },
    { name: 'source_url', type: 'text' },
  ],
}

export const ComparisonTableBlock: Block = {
  slug: 'comparison-table',
  labels: { singular: 'Comparison Table', plural: 'Comparison Tables' },
  fields: [
    {
      name: 'headers',
      type: 'array',
      required: true,
      minRows: 2,
      fields: [{ name: 'label', type: 'text', required: true }],
    },
    {
      name: 'rows',
      type: 'array',
      required: true,
      fields: [
        { name: 'label', type: 'text', required: true },
        {
          name: 'values',
          type: 'array',
          required: true,
          fields: [{ name: 'value', type: 'text', required: true }],
        },
      ],
    },
    {
      name: 'highlight_column',
      type: 'number',
      admin: { description: 'Zero-indexed column to highlight (optional).' },
    },
  ],
}

export const ProsConsGridBlock: Block = {
  slug: 'pros-cons-grid',
  labels: { singular: 'Pros & Cons', plural: 'Pros & Cons' },
  fields: [
    {
      name: 'pros',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [{ name: 'text', type: 'text', required: true }],
    },
    {
      name: 'cons',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [{ name: 'text', type: 'text', required: true }],
    },
  ],
}

export const PricingTableBlock: Block = {
  slug: 'pricing-table',
  labels: { singular: 'Pricing Table', plural: 'Pricing Tables' },
  fields: [
    {
      name: 'tiers',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'price', type: 'text', required: true },
        { name: 'period', type: 'text' },
        {
          name: 'features',
          type: 'array',
          fields: [{ name: 'text', type: 'text', required: true }],
        },
        { name: 'highlighted', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
}

// ── 4.4 List-and-rank ───────────────────────────────────────────────────────
export const ListItemCardBlock: Block = {
  slug: 'list-item-card',
  labels: { singular: 'List Item Card', plural: 'List Item Cards' },
  fields: [
    { name: 'number', type: 'number', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'text', required: true },
    { name: 'body', type: 'richText' },
    { name: 'image_url', type: 'text' },
    { name: 'image_caption', type: 'text' },
  ],
}

export const RankedItemCardBlock: Block = {
  slug: 'ranked-item-card',
  labels: { singular: 'Ranked Item Card', plural: 'Ranked Item Cards' },
  fields: [
    { name: 'rank', type: 'number', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'verdict_summary', type: 'text', required: true },
    {
      name: 'rating',
      type: 'number',
      min: 0,
      max: 5,
      admin: { description: 'Optional rating 0-5.' },
    },
    { name: 'body', type: 'richText' },
    { name: 'image_url', type: 'text' },
  ],
}

export const RankingBadgeBlock: Block = {
  slug: 'ranking-badge',
  labels: { singular: 'Ranking Badge', plural: 'Ranking Badges' },
  fields: [
    { name: 'label', type: 'text', required: true },
    {
      name: 'variant',
      type: 'select',
      defaultValue: 'primary',
      options: [
        { label: 'Primary (brand color)', value: 'primary' },
        { label: 'Accent', value: 'accent' },
      ],
    },
  ],
}

export const RankingSummaryBlock: Block = {
  slug: 'ranking-summary',
  labels: { singular: 'Ranking Summary', plural: 'Ranking Summaries' },
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'rank', type: 'number', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'verdict_summary', type: 'text', required: true },
        { name: 'anchor_id', type: 'text', required: true },
      ],
    },
  ],
}

export const CategorySectionBlock: Block = {
  slug: 'category-section',
  labels: { singular: 'Category Section', plural: 'Category Sections' },
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'anchor_id', type: 'text', required: true },
  ],
}

// ── 4.5 How-to and explainer ────────────────────────────────────────────────
export const StepCardBlock: Block = {
  slug: 'step-card',
  labels: { singular: 'Step Card', plural: 'Step Cards' },
  fields: [
    { name: 'step_number', type: 'number', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'richText' },
    { name: 'time_estimate', type: 'text' },
    {
      name: 'tools_needed',
      type: 'array',
      fields: [{ name: 'text', type: 'text', required: true }],
    },
  ],
}

export const PrerequisiteListBlock: Block = {
  slug: 'prerequisite-list',
  labels: { singular: 'Prerequisite List', plural: 'Prerequisite Lists' },
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [{ name: 'text', type: 'text', required: true }],
    },
  ],
}

export const DefinitionCardBlock: Block = {
  slug: 'definition-card',
  labels: { singular: 'Definition Card', plural: 'Definition Cards' },
  fields: [
    { name: 'term', type: 'text', required: true },
    {
      name: 'definition',
      type: 'textarea',
      required: true,
      admin: { description: '1-3 sentences.' },
    },
    {
      name: 'alternative_terms',
      type: 'array',
      fields: [{ name: 'term', type: 'text', required: true }],
    },
  ],
}

// ── 4.6 Review-specific ─────────────────────────────────────────────────────
export const ReviewHeaderBlock: Block = {
  slug: 'review-header',
  labels: { singular: 'Review Header', plural: 'Review Headers' },
  fields: [
    { name: 'product_name', type: 'text', required: true },
    { name: 'vendor', type: 'text', required: true },
    { name: 'category', type: 'text', required: true },
    { name: 'rating', type: 'number', required: true, min: 0, max: 5 },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'review_date', type: 'date', required: true },
  ],
}

export const VerdictBoxBlock: Block = {
  slug: 'verdict-box',
  labels: { singular: 'Verdict Box', plural: 'Verdict Boxes' },
  fields: [
    { name: 'verdict', type: 'textarea', required: true },
    { name: 'best_for', type: 'text' },
    { name: 'avoid_if', type: 'text' },
    { name: 'rating', type: 'number', min: 0, max: 5 },
  ],
}

export const VsComparisonHeaderBlock: Block = {
  slug: 'vs-comparison-header',
  labels: { singular: 'Vs Comparison Header', plural: 'Vs Comparison Headers' },
  fields: [
    { name: 'left_product', type: 'text', required: true },
    { name: 'left_vendor', type: 'text', required: true },
    { name: 'right_product', type: 'text', required: true },
    { name: 'right_vendor', type: 'text', required: true },
    { name: 'summary', type: 'textarea', required: true },
  ],
}

export const VsComparisonTableBlock: Block = {
  slug: 'vs-comparison-table',
  labels: { singular: 'Vs Comparison Table', plural: 'Vs Comparison Tables' },
  fields: [
    { name: 'left_label', type: 'text', required: true },
    { name: 'right_label', type: 'text', required: true },
    {
      name: 'rows',
      type: 'array',
      required: true,
      fields: [
        { name: 'feature', type: 'text', required: true },
        { name: 'left_value', type: 'text', required: true },
        { name: 'right_value', type: 'text', required: true },
        {
          name: 'winner',
          type: 'select',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
            { label: 'Tie', value: 'tie' },
            { label: 'None', value: 'none' },
          ],
        },
      ],
    },
  ],
}

export const AlternativesTableBlock: Block = {
  slug: 'alternatives-table',
  labels: { singular: 'Alternatives Table', plural: 'Alternatives Tables' },
  fields: [
    { name: 'primary_product', type: 'text', required: true },
    {
      name: 'alternatives',
      type: 'array',
      required: true,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'vendor', type: 'text', required: true },
        { name: 'best_for', type: 'text', required: true },
        { name: 'anchor_id', type: 'text', required: true },
      ],
    },
  ],
}

// ── 4.7 Reference-and-trust ─────────────────────────────────────────────────
export const FaqBlock: Block = {
  slug: 'faq',
  labels: { singular: 'FAQ', plural: 'FAQs' },
  // Block description (not a Payload Block field): 'FAQ block. Emits FAQPage JSON-LD on the frontend.'
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'richText', required: true },
      ],
    },
  ],
}

export const SeoSnippetBlock: Block = {
  slug: 'seo-snippet',
  labels: { singular: 'SEO Snippet', plural: 'SEO Snippets' },
  // Block description (not a Payload Block field): '40-80 word self-contained answer targeting a featured snippet.'
  fields: [
    {
      name: 'question',
      type: 'text',
      required: true,
      admin: { description: 'The query this snippet targets. Rendered as H3 with id anchor.' },
    },
    {
      name: 'answer',
      type: 'textarea',
      required: true,
      admin: { description: '40-80 words. Self-contained answer.' },
    },
  ],
}

export const SourcesAccordionBlock: Block = {
  slug: 'sources-accordion',
  labels: { singular: 'Sources Accordion', plural: 'Sources Accordions' },
  // Block description (not a Payload Block field): 'NOTE: Most articles will put sources in the article-level footer_sources field, not as ' + 'a block. Use this only when you need an inline sources block mid-article (rare).'
  fields: [
    {
      name: 'sources',
      type: 'array',
      required: true,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'publisher', type: 'text' },
        { name: 'url', type: 'text', required: true },
        { name: 'date', type: 'date' },
        { name: 'quote_context', type: 'textarea' },
      ],
    },
  ],
}

export const MethodologyNoteBlock: Block = {
  slug: 'methodology-note',
  labels: { singular: 'Methodology Note', plural: 'Methodology Notes' },
  fields: [
    {
      name: 'body',
      type: 'textarea',
      required: true,
      admin: { description: '50-200 words on how the review/roundup was conducted.' },
    },
  ],
}

export const ImageWithCaptionBlock: Block = {
  slug: 'image-with-caption',
  labels: { singular: 'Image with Caption', plural: 'Images with Caption' },
  fields: [
    { name: 'src', type: 'text', required: true },
    { name: 'alt', type: 'text', required: true },
    { name: 'caption', type: 'text', required: true },
    { name: 'credit', type: 'text' },
    { name: 'width', type: 'number', required: true },
    { name: 'height', type: 'number', required: true },
  ],
}

export const TimelineBlock: Block = {
  slug: 'timeline',
  labels: { singular: 'Timeline', plural: 'Timelines' },
  fields: [
    {
      name: 'events',
      type: 'array',
      required: true,
      fields: [
        { name: 'date', type: 'date', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
      ],
    },
  ],
}

export const MechanismDiagramPlaceholderBlock: Block = {
  slug: 'mechanism-diagram-placeholder',
  labels: {
    singular: 'Mechanism Diagram Placeholder',
    plural: 'Mechanism Diagram Placeholders',
  },
  // Block description (not a Payload Block field): 'Reserves a slot for a mechanism diagram. BlogCraft inserts; an admin or image-gen pass fills it.'
  fields: [{ name: 'intended_subject', type: 'text', required: true }],
}

// ── 4.8 Optional-utility ────────────────────────────────────────────────────
export const CriteriaChecklistBlock: Block = {
  slug: 'criteria-checklist',
  labels: { singular: 'Criteria Checklist', plural: 'Criteria Checklists' },
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'criterion', type: 'text', required: true },
        { name: 'explanation', type: 'textarea', required: true },
      ],
    },
  ],
}

export const DecisionTreeBlock: Block = {
  slug: 'decision-tree',
  labels: { singular: 'Decision Tree', plural: 'Decision Trees' },
  fields: [
    { name: 'root_question', type: 'text', required: true },
    {
      name: 'branches',
      type: 'array',
      required: true,
      fields: [
        { name: 'answer', type: 'text', required: true },
        { name: 'recommendation', type: 'text', required: true },
        { name: 'next_question', type: 'text' },
      ],
    },
  ],
}

export const UseCaseCalloutBlock: Block = {
  slug: 'use-case-callout',
  labels: { singular: 'Use Case Callout', plural: 'Use Case Callouts' },
  fields: [
    { name: 'label', type: 'text', required: true },
    {
      name: 'criteria',
      type: 'array',
      required: true,
      fields: [{ name: 'text', type: 'text', required: true }],
    },
  ],
}

export const ItemComparisonRowBlock: Block = {
  slug: 'item-comparison-row',
  labels: { singular: 'Item Comparison Row', plural: 'Item Comparison Rows' },
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 2,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'value', type: 'text', required: true },
      ],
    },
  ],
}

export const PricingSummaryBlock: Block = {
  slug: 'pricing-summary',
  labels: { singular: 'Pricing Summary', plural: 'Pricing Summaries' },
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      fields: [
        { name: 'product', type: 'text', required: true },
        { name: 'price', type: 'text', required: true },
        { name: 'note', type: 'text' },
      ],
    },
  ],
}

export const CategoryBadgeBlock: Block = {
  slug: 'category-badge',
  labels: { singular: 'Category Badge', plural: 'Category Badges' },
  // Block description (not a Payload Block field): 'Property-configurable badge. Resolves category_key to an icon via the frontend categoryIcons map.'
  fields: [
    { name: 'category_key', type: 'text', required: true },
    { name: 'label', type: 'text', required: true },
  ],
}

// All 37 blocks, ordered by spec section (§4.1 → §4.8).
export const editorialBlocks: Block[] = [
  // 4.1 Structural
  TopTakeawaysBlock,
  TocBlock,
  H2SectionBlock,
  // 4.2 Editorial-voice
  PullQuoteBlock,
  CalloutBlock,
  TipCalloutBlock,
  WarningCalloutBlock,
  // 4.3 Data-density
  DataCardBlock,
  ComparisonTableBlock,
  ProsConsGridBlock,
  PricingTableBlock,
  // 4.4 List-and-rank
  ListItemCardBlock,
  RankedItemCardBlock,
  RankingBadgeBlock,
  RankingSummaryBlock,
  CategorySectionBlock,
  // 4.5 How-to and explainer
  StepCardBlock,
  PrerequisiteListBlock,
  DefinitionCardBlock,
  // 4.6 Review-specific
  ReviewHeaderBlock,
  VerdictBoxBlock,
  VsComparisonHeaderBlock,
  VsComparisonTableBlock,
  AlternativesTableBlock,
  // 4.7 Reference-and-trust
  FaqBlock,
  SeoSnippetBlock,
  SourcesAccordionBlock,
  MethodologyNoteBlock,
  ImageWithCaptionBlock,
  TimelineBlock,
  MechanismDiagramPlaceholderBlock,
  // 4.8 Optional-utility
  CriteriaChecklistBlock,
  DecisionTreeBlock,
  UseCaseCalloutBlock,
  ItemComparisonRowBlock,
  PricingSummaryBlock,
  CategoryBadgeBlock,
]
