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

- One People tab: search names, jobs, and notes; filter by status; sort by longest since contact; notes and flag preview on each card; an Archived section at the bottom
- Profiles with green and red flag tags (tap to toggle on or off), and bullet-point notes
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

## The description box and keyword boxes on the Fit tab

There are three fields under "Add your own keywords" and "Describe your ideal partner".

- **Good signs to look for** (affects score): words you want to see. If they appear in someone's notes or date impressions, their fit score goes up.
- **Red lines** (affects verdict): words that mean no. If any appear, the person is marked "Consider letting go" regardless of score. Negations such as "doesn't", "never", or "does not really" before the word are recognised, so "doesn't smoke" will not trigger "smokes".
- **Describe your ideal partner** (suggests, never applies by itself): write plain sentences, then tap "Read my note and suggest criteria". The app proposes quality settings and keywords, and nothing changes until you tick what you want and tap "Add selected".

The app matches the exact words you type, not their meaning. If you type "hiking" it will not match a note that says "loves the outdoors".

### What the description reader understands

It is a rule-based reader with a fixed vocabulary, not an AI model, so it handles plain statements well and unusual phrasing poorly.

- Emphasis: "must", "need", "essential" become Must have. "Ideally", "prefer", "would be nice" become Nice to have. A plain wish with no emphasis becomes Nice to have, never a Must have.
- Avoidance: "I hate flaky people", "no one who is controlling", "I can't stand rude people" become Deal-breakers on the matching quality.
- Keywords: "I love hiking, travel, and cooking" becomes three separate good signs. "I do not want someone who smokes" becomes a red line.
- If you want a quality and also refuse its opposite ("I need someone who communicates well. I hate flaky people."), it keeps the Must have and tells you it also saw the refusal.
- It skips statements about traits you do NOT want ("someone who is not ambitious") rather than guessing, and lists them under "Parts I did not use" so nothing is dropped silently.
- If a suggestion would replace a level you already chose, it starts unticked so a quick tap cannot undo a deliberate choice.
- Anything it cannot read is shown to you. It never invents criteria from noise.

## Contact history

Each person has a contact history instead of a single "last contact" stamp.

- Add a contact on any past date (the date picker stops at today) with an optional note like "Called".
- Delete any entry, so a wrong date is easy to fix.
- "Last contact" is worked out from the history, never stored separately, so it can never disagree with it. Logged dates also count as contact: deleting a logged date rolls last contact back automatically.
- Adding a new match records "Matched" as the first contact, on today's date. Delete it if it is wrong.
- Dates use your own calendar day, not UTC, so a late-evening entry never lands on tomorrow. This is tested in New York, UTC, Auckland, and Kiritimati.
- Data saved by earlier versions is upgraded automatically: the old single last-contact date becomes one history entry.

## Updating the app on your phone

An installed PWA keeps its old files until it updates. After redeploying `dist/`:

1. Close the app completely (swipe it away), then reopen it once while online. The new version downloads in the background.
2. Close and reopen it a second time to run the new version.
3. If it still looks old: iPhone, delete the Home Screen icon and re-add it from Safari (your data is stored per site and survives this only if you use the same URL, so export a backup first from Insights). Android, long-press the icon, App info, Storage, Clear cache.

## Stages, and letting someone go

Every person is in one stage: **Talking stage** (getting to know each other, no dates yet), **Texting**, **Planning date**, **Dating**, **On hold**, or **Let go / ended**. New matches start in Talking stage.

Choosing **Let go / ended** on a profile opens a short form: an optional reason (not compatible, they ghosted or faded out, I lost interest, they ended it, red flags, wrong timing, other), the date it ended, and an optional note. Nothing changes until you tap Mark as ended, and Cancel leaves everything as it was. If you pick no reason, none is recorded.

What happens to someone who has ended:

- They leave the main list and the Fit tab, and move to a **Let go / ended** section. A "Let go" filter shows just them, most recently ended first.
- The app never nags you to reply to them.
- Their dates stay in your date history, in your average rating, and in what the app learns about you. A date you rated is real information about your taste even if the relationship did not last.
- You cannot log a new date with them, but you can still edit their old dates.
- Insights shows a "Why things ended" breakdown. It tells you when there are only one or two reasons so far, because a pattern from that few is not really a pattern.
- To reopen someone, open their profile and pick any stage. The reason is cleared.

**Archive** is separate: it just hides someone you may come back to, and does not record an outcome.

Data saved before this version loads unchanged. A stage that no longer exists, or none at all, becomes Texting.
