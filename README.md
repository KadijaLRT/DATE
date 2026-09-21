# Date-a-Dex

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
- Conversation prompts, profile sections you can hide, quick log, plans with reminders, "remember for next time" (the single place for details about someone), and post-date reflections
- Personal patterns, an emotional timeline, undo, an optional PIN lock, and encrypted backups
- A relationship timeline: dates, contact, your own moments and how it ended, in order, on every profile and on one Timeline tab for everyone
- Profiles with green and red flags (chosen from a collapsible list, or typed in your own), and remembered details
- Date log timeline with 1 to 5 star ratings and follow-up status
- Voice notes using the browser Web Speech API, turned into bullets on-device
- Fit tab: say what you want and what you do not want (two separate sides, each with two strengths) and get a Keep pursuing, Keep watching, or Consider letting go call for each person, with reasons
- Learning: the Fit tab keeps learning from your date ratings, check-ins, and "does this feel right" answers, tells you when what you say you want differs from what your dates show, and shows exactly how it adjusted each score
- Insights: average rating, where you meet people, most common tags
- Archive and restore, JSON export and import for backups

## Privacy and data

All data is stored in this browser's localStorage. Clearing site data erases it, so use Insights, then Export, for backups.

## Voice notes

Uses the free Web Speech API. Works in Chrome, Edge, and Safari. Chrome sends audio to Google's servers for recognition, so if that matters to you, type notes instead. Firefox does not support it and the app falls back to typing.

## How the Fit tab decides

Everything runs on your device with plain scoring rules. There is no AI model and no network call.

1. Red lines come first. If a red-flag tag you marked as a red line is on someone, or a red-line quality or word shows up in their notes, tags, or date impressions, the call is Consider letting go no matter how high the score is.
2. Otherwise it scores 0 to 100 from your must-haves (weighted 3), nice-to-haves (weighted 1), your average date rating, and green versus red tags. Each "Would rather not" hit then subtracts 12 points (never more than 30 in total). 70 and up is Keep pursuing, 45 to 69 is Keep watching, under 45 is Consider letting go.
3. Missing information is not held against someone. Anything you have not recorded counts as unknown, not as a failure.
4. Each call shows a confidence level. With little data (roughly one date or fewer signals) the app will not say Consider letting go unless a red line fired, and will not say Keep pursuing on thin evidence.
5. "Would rather not" lowers the score but can never force Consider letting go by itself: if the person's score was in the Keep watching range before the deduction, the call stays Keep watching. Only a red line forces it.
6. Notes are matched as whole phrases and simple negation is handled, so "not rude" is not treated as rude and "chocolate" is not treated as "late".

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
- It never overrides a red line.

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

## Wants and don't-wants on the Fit tab

What you want and what you do not want are stored separately, so one quality can be both: "I need someone who communicates well" (a want) and "I hate flaky people" (a don't-want about its opposite). Older versions kept only one level per quality and silently dropped the second; that is fixed.

**What I want**: each quality is Must have (weight 3) or Nice to have (weight 1). "Good signs to look for" are your own words that raise the score when they appear.

**What I do not want** has two strengths:

- **Red line**: forces "Consider letting go" whatever the score.
- **Would rather not**: lowers the score by 12 points (capped at 30 in total), flags it, and never forces "Consider letting go" on its own.

Each quality has a plain-language "avoid" version (for example "Flaky or hard to reach"). You can also set red-flag tags as red lines, and type your own red line words and would-rather-not words.

Keywords match the exact word in a person's notes, tags, or date impressions, not its meaning, and "doesn't smoke" will not trigger "smokes". Type "smoke", "smokes", and "smoking" if you write all three.

### Flags on each person

Every person's card lists which of your wants and don't-wants showed up and where, for example `Red line: smokes  a note: "He smokes daily"`. If would-rather-not hits lowered the score, the card shows the before and after (70 to 58).

### The description box

Write plain sentences, then tap "Read my note and sort it into wants and don't-wants". Nothing changes until you tick what you want and tap "Add selected". The review has two groups, "What you want" and "What you do not want", each item showing the sentence it came from. Keyword rows show who they would match right now, so you can see the effect of a red line before adding it.

It is a rule-based reader with a fixed vocabulary, not an AI model, so it handles plain statements well and unusual phrasing poorly.

- Wants: "must", "need", "essential" become Must have. "Ideally", "prefer", "would be nice" become Nice to have. A plain wish becomes Nice to have, never a Must have.
- Don't-wants follow the same rule in reverse: strong wording ("I hate", "I can't stand", "deal-breaker", "absolutely no") starts as Red line; plain wording ("I don't want", "no smokers", "not clingy") starts as Would rather not. You can change any level before adding.
- "Smoking is a dealbreaker" refuses smoking (the refused thing can come before the cue word).
- Mixed sentences are split: "someone kind but not clingy" gives a want (kind) and a don't-want (clingy).
- Saying you do not want a good quality ("someone who is not ambitious") becomes a keyword don't-want.
- If a suggestion would replace a level you already chose, it starts unticked, and the disagreement is listed.
- Anything it cannot read is shown under "Parts I did not use". It never invents criteria from noise.

Old saves are upgraded automatically: the earlier "Deal-breaker" level becomes a Red line on the matching don't-want.

## Everything on a profile feeds Fit

| Profile data | How Fit uses it |
| --- | --- |
| Remembered details, how you met, job, location, contact log notes | Searched for your wants, don't-wants, and keywords. Contact notes the app writes itself ("Matched") are ignored. |
| Green and red flags, including your own | Green raises the score, red lowers it |
| Dates: rating, activity, impressions | Rating feeds the score; text is searched like notes |
| Follow-up on your most recent date | Up to 6 points: next date planned +6, you still want to text +1, waiting on them 0, not continuing -6 |
| Contact history | Up to 4 points, from how recently and how often you logged contact (very active +4, gone quiet -4). It counts contact in either direction |
| Moments you add | Text is searched like notes; feelings move the score up to 4 points either way |
| Reflections, plans, and remembered details | Their text is searched; quick reflection answers move the score up to 4 points either way |
| Age and location | Shown on the profile only. There is no age range or place setting, so neither is scored or held against anyone. Your own words can still match the location text |

The follow-up, contact, feeling, and reflection adjustments add up to at most 10 points either way, and each one is shown on the card with its number. Missing data is never held against someone: no logged contact or no follow-up simply means no check. Not used: the name and when you added the profile. Ended people are left out of the Fit tab, though their dates still teach it.

## Quick log, plans, and reminders

**Quick log** sits at the top of the People tab, collapsed until you open it. Pick a person, then one tap logs "We talked today", one line plus a feeling saves a note to their timeline, and "Log a date" opens the date form for them.

**Plans and reminders.** On a profile, "Plan a date" saves a day, what, and where, with a reminder on or off. When a plan with a reminder is due (from a few days before, set in Settings from 0 to 7, default 2), a slim "Coming up" banner appears at the top of People with the things you saved to remember for that person. When nothing is due there is no banner. Plans stay on the timeline with a countdown, and a plan whose day has passed offers "It happened: log the date" on the profile. Date-a-Dex sends no notifications, because nothing ever leaves your device.

**Remember for next time** is the one place for details about a person: a like (a coffee order), a place to try, an interest, a topic to bring up, a date idea, or a plain note. Topics and ideas can be ticked off. What you saved shows under their upcoming plan and on People cards. Older saves that had a separate "Things to remember" list were merged into this one automatically, as Notes, so nothing was lost and Fit's results did not change.

**Conversation prompts** is a collapsed panel on each profile with 36 questions across six themes (getting to know, fun, values, how we talk, care and support, looking ahead). It shows one at a time. "Another" moves to the next, "Save for next time" adds it to Remember for next time as a topic, and "We talked about it" saves it as ticked off and adds a "Talked about: ..." entry to their timeline. A question you have used with someone never comes back for them, and using one with a person does not use it up for anyone else. While someone is still in the talking stage, or you have had fewer than two dates, the lighter questions come first; after that the deeper ones do. The themes alternate so suggestions do not clump, and they are only questions to spark conversation, not advice about anyone.

You can open the app on a specific tab with `?tab=people`, `timeline`, `dates`, `fit`, or `insights` on the address.

## Reflections after a date

In the date form, "Reflect on this date (optional)" asks: comfortable being myself, heard and understood, enjoyed our time, respected, and whether you want to see them again (Yes / Somewhat / No, tap again to clear), plus "anything I want to understand better" and a journal box. Every question can be skipped. Reflections show as chips on the timeline, and the Dates tab has a collapsed "Unfinished reflections" panel listing dates from the last three weeks you have not reflected on. In Fit, your three most recent reflections with quick answers can move the score up to 4 points, inside the same shared 10 point cap as follow-ups, contact and feelings. Text-only reflections do not change the score, but their words are searched by your keywords.

## Fit, explained in four parts

Everything on the Fit tab starts collapsed: "What I am looking for", "What I have learned about you", and each person's card, which shows only their name, the call, and the score until you open "Why this call". Inside, each card is split into **Compatibility** (how what you recorded lines up with what you want), **Personal experience** (ratings, follow-up, contact, feelings, reflections), **Unknowns** (things you care about that nothing has been recorded for yet, including a missing age or location when you set preferences), and **Evidence** (the confidence level and how many dates, reflections, notes, contacts, moments, flags and plans it rests on). The scoring rules did not change; only how they are presented.

## Patterns in your own entries (Insights)

- **How things have felt**: a line through your moment feelings (rose dots) and reflection results (dark dots) over time, for everyone or one person. It has a text description for screen readers.
- **Patterns**: the dates you rated highest by activity, words that keep coming up in your notes and reflections, and your Yes and No counts per reflection question. Each needs at least a few entries, and it describes your records only; it is not advice about any person.

## Undo

Deleting a person, date, contact, moment, plan, or reminder, or erasing everything, shows "Undo" for 8 seconds. The undo copy lives only in memory and is dropped when the message goes.

## Settings (the gear, top right)

- **Privacy dashboard**: what is stored, roughly how big it is, whether the lock is on, and when you last made a backup. Everything is stored only in this browser.
- **App lock**: a 4 to 8 digit PIN, stored only as a salted PBKDF2 hash. It locks when you open the app and after you have been away for the time you choose (every time, 1 minute, 5 minutes, or 1 hour), or with Lock now. Five wrong PINs in a row make you wait 30 seconds. It keeps casual snoopers out. **It does not encrypt what is saved in the browser**, and if you forget the PIN the only way back in is clearing this site's data, which erases everything, so keep a backup.
- **Backups**: a plain JSON backup, restore, and an **encrypted backup** protected by a passphrase you choose (AES-256-GCM, key derived with PBKDF2, at least 8 characters). There is no recovery: lose the passphrase and that file cannot be opened by anyone. Restore detects encrypted files and asks for the passphrase; a wrong one changes nothing. Your settings are included in a backup, but your PIN is never exported.
- **People cards**: choose whether each card shows details, remembered details, flags, and last contact. Profiles always show everything.
- **Profile sections**: hide the parts of a profile you do not use (flags, plans, remember for next time, conversation prompts, timeline and contact log). Hiding only tucks a section away: nothing is deleted, and hidden data still counts in Fit.
- **Reminders**: how many days before a plan to remind you.
- **Erase everything** (with undo).

## The timeline

Everything you record about someone lines up in one chronological story, newest first, grouped by month. Each entry has a date badge on the left and a card on the right, colored by type:

- **Date**: the activity, star rating, follow-up, and your impressions, with an "Open date log" button to edit it.
- **In touch**: contact you logged (with its note).
- **Matched** and **Let go**: when you matched, and how it ended (reason and note).
- **Moments**: things you add yourself: a Conversation, a Plan, a Milestone, or How I felt. Each has a day, some text (you can dictate it), and an optional feeling: Great, Good, Okay, Uneasy, or Rough.

Nothing is copied. The timeline is built from what the app already stores, so editing a date or deleting a contact changes it immediately.

**On each profile** the timeline replaces the old contact list. "We talked today" logs a contact for today in one tap (it is a normal entry, so the x on it undoes it), "Another day" logs contact on a past date, and "Add a moment" opens the form. Contacts, the match entry, and moments have an x to delete (deleting a moment asks first).

**The Timeline tab** shows everyone. Pick a person, filter by Dates, In touch, or Moments, and optionally include archived people. Tap a name to open their profile.

Your moments feed Fit like everything else on a profile. Their text is searched by your keywords, wants, and don't-wants. Feelings count too: your five most recent moments that carry a feeling can move the score up to 4 points either way (Great +4, Rough -4, mixed ones in between). That shares the same 10 point cap as follow-ups and contact history.

## Green and red flags

On a profile, the flags you have are shown as chips (tap the × to remove one). The fixed list of built-in flags sits behind "Choose from the flag list", so it no longer takes over the screen. To add your own, type it under "Add your own flag" and tap Add as green flag or Add as red flag (up to 20 per person, 40 characters each; the same words can exist in both colours).

Your own flags count in the Fit score exactly like the built-in ones: red lowers it, green raises it, and the effect is capped so flags alone cannot swing a call. Your keywords on the Fit tab can also match them (for example a would-rather-not word "texts ex" matches your flag "Still texts ex"). On the People list, each card shows up to two green and two red chips plus a "+3 more (4 green, 3 red)" summary. Insights counts your own flags in Most common tags.

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
3. The app is now called Date-a-Dex, but a Home Screen icon keeps the name it was installed with. An existing icon will still say Roster until you delete it and re-add it from Safari (or Chrome). Your data is saved under the same key, so it carries over as long as you use the same URL; export a backup first from Insights to be safe.
4. If it still looks old: iPhone, delete the Home Screen icon and re-add it from Safari (your data is stored per site and survives this only if you use the same URL, so export a backup first from Insights). Android, long-press the icon, App info, Storage, Clear cache.

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

## The look, photos, and drafts

**People screen.** A soft journal look: a greeting, a this-week strip, a Quick log card, and large photo-forward cards with a black stage pill, a white "we talked today" circle, and a cream name card. A switch in the sort row toggles large cards or a compact two-column grid, and your choice is remembered. Turn the greeting and week strip off in Settings, under Home screen. The week strip only checks off days you logged something; it never counts streaks or missed days.

**Photos (optional).** Add one from a profile with the camera button. It is shrunk on your device to a small JPEG and stored with your other data; nothing is uploaded. Turn "Photos on cards" off in Settings if others might see your screen (photos are kept and still show on profiles). If the browser's storage fills up, an alert appears instead of failing silently.

**Profiles.** An at-a-glance summary (next plan, last interaction, worth remembering), quick actions, and a sticky section bar that jumps to About, Plans, Reflections, Fit, and Timeline. Sections are collapsed except About. The Fit section shows the verdict, never a raw score.

**Forms.** The date form is grouped (The basics, My experience, Follow-up) with a Save button pinned to the bottom. Errors say what to fix and confirm nothing was lost, and are tied to their field for screen readers. Unfinished date, moment, and plan forms are saved on this device and offered back when you return (never restored without asking). Drafts expire after 7 days and can be cleared in Settings.

**Accessibility.** Dialogs move focus in, keep Tab inside, close on Escape, and return focus to where you were. Muted text was darkened to meet 4.5:1 contrast, interactive targets are at least 44px, focus rings are always visible, and all motion switches off when your device asks for reduced motion.
