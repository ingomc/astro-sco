export type VenueContact = {
  role: string;
  name: string;
  phone: string;
  whatsappUrl: string;
  smsUrl: string;
};

const inquiryText =
  "Hallo, ich möchte das Sportheim für eine private Feier anfragen. Anlass: … Wunschtermin: … Ungefähre Personenzahl: …";

const configuredContacts = [
  {
    role: "1. Vorstand",
    name:
      process.env.VENUE_CONTACT_1_NAME ?? import.meta.env.VENUE_CONTACT_1_NAME,
    phone:
      process.env.VENUE_CONTACT_1_PHONE ??
      import.meta.env.VENUE_CONTACT_1_PHONE,
  },
  {
    role: "2. Vorstand",
    name:
      process.env.VENUE_CONTACT_2_NAME ?? import.meta.env.VENUE_CONTACT_2_NAME,
    phone:
      process.env.VENUE_CONTACT_2_PHONE ??
      import.meta.env.VENUE_CONTACT_2_PHONE,
  },
];

export function getVenueContacts(): VenueContact[] {
  const contacts = configuredContacts.map(({ role, name, phone }) => {
    const displayName = typeof name === "string" ? name.trim() : "";
    const normalizedPhone =
      typeof phone === "string" ? phone.replace(/[\s()/.-]/g, "") : "";
    if (!displayName || !/^\+[1-9]\d{6,14}$/.test(normalizedPhone)) {
      return null;
    }

    return {
      role,
      name: displayName,
      phone: normalizedPhone,
      whatsappUrl: `https://wa.me/${normalizedPhone.slice(1)}?text=${encodeURIComponent(inquiryText)}`,
      smsUrl: `sms:${normalizedPhone}?body=${encodeURIComponent(inquiryText)}`,
    };
  });

  // Personal mobile links are published only when both approved contacts exist.
  return contacts.every((contact) => contact !== null)
    ? (contacts as VenueContact[])
    : [];
}
