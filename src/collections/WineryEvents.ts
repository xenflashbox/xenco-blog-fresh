import type { CollectionConfig } from "payload"

export const WineryEvents: CollectionConfig = {
  slug: "winery-events",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "winery", "eventType", "startDate"],
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
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, admin: { position: "sidebar" } },
    {
      name: "winery",
      type: "relationship",
      relationTo: "wineries",
    },
    {
      name: "eventType",
      type: "select",
      label: "Event Type",
      options: [
        { label: "Tasting", value: "tasting" },
        { label: "Winemaker Dinner", value: "dinner" },
        { label: "Harvest Event", value: "harvest" },
        { label: "New Release", value: "release" },
        { label: "Wine Club", value: "club" },
        { label: "Other", value: "other" },
      ],
    },
    { name: "startDate", type: "date", label: "Start Date", required: true },
    { name: "endDate", type: "date", label: "End Date" },
    { name: "price", type: "number" },
    { name: "priceFree", type: "checkbox", label: "Free Event", defaultValue: false },
    { name: "registrationUrl", type: "text", label: "Registration URL" },
    { name: "description", type: "textarea" },
    { name: "featuredImage", type: "upload", relationTo: "media", label: "Featured Image" },
  ],
  timestamps: true,
}
