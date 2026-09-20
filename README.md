# Roster

A private, on-device dating tracker. React + Vite PWA. No accounts, no server, no analytics.

## Run it

    npm install
    npm run dev        # development
    npm run build      # production build into dist/
    npm run preview    # serve the build locally

## Put it on your phone

1. Host the `dist/` folder over HTTPS (Netlify Drop, Vercel, GitHub Pages, or Cloudflare Pages all work free).
2. Open the URL on your phone.
3. iPhone: Safari, Share, Add to Home Screen. Android: Chrome menu, Install app.

PWAs need HTTPS (localhost is exempt) for install and offline use.

## Features

- Roster with status badges, filters, and sort by longest since contact
- Profiles with green and red flag tags, and bullet-point notes
- Date log timeline with 1 to 5 star ratings and follow-up status
- Voice notes using the browser Web Speech API, turned into bullets on-device
- Fit tab: say what you want (must-haves, nice-to-haves, deal-breakers, your own words) and get a Keep pursuing, Keep watching, or Consider letting go call for each person, with reasons
- Learning: the Fit tab keeps learning from your date ratings, check-ins, and "does this feel right" answers, tells you when what you say you want differs from what your dates show, and shows exactly how it adjusted each score
- Insights: average rating, where you meet people, most common tags
- Archive and restore, JSON export and import for backups

## Privacy and data

All data is stored in this browser's localStorage. Clearing site data erases it, so use Insights, then Export, for backups.

## Voice notes

Uses the free Web Speech API. Works in Chrome, Edge, and Safari. Chrome sends audio to Google's servers for recognition, so if that matters to you, type notes instead. Firefox does not support it and the app falls back to typing.

## How the Fit tab decides

Everything runs on your device with plain scoring rules. There is no AI model and no network call.

1. Deal-breakers come first. If a red-flag tag you marked as a deal-breaker is on someone, or your notes mention a word you said to avoid, the call is Consider letting go no matter how high the score is.
2. Otherwise it scores 0 to 100 from your must-haves (weighted 3), nice-to-haves (weighted 1), your average date rating, and green versus red tags. 70 and up is Keep pursuing, 45 to 69 is Keep watching, under 45 is Consider letting go.
3. Missing information is not held against someone. Anything you have not recorded counts as unknown, not as a failure.
4. Each call shows a confidence level. With little data (roughly one date or fewer signals) the app will not say Consider letting go unless a deal-breaker fired, and will not say Keep pursuing on thin evidence.
5. Notes are matched as whole phrases and simple negation is handled, so "not rude" is not treated as rude and "chocolate" is not treated as "late".

Limits: it reads keywords, not meaning, so sarcasm or unusual phrasing can be missed. The more specific your tags and notes, the better it works. It reflects your own records against your own standards. It cannot know the person, so treat it as a second opinion and make the final call yourself.

## How learning works

All learning runs on your device with transparent arithmetic. There is no AI model, no account, and nothing leaves your phone.

**What it learns from**
1. Your date ratings. For each quality, it compares dates where the person showed it against dates where they showed the opposite, and checks whether you rated those dates higher.
2. Post-date check-ins (two taps: what you enjoyed, what was missing).
3. Your yes or no on "does this call feel right".

**What it changes**
- For qualities you listed as Must have or Nice to have, the weight moves up if they lift your ratings more than that priority implies (a must have should lift ratings about 1.5 stars, a nice to have about 0.75), and down if they lift them less. Every change is shown on the person's card with the numbers behind it.
- If you often disagree with "keep pursuing" calls the bar for that call rises, and if you often disagree with "let go" calls it drops. It needs 4 answers first and moves at most 8 points.
- It never adds a quality you did not list. Qualities that seem to matter to you but are not in your criteria are surfaced as a gap so you decide.
- It never overrides a deal-breaker.

**Safeguards against fooling itself**
- Needs at least 2 dates with a quality and 2 without before it trusts a pattern.
- Small samples move scores only a little, and no single quality can shift a weight by more than 1.5.
- Silence is not treated as evidence: people with nothing recorded for a quality are left out of the comparison.
- One mention in a check-in is ignored, and check-in influence is capped.

**Honest limits**
- Your history is small. Even with the safeguards, a pattern from 6 to 10 dates can be coincidence, so the app labels its confidence and says so.
- It reads keywords in your notes and tags. The more specific you are, the better it learns.
- Correlation is not cause. If you rate funny people higher, that may be about the situations you met them in, not humor itself.
- Ratings are subjective and shift with your mood. Treat the output as a second opinion.

Turn off "Let learning adjust my scores" on the Fit tab any time to score from only what you typed. "Reset what I learned" erases feedback and check-ins but keeps your people and dates.
