// Managed setup stages (0081, tutor_managed_setup.stage) in admin words.
// Shared by the list and the detail page.

export const STAGE_LABELS = {
  setup: "Setting up",
  sent: "Awaiting tutor",
  changes_requested: "Changes requested",
  approved: "Approved by tutor",
};

// Chip tone: warn = an admin's move, muted = the tutor's, good = ready to verify.
export const STAGE_TONES = {
  setup: "warn",
  sent: "muted",
  changes_requested: "warn",
  approved: "good",
};
