/**
 * lib/demo/generateDemo.ts
 *
 * Generates a SINGLE, self-contained HTML demo website for a business that has
 * no website. Output is one complete HTML document (inline CSS + minimal JS, no
 * external image hosts) so it renders deterministically and can be screenshotted
 * via Puppeteer's page.setContent() WITHOUT serving it on localhost.
 *
 * INTEGRATION: You already have an AI layer at lib/ai/client.ts (Claude Haiku +
 * Pollinations fallback + circuit breaker). Prefer reusing it: import your
 * completion helper and pass it as the `complete` arg to generateDemoHtml().
 * The bundled callModel() below exists only so this file runs standalone.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface DemoBusiness {
  name: string;
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  rating?: number | null;
  description?: string | null;
  socials?: Record<string, string> | null;
}

type CompleteFn = (system: string, user: string) => Promise<string>;

export function buildDemoPrompt(business: DemoBusiness, proposalMarkdown?: string) {
  const socials = business.socials
    ? Object.entries(business.socials)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "none";

  const year = new Date().getFullYear();

  const system = `You are a senior web designer and front-end engineer who builds stunning, conversion-optimised one-page websites for local businesses.
You use Tailwind CSS (CDN), Alpine.js for interactivity, Swiper.js for carousels, AOS for scroll animations, and Google Fonts.

ABSOLUTE RULES:
- Output ONLY raw HTML. Start your response with exactly <!DOCTYPE html> — nothing before it.
- No markdown, no code fences, no explanation before or after the HTML.
- Every CDN dependency must use the exact URLs specified in the user prompt.
- All JavaScript initialisation must live inside a DOMContentLoaded listener.
- The result must be a fully working, self-contained single HTML file.
- Fully responsive (mobile-first), modern, clean, and conversion-focused.
- Use the real business name, address, phone, and category throughout.`;

  const user = `Generate a complete, professional one-page demo website for this business that currently has NO website.
Make it look like a real, expensive, custom-built site a marketing agency would be proud of.

## BUSINESS DATA
Name: ${business.name}
Category: ${business.category ?? "local business"}
Address: ${business.address ?? "Not provided"}
Phone: ${business.phone ?? "Call for details"}
Google Rating: ${business.rating ?? "5"}★
Description: ${business.description ?? "Quality local business"}
Social media: ${socials}

${proposalMarkdown ? `## PROPOSAL NOTES (draw copy and structure ideas from this)\n${proposalMarkdown.slice(0, 1500)}\n` : ""}

---

## REQUIRED CDN DEPENDENCIES

### In <head> — in this exact order:
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://unpkg.com/aos@2.3.4/dist/aos.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">

### Immediately after the Tailwind <script>, add Tailwind config with brand colours:
<script>
  tailwind.config = {
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
          display: ['"Plus Jakarta Sans"', 'sans-serif']
        },
        colors: {
          brand: {
            50:  '<HEX>',
            100: '<HEX>',
            200: '<HEX>',
            300: '<HEX>',
            400: '<HEX>',
            500: '<HEX>',
            600: '<HEX>',
            700: '<HEX>',
            800: '<HEX>',
            900: '<HEX>',
          }
        }
      }
    }
  }
</script>

Pick brand colours appropriate for "${business.category ?? "local business"}":
- Restaurant/Café/Food → warm amber/orange
- Hair/Beauty/Salon/Spa → rose/pink or soft purple
- Law/Finance/Consulting → navy/slate with gold
- Gym/Fitness/Sport → black + electric blue or lime
- Medical/Dental/Health/Wellness → teal or sky blue
- Retail/Boutique/Fashion → violet/indigo
- Construction/Plumbing/Trade → deep orange or stone
- Tech/Agency/Software → blue/cyan/indigo
- Default → indigo

### Before </body> — in this exact order:
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
<script src="https://unpkg.com/aos@2.3.4/dist/aos.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  AOS.init({ duration: 700, easing: 'ease-out-cubic', once: true, offset: 60 });

  new Swiper('.testimonials-swiper', {
    loop: true,
    autoplay: { delay: 4500, disableOnInteraction: false },
    pagination: { el: '.swiper-pagination', clickable: true },
    slidesPerView: 1,
    spaceBetween: 24,
    breakpoints: {
      768: { slidesPerView: 2, spaceBetween: 24 },
      1024: { slidesPerView: 3, spaceBetween: 32 }
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var t = document.querySelector(a.getAttribute('href'));
      if (t) t.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
</script>

---

## PAGE SECTIONS — ALL 8 ARE REQUIRED

### 1. STICKY NAVIGATION
Use Alpine.js for scroll shadow and mobile menu:
<nav x-data="{ open: false, scrolled: false }"
     @scroll.window="scrolled = (window.scrollY > 30)"
     :class="scrolled ? 'shadow-lg bg-white/95 backdrop-blur-md' : 'bg-transparent'"
     class="fixed top-0 inset-x-0 z-50 transition-all duration-300">

Contents: text logo (business name, font-display font-bold text-brand-700), desktop links (About, Services, Gallery, Testimonials, Contact), a CTA button (Book Now / Get a Quote / Call Today — pick for "${business.category ?? "business"}") styled bg-brand-600 hover:bg-brand-700 text-white rounded-full px-5 py-2, plus mobile hamburger @click="open = !open" with animated icon. Mobile menu: x-show="open" x-transition stacked links.

### 2. HERO
min-h-screen with gradient from brand-600 to brand-800. Left side: eyebrow text (uppercase tracking-wider), a compelling HEADLINE specific to "${business.name}" and "${business.category ?? "business"}", a 1-2 sentence subheadline, two CTA buttons (primary: white bg + brand text; secondary: outlined white), and a floating trust badge showing "${business.rating ?? "5"}★ on Google". Right side: abstract gradient SVG blob or geometric shape in lighter brand shades. Curved/diagonal bottom divider to white. AOS: data-aos="fade-up" with incremental data-aos-delay on each element.

### 3. ABOUT (bg-white py-24)
Two columns. Left (data-aos="fade-right"): gradient placeholder div (brand-100→brand-200, rounded-3xl, min-h-[400px]) with absolute-positioned floating stats card (e.g. "15+ Years" or "500+ Clients"). Right (data-aos="fade-left"): "About ${business.name}" heading, 2-3 paragraphs of specific copy for this ${business.category ?? "business"} type in ${business.address ?? "the area"}, three bullet points with coloured checkmark icons.

### 4. SERVICES (bg-gray-50 py-24)
Section header (data-aos="fade-up"). Grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8. 3-4 cards — services SPECIFIC to ${business.category ?? "the business"} (not generic). Each card: bg-white rounded-2xl shadow-md p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300. Card contents: coloured icon box (rounded-xl bg-brand-100 p-3 inline-flex mb-4) with appropriate SVG icon, service name (font-display font-bold text-xl), 2-3 sentence description, "Learn more →" in brand-600. data-aos="fade-up" data-aos-delay="{n*100}".

### 5. GALLERY (bg-white py-24)
Section header (data-aos="fade-up"). Responsive grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4. 8 placeholder cells using gradient divs with varied brand shades (brand-100 through brand-800), aspect-square rounded-2xl overflow-hidden. Each has a hover overlay (bg-black/40 opacity-0 hover:opacity-100 transition-opacity) with a centred label. data-aos="zoom-in" data-aos-delay="{n*50}".

### 6. TESTIMONIALS — SWIPER REQUIRED (bg-gray-50 py-24)
Section header (data-aos="fade-up"). Swiper with EXACT class names:
<div class="swiper testimonials-swiper overflow-hidden">
  <div class="swiper-wrapper pb-12">
    <!-- 5 swiper-slide divs -->
  </div>
  <div class="swiper-pagination"></div>
</div>
Each slide: bg-white rounded-2xl shadow-md p-6, five gold stars (★★★★★ in amber-400), quote specific to ${business.category ?? "the business"}, realistic South African reviewer name (mix of Afrikaans/Zulu/English/Xhosa names like "Thabo M.", "Liezel van Wyk", "Priya Naidoo", "Grant Fourie", "Nokwanda D."), and reviewer role.

### 7. CONTACT (bg-white py-24)
Section header (data-aos="fade-up"). Two columns:
LEFT form (data-aos="fade-right"): Full Name, Email, Phone, Message fields (w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 outline-none), submit button (w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl).
RIGHT info (data-aos="fade-left" data-aos-delay="100"): three info cards for Phone (${business.phone ?? "Call us"}), Address (${business.address ?? "Visit us"}), and Hours (appropriate for ${business.category ?? "business"}). Map placeholder div (bg-brand-50 rounded-2xl h-48 flex items-center justify-center with a map-pin SVG).

### 8. FOOTER (bg-brand-900 text-white py-16)
Four columns: brand logo + 2-line description, Quick Links (Home/About/Services/Gallery/Contact), Contact info (address, phone, email), Follow Us (social icons from: ${socials}; use placeholder icons if none). Border rule then copyright: "© ${year} ${business.name}. All rights reserved."

---

## DESIGN STANDARDS
- All section headings: text-3xl md:text-4xl lg:text-5xl font-display font-bold text-gray-900
- Subtitles: text-lg text-gray-500 max-w-2xl mx-auto text-center mt-4
- Container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Cards: rounded-2xl (never rounded-lg)
- Buttons: rounded-full for primary, rounded-xl for secondary
- Every section: min py-20
- Hover/transitions: transition-all duration-300 on all interactive elements
- The hero gradient must be striking, not flat
- The Swiper must use exact class names: "testimonials-swiper", "swiper-wrapper", "swiper-slide", "swiper-pagination"
- Alpine.js mobile menu must be fully functional

Return the full HTML document now, starting with <!DOCTYPE html>.`;

  return { system, user };
}

/** Strip code fences / preamble and return clean HTML. */
export function extractHtml(raw: string): string {
  let html = raw.trim();
  const fence = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) html = fence[1].trim();
  const start = html.search(/<!DOCTYPE html>|<html[\s>]/i);
  if (start > 0) html = html.slice(start);
  return html;
}

// --- Bundled fallback model call. Prefer reusing lib/ai/client.ts instead. ---
async function callModel(system: string, user: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const res = await anthropic.messages.create({
        // Match whatever model your lib/ai/client.ts uses.
        model: process.env.AI_MODEL ?? "claude-3-5-haiku-20241022",
        max_tokens: 8000,
        system,
        messages: [{ role: "user", content: user }],
      });
      const text = res.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
      if (text.trim()) return text;
    } catch (err) {
      console.error("Anthropic demo generation failed; falling back to Pollinations", err);
    }
  }

  // Pollinations OpenAI-compatible fallback (free, community-hosted).
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai-large",
      max_tokens: 8000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function generateDemoHtml(
  business: DemoBusiness,
  proposalMarkdown?: string,
  complete: CompleteFn = callModel,
): Promise<string> {
  const { system, user } = buildDemoPrompt(business, proposalMarkdown);
  const raw = await complete(system, user);
  const html = extractHtml(raw);
  if (!/<html[\s>]/i.test(html)) {
    throw new Error("Model did not return a valid HTML document");
  }
  return html;
}
