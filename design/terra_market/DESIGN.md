# Design System Document: The Pastoral Editorial

This document defines the visual and structural language for a high-end livestock marketplace. Moving beyond the "commodity" feel of standard trading apps, this system utilizes an editorial approach that treats livestock as premium assets. We prioritize depth, sophisticated tonal layering, and authoritative typography to build unwavering trust between buyers and sellers.

---

## 1. Overview & Creative North Star: "The Digital Agronomist"

The Creative North Star for this system is **"The Digital Agronomist."** 

Unlike generic marketplaces that feel cluttered and transactional, this system adopts an editorial, high-trust aesthetic. It combines the reliability of a heritage farming journal with the slick, frictionless performance of modern fintech. 

**Key Design Principles:**
*   **Intentional Asymmetry:** Break the rigid "grid of squares." Use varied card heights and overlapping image treatments to create a sense of curation.
*   **Atmospheric Depth:** Replace "lines" with "light." We define spaces using background shifts and glassmorphism rather than restrictive borders.
*   **Authority through Scale:** Use dramatic contrasts between massive Display titles and functional Body text to guide the eye through complex data.

---

## 2. Colors & Surface Hierarchy

The palette transitions from the "dirt and grass" of the field (Deep Greens and Browns) to the "clear sky" of professional commerce (Blues and Oranges).

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are strictly prohibited for sectioning. Structural boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section should sit on a `surface` background to create a natural break.

### Surface Hierarchy & Nesting
Treat the UI as stacked sheets of fine paper or frosted glass.
*   **Base:** `surface` (#f9f9ff) for the widest layout areas.
*   **Sections:** Use `surface-container-low` (#f0f3ff) for grouping related listing categories.
*   **Elevated Content:** Place cards using `surface-container-lowest` (#ffffff) to provide a soft "pop" against the background.

### The "Glass & Gradient" Rule
To avoid a "flat" template look, use Glassmorphism for floating navigation bars or filter overlays:
*   **Surface:** `surface_variant` (#d6e3ff) at 70% opacity.
*   **Effect:** `backdrop-filter: blur(12px)`.
*   **Gradients:** Use a subtle linear gradient from `primary` (#af2900) to `primary_container` (#d63c10) for primary CTAs to give them tactile "soul."

---

## 3. Typography: Editorial Authority

We use a pairing of **Work Sans** for high-impact brand moments and **Inter** for dense transactional data.

*   **Display & Headlines (Work Sans):** These are your "Editorial Voices." Use `display-lg` for hero marketplace sections. The wide aperture of Work Sans conveys transparency and modernity.
*   **Body & Labels (Inter):** These are your "Functional Voices." Use `body-md` (#0b1b34) for livestock descriptions. Inter’s high x-height ensures legibility even when reading animal specs (weight, age, breed) on a mobile device in direct sunlight.
*   **Contextual Tones:** Use `on_surface_variant` (#5b403a) for secondary metadata to create a sophisticated, earthy hierarchy that avoids the harshness of pure black-on-white.

---

## 4. Elevation & Depth

We eschew traditional "box shadows" in favor of **Tonal Layering.**

*   **The Layering Principle:** Depth is achieved by stacking. Place a `surface-container-highest` button on a `surface-container` card. The shift in hex value creates the "lift."
*   **Ambient Shadows:** Where floating is required (e.g., a "Post Listing" FAB), use:
    *   **Blur:** 24px - 40px.
    *   **Color:** `on_surface` (#0b1b34) at 6% opacity.
*   **The Ghost Border Fallback:** If a container requires a boundary (e.g., on a high-brightness photo), use `outline_variant` (#e4beb5) at **15% opacity**. Never use 100% opacity borders.

---

## 5. Components

### Cards & Listings
*   **Constraint:** No divider lines. Separate content (Price vs. Location) using `8px` or `12px` vertical white space from the spacing scale.
*   **Visual Style:** Use `roundedness.xl` (0.75rem) for image containers to soften the industrial feel.

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. White text (`on_primary`). High-gloss, professional.
*   **Secondary:** `secondary_container` (#a2f569) with `on_secondary_container` (#347000) text. This "Earth Green" confirms the agricultural context.
*   **Tertiary:** No background. Use `tertiary` (#00609a) text with a `label-md` weight.

### Status Badges (The "Health Check")
*   **Active/Verified:** Use `secondary` (#316b00) background with 10% opacity and a solid `secondary` text color. 
*   **Sold/Unavailable:** Use `outline` (#8f7068) to denote a "dried earth" inactive state.

### Input Fields
*   **Style:** Minimalist. No bottom line. Use `surface-container-high` as the background fill. Labels should use `label-sm` floating above the container.

### Marketplace Specific: "Spec Grid"
*   A custom component for livestock: A 2-column grid of metadata (e.g., "Weight: 500kg", "Breed: Angus") using `surface-container-low` tiles. This avoids a messy list and treats data as premium specs.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical image ratios (e.g., 4:5 for hero listings) to give the app a magazine feel.
*   **Do** use `secondary` (Green) for price increases/market trends and `primary` (Orange/Red) for urgent CTAs.
*   **Do** prioritize "Breathing Room." If a screen feels crowded, increase the background-color-shift areas rather than adding more boxes.

### Don’t
*   **Don't** use pure black (#000000). Always use `on_surface` (#0b1b34) for text to maintain the sophisticated deep-blue/charcoal tone.
*   **Don't** use 1px dividers to separate list items. Use a 4px `surface-container` gap instead.
*   **Don't** use "Standard Blue" for everything. Reserve `tertiary` (#00609a) for professional links and financial information only.

---

## 7. Token Reference Summary

| Role | Token / Value | Usage |
| :--- | :--- | :--- |
| **Action CTA** | `primary` (#af2900) | Buy, Contact, High-priority actions. |
| **Agri-Brand** | `secondary` (#316b00) | Verification, Success, Growth, Health. |
| **Trust/Finance** | `tertiary` (#00609a) | Banking, Escrow, Technical details. |
| **Surface Base** | `surface` (#f9f9ff) | Main app background. |
| **High Surface** | `surface-container-lowest` (#ffffff) | Cards and elevated floating elements. |
| **Border Fallback**| `outline-variant` @ 15% | Very subtle "Ghost" containment. |
| **Radius** | `xl` (0.75rem) | All primary cards and listing images. |