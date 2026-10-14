# INSync Login and Registration Interface Plan

## Goal
Build a polished, responsive, accessible React + Tailwind prototype for INSync with connected Login and Intern Registration screens. The app will remain entirely client-side because the repository has no authentication or Supabase integration. It will clearly disclose that submissions are simulated, will not transmit or persist entered credentials, and will provide discoverable demo scenarios for invalid credentials and pending approval.

## Repository Findings and Constraints
- The project is a minimal React 19 + Vite 8 + Tailwind CSS v4 scaffold.
- `src/App.tsx` currently renders an empty centered container; `src/index.css` only imports Tailwind.
- There is no router, auth service, Supabase client, form library, icon package, or established design system.
- The implementation should therefore use local React state, semantic HTML, Tailwind utilities, and a small inline SVG icon/illustration system without introducing dependencies.
- The existing supervised development server must not be started manually.
- Implementation should preserve default exports and follow the repository’s JSX/string correctness requirements.

## Product and Interaction Decisions
- Use a local `screen` state (`login` or `register`) rather than adding a routing dependency. Footer actions are real buttons styled as text links and switch screens without a page reload.
- Add a concise, visible “Demo mode” disclosure near the login helper scenarios: no information is sent or saved.
- Provide two small scenario buttons/links:
  - **Try invalid credentials** fills clearly fictitious sample values and selects the invalid-credentials outcome.
  - **Try pending approval** fills clearly fictitious sample values and selects the pending-account outcome.
- A login submit validates required fields and email format first, then shows a short simulated loading state. The pending demo resolves to the pending approval notice; all other valid login submissions resolve to an invalid-credentials alert because there is no real authentication backend. No successful-authentication destination will be fabricated.
- Registration validates locally, shows a short simulated loading state, then replaces/updates the form region with the success notice: “Account created. Your account is awaiting administrator approval.” The success state includes a clear action to return to Sign in.
- Form values live only in component memory and are cleared when appropriate; there is no localStorage, sessionStorage, network request, or analytics call.
- Password requirements will be modest and explicit: required and at least 8 characters. Confirm password must match. This gives users actionable client-side feedback without inventing complex policy.
- Validation runs on submit and then updates touched fields on blur/change so errors can be corrected without premature noise.

## Visual Direction
- Use a soft warm-neutral page background, deep navy branding panel, teal interactive accents, white form surface, restrained borders, and a subtle shadow.
- Use a clean system sans-serif stack to avoid adding font/network dependencies.
- Keep the content width balanced: approximately 44% branding / 56% form on desktop, with a centered form column around 480–520px.
- Branding panel:
  - Simple typographic `INSync` mark with a compact teal sync/link motif.
  - Headline and supplied supporting copy.
  - Custom inline SVG illustration combining a student/profile silhouette, calendar card, checklist/document, and progress chart. Use simple vector geometry, navy/teal/white tones, and no external image or emoji.
  - Three compact feature rows/chips using consistent SVG icons for attendance, submissions, and progress.
- Form panel:
  - Restrained heading sizes, generous vertical rhythm, persistent labels, optional field icons, rounded 12–14px controls, and a full-width teal primary button.
  - Focus uses a high-contrast teal ring plus border change; errors use a red border/ring and adjacent message; disabled/loading buttons retain readable contrast.
- Avoid gradients and nonessential animation. Only use subtle color/opacity transitions for hover/focus; respect `prefers-reduced-motion` through minimal motion by design.

## Component Architecture
Create a small authentication component set under `src/components/auth/` and keep screen orchestration in `src/App.tsx`:

1. **`AuthLayout.tsx`**
   - Shared two-panel shell and branding content.
   - Accepts form content as children and an optional compact context label for mobile.
   - Owns the inline branding illustration and feature list.

2. **`FormField.tsx`**
   - Reusable controlled text/email field.
   - Props for `id`, label, type, value, change/blur handlers, autocomplete, input mode, error, icon, and required state.
   - Wires `aria-invalid` and `aria-describedby` to stable helper/error IDs.

3. **`PasswordField.tsx`**
   - Wraps the shared field styling with local show/hide state.
   - Uses an accessible button with dynamic `aria-label` (“Show password” / “Hide password”), `aria-pressed`, eye/eye-off SVG, and `type="button"`.

4. **`SubmitButton.tsx`**
   - Shared primary action with disabled/loading state, inline vector spinner, `aria-busy`, and stable action text.

5. **`Notice.tsx`**
   - Shared info/error/success/pending notice styling.
   - Supports appropriate icon, visual tone, and role (`alert` for errors, `status`/polite live region for asynchronous success or pending messages).

6. **`Icons.tsx`**
   - Small typed icon component or named inline SVG components for mail, lock, user, ID card, eye, calendar/check, document, chart, info, success, alert, and arrow.
   - All decorative icons use `aria-hidden="true"`; meaningful controls receive accessible names from their buttons/labels.

7. **`src/App.tsx`**
   - Owns current screen state and renders `LoginForm` or `RegistrationForm` within `AuthLayout`.
   - Defines the two form components (or colocates them in focused files if implementation readability requires it) and their local values, touched/errors, loading, and result states.
   - Switch-screen handlers reset sensitive fields, errors, and transient notices.

8. **`src/index.css`**
   - Keep `@import 'tailwindcss';` first.
   - Add a small Tailwind v4 `@theme` palette for INSync navy, teal, neutrals, and semantic colors where useful.
   - Set global box sizing/body typography, minimum page dimensions, background, antialiasing, and safe overflow behavior.
   - Add only CSS that is clearer globally than as utilities (for example the spinner keyframes and reduced-motion handling).

## Login Screen Details
- Render heading “Welcome back” and supplied description.
- Fields:
  - Email address (`type="email"`, `autocomplete="email"`, mobile email keyboard).
  - Password (`autocomplete="current-password"`) with show/hide toggle.
- Primary “Sign in” button.
- Footer text and action: “New to INSync? Create an account”.
- Demo helper area is visually secondary and explicitly says it is a local prototype. Its scenario controls use buttons so they are keyboard accessible.
- Errors:
  - Required messages directly below each relevant field.
  - Email format error beside/below email field.
  - Invalid submission produces a form-level alert: credentials could not be verified in this demo.
- Pending scenario produces the exact notice: “Your account is awaiting administrator approval.”
- While submitting, disable editable controls and scenario/navigation actions as needed, change button content to “Signing in…”, and prevent duplicate submission.

## Registration Screen Details
- Render heading “Create your intern account” and supplied description.
- Fields:
  - Full name (`autocomplete="name"`).
  - Student ID (`autocomplete="off"`).
  - Email address (`type="email"`, `autocomplete="email"`).
  - Password (`autocomplete="new-password"`) with show/hide toggle and 8-character helper text.
  - Confirm password (`autocomplete="new-password"`) with independent show/hide toggle.
- Full name and Student ID share a two-column grid at medium/wide form widths and collapse to one column on mobile; remaining fields remain stacked.
- Show the exact approval notice near submit: “New accounts require administrator approval before internship records can be accessed.”
- Primary “Create account” button.
- Footer text and action: “Already have an account? Sign in”.
- Errors cover required values, invalid email format, password length, and password mismatch, with focus moving to the first invalid field on failed submit.
- While submitting, button text becomes “Creating account…” and duplicate submissions/navigation are disabled.
- On success, announce and display the exact message “Account created. Your account is awaiting administrator approval.” with a “Continue to sign in” action; clear password values immediately.

## Responsive and Layout Behavior
- Desktop (`lg` and above): full-height two-column layout, with the left panel filling its column and the right surface centering the form without fixing the form height.
- Tablet/mobile: one-column document flow. Convert the left panel into a compact branded introduction, hide or simplify the large illustration, and omit the longer feature list where needed so the form appears quickly.
- Use `min-h-dvh` rather than a rigid viewport height and allow normal document scrolling.
- Add responsive horizontal padding and safe bottom spacing; cap all content widths and use `min-w-0`/wrapping where needed to prevent overflow.
- Do not place registration in an overflow-hidden or fixed-height card. Controls remain reachable on short screens and with the virtual keyboard open.
- Maintain at least 44px touch targets for submit, navigation, demo, and visibility controls.

## Accessibility and Form Semantics
- Use semantic `<main>`, `<section>`, `<form>`, `<label>`, and `<button>` elements.
- Each field has a persistent visible label and a unique ID; placeholders, if used, are examples only.
- Associate helper and error text via `aria-describedby`; apply `aria-invalid` only when invalid.
- Use a form-level live region for async outcomes. Avoid moving focus for transient loading; focus the first invalid field after validation and the success heading/notice after registration completion.
- Ensure all icon-only controls have descriptive accessible names and visible keyboard focus.
- Ensure navy/white, teal/white, muted text, and error colors meet readable contrast targets.
- Keep native submit behavior within React handlers so Enter submits and keyboard navigation works naturally.

## Verification
1. Run the repository formatter with `pnpm format` after implementation.
2. Run `pnpm build` because this is a broad multi-file UI/state change; resolve TypeScript, JSX, and Tailwind build failures.
3. Manually verify in the existing preview at desktop and narrow mobile widths:
   - Login ↔ Registration navigation.
   - Independent password visibility toggles.
   - Required, invalid email, password length, and mismatch errors.
   - First-invalid-field focus behavior.
   - Demo invalid-credentials and pending-account scenarios, including visible loading states.
   - Registration loading and success notice.
   - Keyboard-only traversal, Enter submission, visible focus, and accessible button labels.
   - Mobile stacking, no horizontal overflow, page scrolling on short heights, and reachable controls.
4. Confirm no network/auth persistence code was added and no real credentials are saved or implied to authenticate.

## Expected Scope
- Modify `src/App.tsx` and `src/index.css`.
- Add focused reusable authentication components under `src/components/auth/`.
- Do not add dependencies, routing, backend integration, persistence, or unrelated project changes.
