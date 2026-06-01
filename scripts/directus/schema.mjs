function textField(name, required = false, width = "full", interfaceType = "input", options = {}) {
  const { note, hidden = false } = options;

  const meta = {
    interface: interfaceType,
    required,
    width,
  };

  if (note) {
    meta.note = note;
  }

  if (hidden) {
    meta.hidden = true;
  }

  return {
    name,
    type: "text",
    meta,
    schema: {
      is_nullable: !required,
    },
  };
}

function stringField(name, required = false, width = "half", maxLength = 255, options = {}) {
  const {
    note,
    hidden = false,
    defaultValue,
    interfaceType = "input",
  } = options;

  const meta = {
    interface: interfaceType,
    required,
    width,
  };

  if (note) {
    meta.note = note;
  }

  if (hidden) {
    meta.hidden = true;
  }

  const schema = {
    is_nullable: !required,
    max_length: maxLength,
  };

  if (defaultValue !== undefined) {
    schema.default_value = defaultValue;
  }

  return {
    name,
    type: "string",
    meta,
    schema,
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

function integerField(name, required = false, width = "half", options = {}) {
  const { note, hidden = false, defaultValue } = options;

  const meta = {
    interface: "input",
    required,
    width,
  };

  if (note) {
    meta.note = note;
  }

  if (hidden) {
    meta.hidden = true;
  }

  const schema = {
    is_nullable: !required,
  };

  if (defaultValue !== undefined) {
    schema.default_value = defaultValue;
  }

  return {
    name,
    type: "integer",
    meta,
    schema,
  };
}

function jsonField(name, required = false, width = "full", options = {}) {
  const { note, hidden = false } = options;

  const meta = {
    interface: "input-code",
    required,
    width,
    options: {
      language: "json",
    },
  };

  if (note) {
    meta.note = note;
  }

  if (hidden) {
    meta.hidden = true;
  }

  return {
    name,
    type: "json",
    meta,
    schema: {
      is_nullable: !required,
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

function fileImageField(name, required = false, width = "half", options = {}) {
  const { note, hidden = false } = options;

  const meta = {
    interface: "file-image",
    required,
    width,
  };

  if (note) {
    meta.note = note;
  }

  if (hidden) {
    meta.hidden = true;
  }

  return {
    name,
    type: "uuid",
    meta,
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
  textField("body", false, "full", "input-rich-text-html", {
    note: "Primary editor field for CMS content.",
  }),
  stringField("content_format", true, "half", 32, {
    defaultValue: "html",
    hidden: true,
    note: "Technical format marker (html, markdown, mdx).",
  }),
  stringField("source_path", false, "full", 500, {
    hidden: true,
    note: "Legacy migration metadata.",
  }),
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
      stringField("hero_image", false, "half", 500, {
        hidden: true,
        note: "Legacy hero image path. Prefer hero_image_file.",
      }),
      fileImageField("hero_image_file", false, "half", {
        note: "Upload/select hero image in Directus files.",
      }),
      stringField("hero_image_alt", false, "half", 255),
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
      jsonField("map_locations", false, "full", {
        note: "Optional map markers for this report.",
      }),
      integerField("map_zoom", false, "half", {
        note: "Map zoom level.",
        defaultValue: 15,
      }),
      stringField("map_height", false, "half", 32, {
        note: "Map container height (for example 450px).",
      }),
      jsonField("gallery_images", false, "full", {
        note: "Optional gallery images [{src, alt}] for this report.",
      }),
      integerField("gallery_columns", false, "half", {
        note: "Gallery columns (2, 3, or 4).",
        defaultValue: 3,
      }),
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
      stringField("hero_image", false, "half", 500, {
        hidden: true,
        note: "Legacy hero image path. Prefer hero_image_file.",
      }),
      fileImageField("hero_image_file", false, "half", {
        note: "Upload/select hero image in Directus files.",
      }),
      stringField("hero_image_alt", false, "half", 255),
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

function fileRelation(collection, field) {
  return {
    collection,
    field,
    related_collection: "directus_files",
    schema: {
      on_delete: "SET NULL",
      on_update: "NO ACTION",
    },
    meta: {
      many_collection: collection,
      many_field: field,
      one_collection: "directus_files",
      one_field: null,
      one_deselect_action: "nullify",
      junction_field: null,
      sort_field: null,
    },
  };
}

export const TARGET_RELATIONS = [
  fileRelation("veranstaltungen", "hero_image_file"),
  fileRelation("berichte", "hero_image_file"),
];
