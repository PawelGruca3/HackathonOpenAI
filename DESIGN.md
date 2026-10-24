---
name: Intake
description: Patient intake and clinician case workspace
colors:
  mobile-background: "#ffffff"
  web-background: "#fafafa"
  surface: "#ffffff"
  mobile-text: "#171717"
  web-text: "#171717"
  mobile-supporting: "#606060"
  mobile-legacy-muted: "#626262"
  web-muted: "#626262"
  mobile-primary: "#175fc2"
  web-primary: "#175fc2"
  mobile-border: "#e3e3e3"
  web-border: "#e3e3e3"
typography:
  native-title:
    fontFamily: "System"
    fontSize: "27px"
    fontWeight: 700
    letterSpacing: "-0.5px"
  web-heading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "32px"
  web-body:
    fontFamily: "DM Sans, sans-serif"
  native-body:
    fontFamily: "System"
    fontSize: "15px"
    lineHeight: "23px"
rounded:
  action: "12px"
  native-card: "14px"
  web-action: "10px"
spacing:
  screen: "20px"
  group: "12px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "#171717"
    textColor: "{colors.surface}"
    rounded: "{rounded.action}"
    height: "52px"
    padding: "14px"
  native-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.native-card}"
    padding: "18px"
---

# Design System: Intake

## Overview
The patient app and clinician workspace use white surfaces, neutral gray supporting elements, black primary actions and restrained blue accents. Original symptoms, separate intensity and urgency signals, and the next useful action take priority.

## Colors
The frontmatter records observed values. New native supporting text uses `mobile-supporting`; the incumbent body controls retain `mobile-legacy-muted`. Amber callouts identify demonstrations; red callouts identify urgent estimates. Labels carry the meaning alongside color.

## Typography
Use native system type on iOS and Manrope headings with DM Sans text on the web. Native titles are 27px. Web case titles are 32px, 27px at widths up to 1000px, and 25px at widths up to 700px. Body copy is 15–17px; supporting copy is 12–14px.

## Layout
The original GLB body remains the patient intake centerpiece. Paint/Rotate controls precede the canvas; holding deepens intensity and dragging paints freely. Undo/Clear and disclosed accessible area steps support correction and alternate input. Persistent actions sit below scrolling forms. Native screens use 20px horizontal padding.

The web workspace uses a 355px intake list beside a flexible packet, reduced to 300px at 1000px. Below 700px, list and detail become separate views with an explicit back action.

## Elevation & Depth
New packet sections use separators and white surfaces. Existing body controls retain their subtle offset shadows. There is no new decorative shadow system.

## Shapes
Native actions use 12px corners, cards 14px, and web actions 10px. Small status labels use tighter corners. Shared native chips and back controls use 44px minimums; primary actions are 52px. The inherited body-view controls also use hit slop.

## Components
Clinical assessment leads in the doctor packet; the patient summary is available in a disclosure. Notes show authorship and time and are visible in patient history. The photo preview uses a native web dialog for modal focus behavior. Async screens provide loading, error/retry and empty states.

## Do's and Don'ts
- Do retain separate labels for patient intensity and AI urgency.
- Do identify demo output and fictional directory entries at their point of use.
- Do preserve the original body assets and provide editable region corrections.
- Don't present an AI estimate as a diagnosis or a guarantee of safety.

## Continuous surface painting
The updated body intake uses exact mesh surface samples, not preset area fills. Holding deepens red intensity; drag paints a stroke. Paint/Rotate controls precede the canvas. Undo, Clear and accessible step controls support alternate inputs. Patient and clinician case views render the saved map. Main actions are black; blue is limited to selection borders and navigation. Long limitations use disclosures. Case deletion uses a keyboard-accessible confirmation and a focused Undo action.
