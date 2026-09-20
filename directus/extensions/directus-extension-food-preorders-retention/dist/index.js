const RETENTION_DAYS = 30;

function cutoffDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - RETENTION_DAYS);
  return date.toISOString();
}

export default ({ schedule }, { database, logger }) => {
  schedule("0 3 * * *", async () => {
    try {
      const reservations = await database("food_reservations as reservation")
        .join("food_orderings as ordering", "ordering.id", "reservation.ordering")
        .join("veranstaltungen as event", "event.id", "ordering.event")
        .whereNull("reservation.anonymized_at")
        .where("event.event_date", "<", cutoffDate())
        .select("reservation.id");

      const reservationIds = reservations.map((reservation) => reservation.id);
      if (reservationIds.length === 0) return;

      const anonymizedAt = new Date().toISOString();
      await database.transaction(async (transaction) => {
        await transaction("food_reservation_lines")
          .whereIn("reservation", reservationIds)
          .update({ customer_name: "", customer_email: "" });
        await transaction("food_reservations")
          .whereIn("id", reservationIds)
          .update({
            customer_name: "",
            customer_email: "",
            confirmation_token_hash: null,
            management_token_hash: null,
            anonymized_at: anonymizedAt,
            date_updated: anonymizedAt,
          });
      });
      logger.info({ reservations: reservationIds.length }, "Food preorder data anonymized");
    } catch (error) {
      logger.error({ err: error }, "Food preorder data retention failed");
    }
  });
};
