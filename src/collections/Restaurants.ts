import type { CollectionConfig } from "payload"

export const Restaurants: CollectionConfig = {
  slug: "restaurants",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "city", "priceRange", "featuredTier"],
    group: "Wine Country Corner",
  },
  access: { read: () => true },
  fields: [
    {
      name: "site",
      type: "relationship",
      relationTo: "sites",
      required: true,
      admin: { position: "sidebar" },
    },
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, admin: { position: "sidebar" } },
    { name: "website", type: "text" },
    {
      name: "region",
      type: "select",
      options: [
        { label: "Napa Valley", value: "Napa Valley" },
        { label: "Sonoma County", value: "Sonoma County" },
        { label: "Other", value: "Other" },
      ],
    },
    { name: "city", type: "text" },
    {
      name: "cuisineType",
      type: "array",
      label: "Cuisine Type",
      fields: [{ name: "cuisine", type: "text" }],
    },
    {
      name: "priceRange",
      type: "select",
      label: "Price Range",
      options: [
        { label: "$", value: "$" },
        { label: "$$", value: "$$" },
        { label: "$$$", value: "$$$" },
        { label: "$$$$", value: "$$$$" },
      ],
    },
    { name: "wineFocused", type: "checkbox", label: "Wine Focused", defaultValue: false },
    { name: "reservationsUrl", type: "text", label: "Reservations URL" },
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
    { name: "phone", type: "text" },
    { name: "hours", type: "text" },
    { name: "featuredImage", type: "upload", relationTo: "media", label: "Featured Image" },
    { name: "featured", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
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
    { name: "description", type: "textarea" },
  ],
  timestamps: true,
}
