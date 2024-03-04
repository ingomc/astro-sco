import { defineCollection, z } from "astro:content";

// const blog = defineCollection({
//   // Type-check frontmatter using a schema
//   schema: z.object({
//     title: z.string(),
//     description: z.string(),
//     // Transform string to Date object
//     pubDate: z
//       .string()
//       .or(z.date())
//       .transform((val) => new Date(val)),
//     updatedDate: z
//       .string()
//       .optional()
//       .transform((str) => (str ? new Date(str) : undefined)),
//     heroImage: z.string().optional(),
//   }),
// });


const veranstaltungen = defineCollection({
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    pubDate: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
    eventDate: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
    location: z.string().optional(),
    heroImage: z.string().optional(),
    cta: z.string().optional(),
  }),
});

export const collections = { veranstaltungen };
