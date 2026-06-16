import { buildInitialAvailability } from "./sections";

/**
 * Defaults used when the DB hasn't been populated yet (a brand-new tutor
 * signup). The handle_new_user() trigger creates an empty tutor_profiles
 * row, so these mostly cover null columns. Shared by the onboarding wizard
 * and the inline profile editor (OwnerProfile).
 */
export function defaultTutor(userId, userEmail, fullName) {
  return {
    id: userId,
    name: fullName || "",
    suburb: "",
    city: "",
    initial: (fullName || userEmail || "?").charAt(0).toUpperCase(),
    avatarBg: "oklch(0.9 0.05 220)",
    bannerBg: null,
    avatarImg: null,
    bannerImg: null,
    verified: false,
    verificationStatus: "none",
    deliversInPerson: true,
    deliversOnline: true,
    responsiveText: "Usually responds in <1 hr",
    languages: [],
    yearsTutoring: 0,
    credentials: [],
    bio: "",
    bioLong: "",
    atar: 0,
    rank: "",
    rankSubject: "",
    rating: null,
    reviews: 0,
    rate: 0,
    packages: [],
    experience: [],
    education: [],
    subjects: [],
    yearMin: 0,
    yearMax: 12,
    serviceArea: { suburb: "", radiusKm: 5 },
    availability: buildInitialAvailability(),
    verifications: [
      { label: "Email verified", done: false },
      { label: "Phone verified", done: false },
      { label: "Government ID", done: false },
      { label: "ATAR transcript", done: false },
      { label: "University enrolment", done: false },
    ],
    visibility: "public",
  };
}
