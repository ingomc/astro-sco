import rss from "@astrojs/rss";
import { getContentCollection } from "../lib/content-source";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

export async function get(context) {
  const events = await getContentCollection("veranstaltungen");
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: events.map((event) => ({
      ...event.data,
      link: `/veranstaltungen/${event.slug}/`,
    })),
  });
}
