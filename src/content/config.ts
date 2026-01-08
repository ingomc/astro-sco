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
    description: z.string(),
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
    featured: z.boolean().optional(),
    hidden: z.boolean().optional(),
  }),
});

const berichte = defineCollection({
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
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
  }),
});

const start = defineCollection({
  schema: z.object({
    title: z.string(),
    order: z.number(),
  }),
});

const mitglieder = defineCollection({
  schema: z.object({
    name: z.string(),
    position: z.string().optional(),
    stammtisch: z.boolean().optional(),
    dart: z.boolean().optional(),
    email: z.string().optional(),
    authorimage: z.string().optional(),
  }),
});

const sportheim = defineCollection({
  schema: z.object({
    title: z.string(),
    order: z.number().optional(),
  }),
});

const settings = defineCollection({
  type: 'data',
  schema: z.object({
    site_title: z.string(),
    posts: z.object({
      front_limit: z.number(),
      author: z.string(),
      thumb: z.string(),
    }),
  }),
});

export const collections = { 
  veranstaltungen, 
  berichte, 
  start, 
  mitglieder, 
  sportheim, 
  settings 
};
