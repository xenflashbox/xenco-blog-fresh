import type { CollectionConfig } from "payload"

export const Wineries: CollectionConfig = {
  slug: "wineries",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "region", "featuredTier", "site"],
    group: "Wine Country Corner",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "site",
      type: "relationship",
      relationTo: "sites",
      required: true,
      admin: { position: "sidebar" },
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { position: "sidebar" },
    },
    {
      name: "website",
      type: "text",
    },
    {
      name: "region",
      type: "select",
      options: [
        { label: "Napa Valley", value: "Napa Valley" },
        { label: "Sonoma County", value: "Sonoma County" },
        { label: "Coombsville AVA", value: "Coombsville AVA" },
        { label: "Stags Leap District", value: "Stags Leap District" },
        { label: "Other", value: "Other" },
      ],
    },
    {
      name: "subAppellation",
      type: "text",
      label: "Sub-Appellation",
    },
    {
      name: "varietalFocus",
      type: "array",
      label: "Varietal Focus",
      fields: [{ name: "varietal", type: "text" }],
    },
    {
      name: "tastingAvailable",
      type: "checkbox",
      label: "Tastings Available",
      defaultValue: false,
    },
    {
      name: "tastingBookingUrl",
      type: "text",
      label: "Tasting Booking URL",
    },
    {
      name: "wineClubEnabled",
      type: "checkbox",
      label: "Wine Club",
      defaultValue: false,
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar" },
    },
    {
      name: "featuredTier",
      type: "select",
      label: "Featured Tier",
      admin: { position: "sidebar" },
      options: [
        { label: "Flagship", value: "flagship" },
        { label: "Featured", value: "featured" },
        { label: "Listed", value: "listed" },
      ],
    },
    {
      name: "featuredOrder",
      type: "number",
      label: "Featured Order",
      admin: { position: "sidebar" },
    },
    {
      name: "featuredHero",
      type: "upload",
      relationTo: "media",
      label: "Hero Image",
    },
    {
      name: "featuredStory",
      type: "richText",
      label: "Editorial Story",
    },
    {
      name: "featuredQuote",
      type: "text",
      label: "Pull Quote",
    },
    {
      name: "featuredQuoteAttribution",
      type: "text",
      label: "Quote Attribution",
    },
    {
      name: "phone",
      type: "text",
    },
    {
      name: "email",
      type: "email",
    },
    {
      name: "instagramHandle",
      type: "text",
      label: "Instagram Handle",
    },
    {
      name: "address",
      type: "group",
      fields: [
        { name: "street", type: "text" },
        { name: "city", type: "text" },
        { name: "state", type: "text" },
        { name: "zip", type: "text" },
      ],
    },
    {
      name: "coordinates",
      type: "group",
      fields: [
        { name: "lat", type: "number" },
        { name: "lng", type: "number" },
      ],
    },
    {
      name: "partnerSince",
      type: "date",
      label: "Partner Since",
    },
  ],
  timestamps: true,
}
