import type { CollectionConfig } from "payload"

export const Wines: CollectionConfig = {
  slug: "wines",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "winery", "varietal", "vintage"],
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
    {
      name: "winery",
      type: "relationship",
      relationTo: "wineries",
    },
    { name: "varietal", type: "text" },
    { name: "vintage", type: "number" },
    { name: "tastingNotes", type: "textarea", label: "Tasting Notes" },
    { name: "price", type: "number" },
    {
      name: "priceTier",
      type: "select",
      label: "Price Tier",
      options: [
        { label: "Under $50", value: "under-50" },
        { label: "$50–$100", value: "50-100" },
        { label: "$100–$200", value: "100-200" },
        { label: "Over $200", value: "over-200" },
      ],
    },
    { name: "rating", type: "number" },
    { name: "purchaseUrl", type: "text", label: "Purchase URL" },
    { name: "image", type: "upload", relationTo: "media" },
    { name: "featured", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
  ],
  timestamps: true,
}
