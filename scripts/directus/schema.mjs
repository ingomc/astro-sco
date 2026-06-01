function textField(name, required = false, width = "full") {
  return {
    name,
    type: "text",
    meta: {
      interface: "input",
      required,
      width,
    },
    schema: {
      is_nullable: !required,
    },
  };
}

function stringField(name, required = false, width = "half", maxLength = 255) {
  return {
    name,
    type: "string",
    meta: {
      interface: "input",
      required,
      width,
    },
    schema: {
      is_nullable: !required,
      max_length: maxLength,
    },
  };
}

function boolField(name, required = false, defaultValue = false) {
  return {
    name,
    type: "boolean",
    meta: {
      interface: "boolean",
      required,
      width: "half",
    },
    schema: {
      is_nullable: !required,
      default_value: defaultValue,
    },
  };
}

function dateTimeField(name, required = false) {
  return {
    name,
    type: "timestamp",
    meta: {
      interface: "datetime",
      required,
      width: "half",
    },
    schema: {
      is_nullable: !required,
    },
  };
}

const commonContentFields = [
  {
    name: "slug",
    type: "string",
    meta: {
      interface: "input",
      required: true,
      width: "half",
      note: "Route slug from content path.",
    },
    schema: {
      is_nullable: false,
      is_unique: true,
      max_length: 255,
    },
  },
  textField("body", false, "full"),
  stringField("content_format", true, "half", 32),
  stringField("source_path", true, "full", 500),
];

export const TARGET_SCHEMA = [
  {
    name: "veranstaltungen",
    meta: {
      icon: "event",
      note: "Migrated from Astro content collection veranstaltungen.",
    },
    fields: [
      ...commonContentFields,
      stringField("title", true, "full"),
      textField("description", true, "full"),
      dateTimeField("pub_date", true),
      dateTimeField("event_date", true),
      stringField("location", false, "half"),
      stringField("hero_image", true, "half", 500),
      stringField("cta", false, "half"),
      boolField("featured", false, false),
      boolField("hidden", false, false),
      {
        name: "tags",
        type: "json",
        meta: {
          interface: "tags",
          required: false,
          width: "full",
        },
        schema: {
          is_nullable: true,
        },
      },
    ],
  },
  {
    name: "berichte",
    meta: {
      icon: "article",
      note: "Migrated from Astro content collection berichte.",
    },
    fields: [
      ...commonContentFields,
      stringField("title", true, "full"),
      textField("description", false, "full"),
      dateTimeField("pub_date", true),
      dateTimeField("event_date", true),
      stringField("location", false, "half"),
      stringField("hero_image", true, "half", 500),
      boolField("hidden", false, false),
      {
        name: "tags",
        type: "json",
        meta: {
          interface: "tags",
          required: false,
          width: "full",
        },
        schema: {
          is_nullable: true,
        },
      },
    ],
  },
  {
    name: "mitglieder",
    meta: {
      icon: "groups",
      note: "Migrated from Astro content collection mitglieder.",
    },
    fields: [
      ...commonContentFields,
      stringField("name", true, "full"),
      stringField("position", false, "half"),
      boolField("stammtisch", false, false),
      boolField("dart", false, false),
      stringField("email", false, "half"),
      stringField("authorimage", false, "half", 500),
    ],
  },
  {
    name: "start",
    meta: {
      icon: "home",
      note: "Migrated from Astro content collection start.",
    },
    fields: [
      ...commonContentFields,
      stringField("title", true, "full"),
      {
        name: "order",
        type: "integer",
        meta: {
          interface: "input",
          required: true,
          width: "half",
        },
        schema: {
          is_nullable: false,
        },
      },
    ],
  },
  {
    name: "sportheim",
    meta: {
      icon: "restaurant",
      note: "Migrated from Astro content collection sportheim.",
    },
    fields: [
      ...commonContentFields,
      stringField("title", true, "full"),
      {
        name: "order",
        type: "integer",
        meta: {
          interface: "input",
          required: false,
          width: "half",
        },
        schema: {
          is_nullable: true,
        },
      },
      stringField("legacy_id", false, "half", 255),
    ],
  },
  {
    name: "settings",
    meta: {
      icon: "settings",
      note: "Migrated from Astro data collection settings.",
      singleton: true,
    },
    fields: [
      stringField("site_title", true, "full"),
      {
        name: "posts_front_limit",
        type: "integer",
        meta: {
          interface: "input",
          required: true,
          width: "half",
        },
        schema: {
          is_nullable: false,
        },
      },
      stringField("posts_author", true, "half"),
      stringField("posts_thumb", true, "half", 500),
    ],
  },
];
