type VenueSettings = {
  address_street?: string;
  address_city?: string;
  phone?: string;
  email?: string;
};

export function getVenueDetails(settings: VenueSettings = {}) {
  const street = settings.address_street || "Lützelbucher Str. 7";
  const city = settings.address_city || "96237 Ebersdorf-Oberfüllbach";
  const phone = settings.phone || "09560 / 8609";
  const email = settings.email || "info@sc-oberfuellbach.de";
  return {
    street,
    city,
    phone,
    email,
    telUrl: `tel:${phone.replace(/[^0-9+]/g, "")}`,
    emailUrl: `mailto:${email}`,
    routeUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${street}, ${city}`)}`,
  };
}
