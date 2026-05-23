/**
 * WhatsApp message templates — edit these files directly.
 * Use {name} as a placeholder for the lead's name.
 *
 * To add a new template:
 *   1. Add an entry to the TEMPLATES array below.
 *   2. (Optional) drop a reference image into src/templates/images/ and
 *      reference it via the imported path.
 */

import bannerImg from "@/templates/images/banner.svg";
import admissionImg from "@/templates/images/admission.svg";

export interface WhatsAppTemplate {
  id: string;
  label: string;
  text: string;
  /** Local image URL — for reference only. WhatsApp doesn't auto-attach. */
  imageUrl?: string;
}

export const TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "welcome",
    label: "Welcome",
    imageUrl: bannerImg,
    text:
      "Hi {name}, this is from SAPE Education Fair. " +
      "We'd love to share our admission details with you. Reply to know more!",
  },
  {
    id: "admission",
    label: "Admission",
    imageUrl: admissionImg,
    text:
      "Hi {name}, admissions are open at SAPE Education Fair. " +
      "Limited seats — reply YES and our counsellor will guide you.",
  },
];

export const DEFAULT_TEMPLATE_ID = "welcome";

export function getTemplate(id: string): WhatsAppTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function renderTemplate(tpl: WhatsAppTemplate, leadName: string): string {
  return tpl.text.replace(/\{name\}/gi, leadName || "there");
}
