import type { CollectionConfig } from "payload"

export const Accommodations: CollectionConfig = {
  slug: "accommodations",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "city", "type", "isOwned", "featuredTier"],
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
      name: "type",
      type: "select",
      options: [
        { label: "Hotel", value: "hotel" },
        { label: "Bed & Breakfast", value: "bb" },
        { label: "Vacation Rental", value: "vacation-rental" },
        { label: "Resort", value: "resort" },
        { label: "Inn", value: "inn" },
      ],
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
    { name: "bookingUrl", type: "text", label: "Booking URL" },
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
    {
      name: "amenities",
      type: "array",
      fields: [{ name: "amenity", type: "text" }],
    },
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
    {
      name: "isOwned",
      type: "checkbox",
      label: "WCC Owned/Partner Property",
      defaultValue: false,
      admin: { position: "sidebar", description: "Check for Sonoma Grove Suites — appears first in listings." },
    },
  ],
  timestamps: true,
}
