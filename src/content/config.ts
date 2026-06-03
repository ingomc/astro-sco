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
    tags: z.array(z.string()).optional(),
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
  type: 'data',
  schema: z.object({
    site_title: z.string(),
    site_description: z.string().optional(),
    default_og_image: z.string().optional(),
    posts: z.object({
      front_limit: z.number(),
      author: z.string(),
      thumb: z.string(),
    }),
    phone: z.string().optional(),
    email: z.string().optional(),
    address_street: z.string().optional(),
    address_city: z.string().optional(),
    payment_methods: z.array(z.string()).or(z.array(z.object({ name: z.string() }))).optional(),
    opening_hours: z.array(z.string()).or(z.array(z.object({ hour: z.string() }))).optional(),
    regular_events: z.array(
      z.object({
        time: z.string(),
        label: z.string(),
      })
    ).optional(),
    use_winter_mode: z.boolean().optional(),
    use_winter_stage: z.boolean().optional(),
    logo_normal: z.string().optional(),
    logo_winter: z.string().optional(),
  }),
});

const getraenkekarte = defineCollection({
  type: 'data',
  schema: z.array(
    z.object({
      name: z.string(),
      icon: z.string().optional(),
      drinks: z.array(
        z.object({
          name: z.string(),
          prices: z.array(
            z.object({
              size: z.string(),
              unit: z.string(),
              price: z.string(),
            })
          ),
        })
      ),
    })
  ),
});

export const collections = {
  veranstaltungen,
  berichte,
  start,
  mitglieder,
  sportheim,
  settings,
  getraenkekarte
};
