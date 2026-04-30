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

const signupItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  max: z.number().int().positive().optional(),
});

const signupSchema = z
  .object({
    enabled: z.boolean(),
    eventId: z.string(),
    mode: z.enum(["registration", "order", "both"]),
    deadline: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
    capacity: z.number().int().positive().optional(),
    maxPartySize: z.number().int().min(1).max(99).optional(),
    notesLabel: z.string().max(120).optional(),
    notesPlaceholder: z.string().max(240).optional(),
    items: z.array(signupItemSchema).optional(),
  })
  .optional();

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
    tags: z.array(z.string()).optional(),
    signup: signupSchema,
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
    hidden: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
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
  type: "data",
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
  settings,
};
