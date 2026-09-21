import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Users, CalendarHeart, BarChart3, Plus, X, Mic, Square,
  Star, Trash2, Archive, ArchiveRestore, Download, Upload, Scale,
  MessageCircle, Sparkles, Heart, Flag, History, Settings as SettingsIcon, Lock, Undo2, Bell, CalendarClock
} from 'lucide-react'
import {
  useStore, uid, STATUSES, ACTIVE_STATUSES, END_REASONS, isActive, TAGS, agoLabel, daysSince, fmtDate, lastContactOf, todayDay
} from './store.js'
import { useSpeech, summarizeToBullets } from './useSpeech.js'
import { buildTimeline, dayParts } from './timeline.js'
import { buildToday, daysBetween } from './today.js'
import { activityAverages, themes, reflectionTrends, emotionSeries } from './patterns.js'
import { LOCK_CHOICES } from './settings.js'
import { hasPin, setPin, verifyPin, clearPin, waitLeft, recordFail, resetFails, PIN_RE } from './lock.js'
import { PROMPT_CATEGORIES, candidates as promptCandidates, usedPromptIds } from './prompts.js'
import { encryptBackup, decryptBackup, isEncryptedBackup, MIN_PASSPHRASE } from './vault.js'
import { plansOf, rememberOf, reflectionOf, REMEMBER_KINDS, REFLECTION_QUESTIONS, REFLECTION_ANSWERS, AGAIN_ANSWERS, MAX_PLAN_TEXT, MAX_REMEMBER_TEXT, MAX_REFLECTION_NOTE, MAX_REFLECTION_JOURNAL, momentsOf, FEELINGS, MOMENT_TYPES, MAX_MOMENT_TEXT, customFlagsOf, MAX_CUSTOM_FLAGS, MAX_FLAG_LENGTH, TRAITS, WANT_LEVELS, AVOID_LEVELS, VERDICT, SOFT_PENALTY, evaluate, hasCriteria, normalizeCriteria, splitWords, splitPlaces, wordHits } from './fit.js'
import { buildModel, adjustedWeight, MIN_FEEDBACK } from './learn.js'
import { parseDescription } from './describe.js'

const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0]
const tagOf = (id) => TAGS.find((t) => t.id === id)
const todayISO = () => todayDay()

/* ---------- small pieces ---------- */

function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-back" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Stars({ value, onChange }) {
  return (
    <div className="stars" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(n === value ? 0 : n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star size={24} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}

function StarsStatic({ value }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= value ? 'var(--amber)' : '#d8cbd0' }}>
          <Star size={14} fill={n <= value ? 'currentColor' : 'none'} />
        </span>
      ))}
    </span>
  )
}

// Every flag on a person, built-in or typed by the user, in one list of { key, label, kind, remove }.
function allFlags(person, set) {
  const built = (person.tags || [])
    .map((id) => tagOf(id))
    .filter(Boolean)
    .map((t) => ({ key: 't:' + t.id, label: t.label, kind: t.kind, remove: () => set({ tags: person.tags.filter((x) => x !== t.id) }) }))
  const custom = customFlagsOf(person).map((f) => ({
    key: 'c:' + f.id, label: f.label, kind: f.kind,
    remove: () => set({ customFlags: customFlagsOf(person).filter((x) => x.id !== f.id) })
  }))
  return [...built, ...custom]
}

// Flags are consolidated: the chosen ones show as chips, the fixed list lives in a dropdown, and you can add your own.
function FlagEditor({ person, set }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const flags = allFlags(person, set)
  const custom = customFlagsOf(person)
  const toggle = (id) =>
    set({ tags: person.tags.includes(id) ? person.tags.filter((x) => x !== id) : [...person.tags, id] })

  const add = (kind) => {
    const label = text.trim().replace(/\s+/g, ' ').slice(0, MAX_FLAG_LENGTH)
    if (!label) return setMsg('Type the flag first.')
    if (custom.length >= MAX_CUSTOM_FLAGS) return setMsg(`You can add up to ${MAX_CUSTOM_FLAGS} of your own flags per person.`)
    if (custom.some((f) => f.label.toLowerCase() === label.toLowerCase() && f.kind === kind)) return setMsg('You already added that one.')
    set({ customFlags: [...custom, { id: uid(), label, kind }] })
    setText('')
    setMsg('')
  }

  const nBuilt = person.tags.length
  return (
    <div className="flagbar">
      {flags.length === 0 ? (
        <p className="hint" style={{ margin: '0 0 8px' }}>No flags yet.</p>
      ) : (
        <div className="mini" style={{ marginBottom: 8 }} aria-label="Current flags">
          {flags.map((f) => (
            <span key={f.key} className={'tag ' + f.kind}>
              {f.label}
              <button type="button" className="x" aria-label={`Remove flag ${f.label}`} onClick={f.remove}>×</button>
            </span>
          ))}
        </div>
      )}

      <button type="button" className="btn ghost" style={{ padding: '8px 12px' }} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide the flag list' : `Choose from the flag list${nBuilt ? ` (${nBuilt} selected)` : ''}`}
      </button>
      {open && (
        <div className="tagpick" style={{ marginTop: 10 }} role="group" aria-label="Built-in flags">
          {TAGS.map((t) => (
            <button key={t.id} type="button" className={t.kind} aria-pressed={person.tags.includes(t.id)} onClick={() => toggle(t.id)}>
              {t.kind === 'green' ? 'Green: ' : 'Red: '}
              {t.label}
            </button>
          ))}
        </div>
      )}

      <label className="field" style={{ marginTop: 12 }}>
        <span>Add your own flag</span>
        <input
          className="in"
          placeholder="Great with my daughter, still texts ex"
          maxLength={MAX_FLAG_LENGTH}
          value={text}
          onChange={(e) => { setText(e.target.value); setMsg('') }}
        />
      </label>
      <div className="btnrow" style={{ marginTop: 6 }}>
        <button type="button" className="btn ghost" onClick={() => add('green')}>Add as green flag</button>
        <button type="button" className="btn ghost" onClick={() => add('red')}>Add as red flag</button>
      </div>
      {msg && <div className="warn" role="status">{msg}</div>}
      <p className="hint" style={{ margin: '6px 0 0' }}>
        Flags you add count in the Fit score like the built-in ones: red lowers it, green raises it. Your own words in
        Fit can also match them.
      </p>
    </div>
  )
}

function VoiceBox({ onBullets }) {
  const [text, setText] = useState('')
  const { listening, interim, error, start, stop, supported } = useSpeech(
    (t) => setText((prev) => (prev ? prev + ' ' : '') + t)
  )

  const summarize = () => {
    const b = summarizeToBullets(text)
    if (b.length) {
      onBullets(b)
      setText('')
    }
  }

  return (
    <div>
      <span className="lbl">Voice or typed thoughts</span>
      <div className="mic">
        {supported ? (
          <button
            type="button"
            className={'btn rose ' + (listening ? 'pulse' : '')}
            onClick={listening ? stop : start}
          >
            {listening ? <Square size={18} /> : <Mic size={18} />}
            {listening ? 'Stop' : 'Record'}
          </button>
        ) : (
          <span className="hint">
            Voice input is not supported in this browser. Type instead, or use Chrome or Safari.
          </span>
        )}
      </div>
      {listening && <div className="live">{interim || 'Listening…'}</div>}
      {error && <div className="warn">{error}</div>}
      <textarea
        className="in"
        style={{ marginTop: 10 }}
        placeholder="Say or type how it went. Long ramble is fine."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="btn ghost"
        style={{ marginTop: 8 }}
        disabled={!text.trim()}
        onClick={summarize}
      >
        Turn into bullet points
      </button>
    </div>
  )
}

/* ---------- person sheets ---------- */

function QuickAdd({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [met, setMet] = useState('')
  const [status, setStatus] = useState('talking')
  const ref = useRef(null)

  const save = () => {
    if (!name.trim()) {
      ref.current?.focus()
      return
    }
    onSave({ name: name.trim(), met: met.trim(), status })
  }

  return (
    <Sheet title="New match" onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input
          ref={ref}
          className="in"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </label>
      <label className="field">
        <span>How you met</span>
        <input
          className="in"
          value={met}
          placeholder="Hinge, a friend, the gym…"
          onChange={(e) => setMet(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </label>
      <span className="lbl">Where things stand</span>
      <div className="tagpick" style={{ marginBottom: 6 }}>
        {ACTIVE_STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="green"
            aria-pressed={status === s.id}
            onClick={() => setStatus(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="hint" style={{ margin: '0 0 18px' }}>
        {ACTIVE_STATUSES.find((s) => s.id === status)?.hint}
      </p>
      <button className="btn primary" onClick={save}>Add to Date-a-Dex</button>
    </Sheet>
  )
}


/* ---------- timeline ---------- */

const KIND_ICON = { date: CalendarHeart, contact: MessageCircle, moment: Sparkles, matched: Heart, ended: Flag, plan: CalendarClock }
const KIND_LABEL = { date: 'Date', contact: 'In touch', matched: 'Matched', ended: 'Let go', plan: 'Planned' }
const FEEL_LABEL = Object.fromEntries(FEELINGS.map((f) => [f.id, f.label]))
const FEEL_CLASS = { great: 'green', good: 'green', okay: 'plain', uneasy: 'amber', rough: 'red' }

// One chronological story: badge with the day on the left, a card on the right.
function TimelineList({ entries, showPerson, onOpenPerson, onOpenDate, onDelete, onEdit, empty }) {
  if (entries.length === 0) return <p className="hint" style={{ margin: '8px 0' }}>{empty}</p>
  let lastGroup = null
  const rows = []
  for (const e of entries) {
    const parts = dayParts(e.date)
    if (parts.group !== lastGroup) {
      lastGroup = parts.group
      rows.push(<li key={'g:' + parts.group} className="story-month">{parts.group}</li>)
    }
    const Icon = KIND_ICON[e.kind]
    const chip = e.kind === 'moment' ? e.title : KIND_LABEL[e.kind]
    const heading = (e.kind === 'date' && e.title !== 'Date') || e.kind === 'plan' ? e.title : ''
    rows.push(
      <li key={e.key} className="story-item">
        <div className="story-badge" aria-hidden="true">
          {parts.day ? (<><span>{parts.month}</span><b>{parts.day}</b><span>{parts.year}</span></>) : <span>No date</span>}
        </div>
        <div className={'story-card k-' + e.kind}>
          <div className="story-top">
            <span className="story-type"><Icon size={14} aria-hidden="true" /> {chip}</span>
            {showPerson && (
              <button type="button" className="story-person" onClick={() => onOpenPerson(e.personId)}>
                {e.personName}{e.archived ? ' (archived)' : ''}
              </button>
            )}
            {e.kind === 'plan' && <span className={'tag ' + (daysBetween(todayDay(), e.date) < 0 ? 'amber' : 'green')}>{daysLabel(daysBetween(todayDay(), e.date))}</span>}
            {e.rating > 0 && (
              <span className="story-stars" role="img" aria-label={`Rated ${e.rating} of 5`}>{'★'.repeat(e.rating)}{'☆'.repeat(5 - e.rating)}</span>
            )}
            {e.deletable && (
              <button type="button" className="icon-btn story-x"
                aria-label={e.kind === 'moment' ? `Delete moment on ${fmtDate(e.date)}` : e.kind === 'plan' ? `Delete plan on ${fmtDate(e.date)}` : `Delete contact on ${fmtDate(e.date)}`}
                onClick={() => onDelete(e)}>
                <X size={16} />
              </button>
            )}
          </div>
          {heading && <div className="story-title">{heading}</div>}
          {e.text && <p className="story-text">{e.text}</p>}
          {e.bullets?.length > 0 && <ul className="story-bullets">{e.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          {(e.feeling || e.followUp || e.reflection?.length > 0) && (
            <div className="mini" style={{ marginTop: 6 }}>
              {e.feeling && <span className={'tag ' + FEEL_CLASS[e.feeling]}>Felt {FEEL_LABEL[e.feeling]}</span>}
              {e.followUp && <span className="tag">{e.followUp}</span>}
              {(e.reflection || []).map((c) => <span key={c} className="tag plain">{c}</span>)}
            </div>
          )}
          {e.kind === 'moment' && onEdit && (
            <button type="button" className="btn ghost story-open" onClick={() => onEdit(e)}>Edit</button>
          )}
          {e.kind === 'date' && (
            <button type="button" className="btn ghost story-open" onClick={() => onOpenDate(e.refId)}>Open date log</button>
          )}
        </div>
      </li>
    )
  }
  return <ol className="story" aria-label="Timeline">{rows}</ol>
}

// Add something that is not a date or a contact: a conversation, a plan, a milestone, or how you felt.
function AddMoment({ onAdd, onCancel, initial = null }) {
  const [type, setType] = useState(initial?.momentType || 'conversation')
  const [day, setDay] = useState(initial?.date || todayDay())
  const [text, setText] = useState(initial?.text || '')
  const [feeling, setFeeling] = useState(initial?.feeling || '')
  const [msg, setMsg] = useState('')
  const speech = useSpeech((t) => setText((cur) => (cur ? cur + ' ' : '') + t))

  const save = () => {
    if (!day) return setMsg('Pick the day.')
    if (!text.trim() && !feeling) return setMsg('Write something, or pick how it felt.')
    onAdd({ date: day, type, text: text.trim().slice(0, MAX_MOMENT_TEXT), feeling: feeling || null })
  }

  return (
    <div className="stat" style={{ marginTop: 10 }}>
      <h4>{initial ? 'Edit moment' : 'Add a moment'}</h4>
      <div className="tagpick" role="group" aria-label="Kind of moment">
        {MOMENT_TYPES.map((t) => (
          <button key={t.id} type="button" className="plain" aria-pressed={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 10 }}>
        <span>When</span>
        <input className="in" type="date" value={day} max={todayDay()} onChange={(e) => setDay(e.target.value)} />
      </label>
      <label className="field">
        <span>What happened, or what you want to remember</span>
        <textarea className="in" maxLength={MAX_MOMENT_TEXT} value={text} placeholder="They told me about their sister. We planned a hike."
          onChange={(e) => { setText(e.target.value); setMsg('') }} />
      </label>
      {speech.supported && (
        <button type="button" className={'btn rose ' + (speech.listening ? 'pulse' : '')} onClick={speech.listening ? speech.stop : speech.start}>
          {speech.listening ? <Square size={18} /> : <Mic size={18} />}
          {speech.listening ? 'Stop' : 'Speak it'}
        </button>
      )}
      {speech.listening && <div className="live">{speech.interim || 'Listening…'}</div>}
      {speech.error && <div className="warn">{speech.error}</div>}
      <span className="lbl" style={{ marginTop: 12 }}>How did it feel? (optional)</span>
      <div className="tagpick" role="group" aria-label="How it felt">
        {FEELINGS.map((f) => (
          <button key={f.id} type="button" className={FEEL_CLASS[f.id]} aria-pressed={feeling === f.id}
            onClick={() => { setFeeling(feeling === f.id ? '' : f.id); setMsg('') }}>{f.label}</button>
        ))}
      </div>
      <p className="hint" style={{ margin: '6px 0 0' }}>
        Feelings count in Fit: your last five, up to 4 points either way, shared with the other profile signals under a 10 point cap.
      </p>
      {msg && <div className="warn" role="status">{msg}</div>}
      <div className="btnrow">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn primary" onClick={save}>{initial ? 'Save changes' : 'Save moment'}</button>
      </div>
    </div>
  )
}

function ContactLog({ person, dates, store }) {
  const [day, setDay] = useState(todayDay())
  const [note, setNote] = useState('')
  const last = lastContactOf(person, dates)
  const talkedToday = (person.contacts || []).some((c) => c.date === todayDay() && !/^matched$/i.test((c.note || '').trim()))

  const add = () => {
    if (!day) return
    store.addContact(person.id, day, note)
    setNote('')
    setDay(todayDay())
  }

  return (
    <div>
      <p className="hint" style={{ margin: '0 0 10px' }}>
        Last contact: {last ? `${agoLabel(last)} (${fmtDate(last)})` : 'none recorded'}. Logged dates count too.
      </p>
      <button type="button" className="btn ghost" style={{ width: '100%', marginBottom: 12 }}
        disabled={talkedToday} onClick={() => store.addContact(person.id, todayDay(), '')}>
        {talkedToday ? 'Talked today ✓' : 'We talked today'}
      </button>

      <div className="two" style={{ alignItems: 'end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Another day</span>
          <input className="in" type="date" value={day} max={todayDay()} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Note (optional)</span>
          <input className="in" value={note} placeholder="Called, texted…" onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
        </label>
      </div>
      <button type="button" className="btn ghost" style={{ marginTop: 10, width: '100%' }} onClick={add} disabled={!day}>
        <Plus size={18} /> Add contact on this date
      </button>
    </div>
  )
}


function StatusPicker({ person, store }) {
  const [ending, setEnding] = useState(false)
  const [reason, setReason] = useState(person.end?.reason || '')
  const [note, setNote] = useState(person.end?.note || '')
  const [when, setWhen] = useState(person.end?.date || todayDay())
  const ended = person.status === 'ended'

  const pick = (s) => {
    if (s.id === 'ended') {
      setEnding(true)
      return
    }
    setEnding(false)
    store.setStatus(person.id, s.id) // also clears any end reason
  }

  const confirmEnd = () => {
    store.setStatus(person.id, 'ended', { reason, note, date: when })
    setEnding(false)
  }

  const current = STATUSES.find((s) => s.id === person.status)

  return (
    <div style={{ marginBottom: 16 }}>
      <span className="lbl">Where things stand</span>
      <div className="tagpick">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === 'ended' ? 'red' : 'green'}
            aria-pressed={person.status === s.id || (ending && s.id === 'ended')}
            onClick={() => pick(s)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {current && !ending && <p className="hint" style={{ margin: '8px 0 0' }}>{current.hint}</p>}

      {ended && !ending && (
        <div className="adj" style={{ marginTop: 10 }}>
          <strong>Ended {fmtDate(person.end?.date)}</strong>
          <div>{END_REASONS.find((r) => r.id === person.end?.reason)?.label || 'No reason given'}</div>
          {person.end?.note && <div style={{ marginTop: 4 }}>{person.end.note}</div>}
          <button type="button" className="btn ghost" style={{ marginTop: 8, padding: '8px 12px' }}
            onClick={() => { setReason(person.end?.reason || ''); setNote(person.end?.note || ''); setWhen(person.end?.date || todayDay()); setEnding(true) }}>
            Edit why
          </button>
          <p className="hint" style={{ margin: '8px 0 0' }}>
            To reopen this, pick a stage above. The reason is cleared when you do.
          </p>
        </div>
      )}

      {ending && (
        <div className="stat" style={{ marginTop: 12 }} role="group" aria-label="Why did it end">
          <h4>Let go of {person.name || 'this person'}?</h4>
          <p className="hint" style={{ marginTop: 0 }}>
            They will move out of your active list and the Fit tab. Their dates stay and still help the app learn
            what you like.
          </p>
          <span className="lbl">Why it ended (optional)</span>
          <div className="tagpick" style={{ marginBottom: 12 }}>
            {END_REASONS.map((r) => (
              <button key={r.id} type="button" className="red" aria-pressed={reason === r.id}
                onClick={() => setReason(reason === r.id ? '' : r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>When</span>
            <input className="in" type="date" value={when} max={todayDay()} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="field">
            <span>Note (optional)</span>
            <textarea className="in" style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Anything worth remembering for next time" />
          </label>
          <div className="btnrow">
            <button className="btn ghost" onClick={() => setEnding(false)}>Cancel</button>
            <button className="btn primary" onClick={confirmEnd}>
              {ended ? 'Save changes' : 'Mark as ended'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PersonSheet({ person, dates, store, onClose, onLogDate, onEditDate }) {
  const [adding, setAdding] = useState(false)
  const [editMoment, setEditMoment] = useState(null)
  const show = store.data.settings.profile
  const set = (patch) => store.updatePerson(person.id, patch)
  const mine = dates.filter((d) => d.personId === person.id)

  const remove = () => {
    if (confirm(`Delete ${person.name} and all their date records? This cannot be undone.`)) {
      store.deletePerson(person.id)
      onClose()
    }
  }

  return (
    <Sheet title={person.name || 'Profile'} onClose={onClose}>
      <StatusPicker key={person.id + ':' + person.status} person={person} store={store} />

      <label className="field">
        <span>Name</span>
        <input className="in" value={person.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <div className="two">
        <label className="field">
          <span>Age</span>
          <input className="in" inputMode="numeric" value={person.age} onChange={(e) => set({ age: e.target.value })} />
        </label>
        <label className="field">
          <span>Location</span>
          <input className="in" value={person.location} onChange={(e) => set({ location: e.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>Occupation</span>
        <input className="in" value={person.job} onChange={(e) => set({ job: e.target.value })} />
      </label>
      <label className="field">
        <span>How you met</span>
        <input className="in" value={person.met} onChange={(e) => set({ met: e.target.value })} />
      </label>

      {show.flags && (
        <>
          <div className="section">Green and red flags</div>
          <FlagEditor person={person} set={set} />
        </>
      )}

      {show.plans && (
        <>
          <div className="section">Plan a date</div>
          <PlanSection person={person} store={store} onLogDate={onLogDate} />
        </>
      )}

      {show.remember && (
        <>
          <div className="section">Remember for next time</div>
          <RememberSection person={person} store={store} />
        </>
      )}
      {show.prompts && <PromptSection person={person} dates={dates} store={store} />}

      {show.timeline && (
        <>
      <div className="section">Timeline</div>
      <ContactLog person={person} dates={dates} store={store} />
      {adding || editMoment ? (
        <AddMoment
          key={editMoment?.refId || 'new'}
          initial={editMoment}
          onCancel={() => { setAdding(false); setEditMoment(null) }}
          onAdd={(m) => {
            if (editMoment) store.updateMoment(person.id, editMoment.refId, m)
            else store.addMoment(person.id, m)
            setAdding(false); setEditMoment(null)
          }}
        />
      ) : (
        <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => setAdding(true)}>
          <Sparkles size={18} /> Add a moment
        </button>
      )}
      <div style={{ marginTop: 14 }}>
        <TimelineList
          entries={buildTimeline([person], dates, { personId: person.id, endReasons: END_REASONS })}
          empty="Nothing here yet. Log a date, a contact, or a moment and it will appear in order."
          onEdit={(e) => { setEditMoment(e); setAdding(false) }}
          onOpenDate={(id) => { const d = dates.find((x) => x.id === id); if (d) onEditDate(d) }}
          onDelete={(e) => {
            if (e.kind === 'moment') store.deleteMoment(person.id, e.refId)
            else if (e.kind === 'plan') store.deletePlan(person.id, e.refId)
            else store.deleteContact(person.id, e.refId)
          }}
        />
      </div>
        </>
      )}

      <div className="btnrow" style={{ marginTop: 12 }}>
        <button className="btn rose" onClick={onLogDate}>
          <CalendarHeart size={18} /> Log a date
        </button>
      </div>

      {mine.length > 0 && (
        <p className="hint" style={{ marginTop: 12 }}>
          {mine.length} date{mine.length > 1 ? 's' : ''} logged with {person.name}.
        </p>
      )}

      <div className="btnrow" style={{ marginTop: 22 }}>
        <button
          className="btn ghost"
          onClick={() => {
            set({ archived: !person.archived })
            onClose()
          }}
        >
          {person.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
          {person.archived ? 'Restore' : 'Archive'}
        </button>
        <button className="btn danger" onClick={remove}><Trash2 size={18} /> Delete</button>
      </div>
    </Sheet>
  )
}

/* ---------- date sheet ---------- */

function DateSheet({ people, initial, defaultPersonId, store, onClose, onCheckin, openReflection = false }) {
  const editing = Boolean(initial)
  const [personId, setPersonId] = useState(initial?.personId || defaultPersonId || people[0]?.id || '')
  const [date, setDate] = useState(initial?.date || todayISO())
  const [activity, setActivity] = useState(initial?.activity || '')
  const [rating, setRating] = useState(initial?.rating || 0)
  const [followUp, setFollowUp] = useState(initial?.followUp || 'none')
  const [impressions, setImpressions] = useState(initial?.impressions || [])
  const [refl, setRefl] = useState(() => reflectionOf(initial) || {})
  const [showRefl, setShowRefl] = useState(Boolean(openReflection || reflectionOf(initial)))

  const save = () => {
    if (!personId) return
    const payload = { personId, date, activity: activity.trim(), rating, followUp, impressions, reflection: reflectionOf({ reflection: refl }) }
    if (editing) {
      store.updateDate(initial.id, payload)
      onClose()
    } else {
      const newId = store.addDate(payload)
      if (onCheckin && rating > 0) onCheckin(personId, newId)
      else onClose()
    }
  }

  const remove = () => {
    if (confirm('Delete this date record?')) {
      store.deleteDate(initial.id)
      onClose()
    }
  }

  if (people.length === 0) {
    return (
      <Sheet title="Log a date" onClose={onClose}>
        <div className="empty">
          <h3>Add someone first</h3>
          <p>Dates are linked to people in Date-a-Dex.</p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={editing ? 'Edit date' : 'Log a date'} onClose={onClose}>
      <label className="field">
        <span>Who</span>
        <select className="in" value={personId} onChange={(e) => setPersonId(e.target.value)}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{(p.name || 'Unnamed') + (p.status === 'ended' ? ' (let go)' : '')}</option>
          ))}
        </select>
      </label>
      <div className="two">
        <label className="field">
          <span>Date</span>
          <input className="in" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Activity</span>
          <input className="in" value={activity} placeholder="Coffee, dinner…" onChange={(e) => setActivity(e.target.value)} />
        </label>
      </div>
      <span className="lbl">Rating</span>
      <Stars value={rating} onChange={setRating} />
      <label className="field" style={{ marginTop: 14 }}>
        <span>Follow-up</span>
        <select className="in" value={followUp} onChange={(e) => setFollowUp(e.target.value)}>
          <option value="none">Nothing yet</option>
          <option value="me">I need to text them</option>
          <option value="them">Waiting on them</option>
          <option value="planned">Next date planned</option>
          <option value="done">Not continuing</option>
        </select>
      </label>

      <VoiceBox onBullets={(b) => setImpressions((prev) => [...prev, ...b])} />

      {impressions.length > 0 && (
        <>
          <div className="section">Impressions</div>
          <ul className="notes">
            {impressions.map((n, i) => (
              <li key={i}>
                <span>{n}</span>
                <button
                  className="icon-btn"
                  aria-label="Remove impression"
                  onClick={() => setImpressions(impressions.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {showRefl ? (
        <ReflectionForm value={refl} onChange={setRefl} />
      ) : (
        <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => setShowRefl(true)}>
          <Sparkles size={18} /> Reflect on this date (optional)
        </button>
      )}

      <div className="btnrow" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={save}>{editing ? 'Save changes' : 'Save date'}</button>
      </div>
      {editing && (
        <div className="btnrow">
          <button className="btn danger" onClick={remove}><Trash2 size={18} /> Delete date</button>
        </div>
      )}
    </Sheet>
  )
}


/* ---------- check-in ---------- */

function CheckinSheet({ person, dateRec, onSave, onClose }) {
  const [valued, setValued] = useState([])
  const [missing, setMissing] = useState([])
  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  return (
    <Sheet title="Quick check-in" onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>
        Two taps help the app learn what actually matters to you. Skip anything that does not apply.
      </p>
      <span className="lbl">What did you enjoy about {person.name || 'them'}?</span>
      <div className="tagpick" style={{ marginBottom: 16 }}>
        {TRAITS.map((t) => (
          <button key={t.id} type="button" className="green" aria-pressed={valued.includes(t.id)}
            onClick={() => toggle(valued, setValued, t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <span className="lbl">What was missing?</span>
      <div className="tagpick" style={{ marginBottom: 18 }}>
        {TRAITS.map((t) => (
          <button key={t.id} type="button" className="red" aria-pressed={missing.includes(t.id)}
            onClick={() => toggle(missing, setMissing, t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="btnrow">
        <button className="btn ghost" onClick={onClose}>Skip</button>
        <button className="btn primary" onClick={() => onSave({ personId: person.id, dateId: dateRec?.id, valued, missing })}>
          Save check-in
        </button>
      </div>
    </Sheet>
  )
}

/* ---------- tabs ---------- */

const FOLLOW_LABEL = {
  none: 'No follow-up yet',
  me: 'You need to text them',
  them: 'Waiting on them',
  planned: 'Next date planned',
  done: 'Not continuing'
}

function PersonCard({ p, dates, onOpen, card = { details: true, notes: true, flags: true, contact: true } }) {
  const s = statusOf(p.status)
  const ended = p.status === 'ended'
  const lc = lastContactOf(p, dates)
  const d = daysSince(lc)
  // Never nag about replying to someone you have let go.
  const due = !ended && d !== null && d >= 3
  const details = [p.age && `${p.age}`, p.job, p.location, p.met && `via ${p.met}`].filter(Boolean).join(', ')
  const reason = END_REASONS.find((r) => r.id === p.end?.reason)?.label
  return (
    <button className="person" style={{ '--edge': s.color }} onClick={() => onOpen(p.id)}>
      <div className="row">
        <h3>{p.name || 'Unnamed'}</h3>
        <span className="status">{s.label}</span>
      </div>
      {card.details && <div className="meta">{details || 'No details yet'}</div>}
      {ended && (
        <div className="reply" style={{ color: 'var(--ink)' }}>
          Ended {fmtDate(p.end?.date)}{reason ? `: ${reason}` : ''}
        </div>
      )}
      {card.notes && rememberOf(p).filter((r) => !r.done).length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14 }}>
          {rememberOf(p).filter((r) => !r.done).slice(0, 2).map((r) => <li key={r.id}>{r.text}</li>)}
          {rememberOf(p).filter((r) => !r.done).length > 2 && <li className="hint">+{rememberOf(p).filter((r) => !r.done).length - 2} more</li>}
        </ul>
      )}
      {(() => {
        const all = allFlags(p, () => {})
        if (!card.flags || all.length === 0) return null
        const g = all.filter((f) => f.kind === 'green')
        const r = all.filter((f) => f.kind === 'red')
        const shown = [...g.slice(0, 2), ...r.slice(0, 2)]
        const hidden = all.length - shown.length
        return (
          <div className="mini">
            {shown.map((f) => <span key={f.key} className={'tag ' + f.kind}>{f.label}</span>)}
            {hidden > 0 && <span className="tag">+{hidden} more ({g.length} green, {r.length} red)</span>}
          </div>
        )
      })()}
      {card.contact && (
        <div className={'reply' + (due ? ' due' : '')}>
          {lc ? `Last contact ${agoLabel(lc)}` : 'No contact recorded'}
          {due ? ', maybe reply?' : ''}
        </div>
      )}
    </button>
  )
}

function People({ people, dates, onOpen, store, onLogDate }) {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('contact')
  const [q, setQ] = useState('')

  const query = q.trim().toLowerCase()

  const { list, ended, archived, endedTotal } = useMemo(() => {
    const matches = (p) =>
      !query || [p.name, p.job, p.met, p.location, ...rememberOf(p).map((r) => r.text)].join(' ').toLowerCase().includes(query)

    let active = people.filter((p) => isActive(p) && matches(p))
    if (sort === 'contact') {
      // people with NO recorded contact sort first: they are the ones most likely to need attention
      active = [...active].sort((a, b) => (lastContactOf(a, dates) || '').localeCompare(lastContactOf(b, dates) || ''))
    } else if (sort === 'name') {
      active = [...active].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    } else {
      active = [...active].sort((a, b) => new Date(b.created) - new Date(a.created))
    }

    // Most recently ended first.
    const endedList = people
      .filter((p) => p.status === 'ended' && !p.archived && matches(p))
      .sort((a, b) => (b.end?.date || '').localeCompare(a.end?.date || ''))
    const archivedList = people.filter((p) => p.archived && matches(p))
    const endedTotal = people.filter((p) => p.status === 'ended' && !p.archived).length

    if (filter === 'ended') return { list: endedList, ended: [], archived: [], endedTotal }
    if (filter !== 'all') {
      return { list: active.filter((p) => p.status === filter), ended: [], archived: [], endedTotal }
    }
    return { list: active, ended: endedList, archived: archivedList, endedTotal }
  }, [people, dates, filter, sort, query])

  const totalActive = people.filter(isActive).length

  return (
    <>
      <ReminderBanner data={store.data} onOpenPerson={onOpen} />
      {people.some(isActive) && <QuickLog people={people.filter(isActive)} store={store} onLogDate={onLogDate} />}
      <input
        className="in"
        placeholder="Search names, jobs, details"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search people"
        style={{ marginBottom: 12 }}
      />
      <div className="filters" role="group" aria-label="Filter by status">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
        {ACTIVE_STATUSES.map((s) => (
          <button key={s.id} className="chip" aria-pressed={filter === s.id} onClick={() => setFilter(s.id)}>
            {s.label}
          </button>
        ))}
        <button className="chip" aria-pressed={filter === 'ended'} onClick={() => setFilter('ended')}>
          Let go{endedTotal > 0 ? ` (${endedTotal})` : ''}
        </button>
      </div>
      {filter !== 'ended' && (
        <div className="sortrow">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort order">
            <option value="contact">Longest since contact</option>
            <option value="recent">Newest match</option>
            <option value="name">Name</option>
          </select>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <h3>
            {filter === 'ended'
              ? query ? 'No one matches your search' : 'No one has ended yet'
              : totalActive === 0 && !query
                ? 'No one yet'
                : query
                  ? 'No one matches your search'
                  : 'No one matches this filter'}
          </h3>
          <p>
            {filter === 'ended'
              ? 'People you mark as let go or broke up with show up here.'
              : totalActive === 0 && !query
                ? 'Tap Add match to log someone in under ten seconds.'
                : 'Try clearing the search or filter.'}
          </p>
        </div>
      ) : (
        list.map((p) => <PersonCard key={p.id} p={p} dates={dates} onOpen={onOpen} card={store.data.settings.card} />)
      )}

      {ended.length > 0 && (
        <>
          <div className="section">Let go / ended</div>
          {ended.map((p) => <PersonCard key={p.id} p={p} dates={dates} onOpen={onOpen} card={store.data.settings.card} />)}
        </>
      )}

      {archived.length > 0 && (
        <>
          <div className="section">Archived</div>
          {archived.map((p) => (
            <div key={p.id} className="person" style={{ '--edge': 'var(--line)' }}>
              <div className="row" style={{ alignItems: 'center' }}>
                <button style={{ textAlign: 'left', flex: 1 }} onClick={() => onOpen(p.id)}>
                  <h3>{p.name || 'Unnamed'}</h3>
                </button>
                <button className="btn ghost" onClick={() => store.updatePerson(p.id, { archived: false })}>
                  <ArchiveRestore size={16} /> Restore
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  )
}

function DateLog({ people, dates, onEdit, onReflect }) {
  const sorted = [...dates].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const nameOf = (id) => people.find((p) => p.id === id)?.name || 'Deleted profile'

  if (sorted.length === 0) {
    return (
      <div className="empty">
        <h3>No dates logged</h3>
        <p>After a date, tap Log date and talk through how it went.</p>
      </div>
    )
  }

  return (
    <>
    <UnfinishedReflections people={people} dates={dates} onReflect={onReflect} />
    <div className="timeline">
      {sorted.map((d) => (
        <button key={d.id} className="tl" onClick={() => onEdit(d)}>
          <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h4>{nameOf(d.personId)}</h4>
            <StarsStatic value={d.rating || 0} />
          </div>
          <div className="meta">
            {fmtDate(d.date)}{d.activity ? `, ${d.activity}` : ''}, {FOLLOW_LABEL[d.followUp || "none"]}
          </div>
          {d.impressions?.length > 0 && (
            <ul>{d.impressions.map((n, i) => <li key={i}>{n}</li>)}</ul>
          )}
        </button>
      ))}
    </div>
    </>
  )
}

function Insights({ data, store }) {
  const { people, dates } = data
  const fileRef = useRef(null)
  const [toast, setToast] = useState('')

  const flash = (m) => {
    setToast(m)
    setTimeout(() => setToast(''), 2500)
  }

  const rated = dates.filter((d) => d.rating > 0)
  const avg = rated.length ? (rated.reduce((s, d) => s + d.rating, 0) / rated.length).toFixed(1) : null

  const count = (arr) => {
    const m = {}
    arr.forEach((k) => { if (k) m[k] = (m[k] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }
  const endedPeople = people.filter((p) => p.status === 'ended')
  const endReasons = count(endedPeople.map((p) => p.end?.reason).filter((r) => r && r !== ''))
  const noReason = endedPeople.filter((p) => !p.end?.reason).length
  const meets = count(people.map((p) => (p.met || '').trim().toLowerCase()))
  const tagCounts = count(people.flatMap((p) => [...(p.tags || []), ...customFlagsOf(p).map((f) => `c:${f.kind}:${f.label.toLowerCase()}`)]))
  const flagInfo = (k) => {
    if (k.startsWith('c:')) {
      const [, kind, ...rest] = k.split(':')
      return { label: rest.join(':'), kind }
    }
    return tagOf(k) || { label: k, kind: 'green' }
  }
  const maxMeet = meets[0]?.[1] || 1
  const maxTag = tagCounts[0]?.[1] || 1

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `date-a-dex-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('Backup downloaded')
  }

  const importData = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        if (isEncryptedBackup(parsed)) { flash('This backup is encrypted. Restore it from Settings.'); return }
        if (!Array.isArray(parsed.people) || !Array.isArray(parsed.dates)) throw new Error('bad')
        if (confirm('Replace everything on this device with this backup?')) {
          store.replaceAll(parsed)
          flash('Backup restored')
        }
      } catch {
        flash('That file is not a valid backup')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <>
      <div className="stat">
        <h4>Overview</h4>
        <div className="two">
          <div><div className="bignum">{people.filter(isActive).length}</div><div className="hint">active people</div></div>
          <div><div className="bignum">{dates.length}</div><div className="hint">dates logged</div></div>
        </div>
        {endedPeople.length > 0 && (
          <p className="hint" style={{ margin: '10px 0 0' }}>
            {endedPeople.length} let go. Their dates still count in your averages and in what the app learns.
          </p>
        )}
      </div>

      {endedPeople.length > 0 && (
        <div className="stat">
          <h4>Why things ended</h4>
          {endReasons.map(([id, n]) => (
            <div className="bar" key={id}>
              <span>{END_REASONS.find((r) => r.id === id)?.label || id}</span>
              <div className="track"><div className="fill" style={{ width: `${(n / endReasons[0][1]) * 100}%` }} /></div>
              <span>{n}</span>
            </div>
          ))}
          {noReason > 0 && (
            <p className="hint" style={{ margin: '8px 0 0' }}>{noReason} with no reason recorded.</p>
          )}
          {endReasons.length > 0 && endedPeople.length - noReason < 3 && (
            <p className="hint" style={{ margin: '8px 0 0' }}>
              Only {endedPeople.length - noReason} reason{endedPeople.length - noReason === 1 ? '' : 's'} so far, so
              treat this as a hint, not a pattern.
            </p>
          )}
        </div>
      )}

      <div className="stat">
        <h4>Average date rating</h4>
        {avg ? (
          <div className="bignum">{avg}<span className="hint"> out of 5, from {rated.length} rated</span></div>
        ) : (
          <p className="hint" style={{ margin: 0 }}>Rate a few dates to see your average.</p>
        )}
      </div>

      <div className="stat">
        <h4>Where you meet people</h4>
        {meets.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>Fill in "How you met" on profiles to see patterns.</p>
        ) : meets.map(([k, n]) => (
          <div className="bar" key={k}>
            <span style={{ textTransform: 'capitalize' }}>{k}</span>
            <div className="track"><div className="fill" style={{ width: `${(n / maxMeet) * 100}%` }} /></div>
            <span>{n}</span>
          </div>
        ))}
      </div>

      <PatternsCard data={data} />

      <div className="stat">
        <h4>Most common tags</h4>
        {tagCounts.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>Tag people with green and red flags to see trends.</p>
        ) : tagCounts.map(([k, n]) => (
          <div className="bar" key={k}>
            <span>{flagInfo(k).label}</span>
            <div className="track"><div className="fill" style={{ width: `${(n / maxTag) * 100}%`, background: flagInfo(k).kind === 'green' ? 'var(--sage)' : 'var(--rose)' }} /></div>
            <span>{n}</span>
          </div>
        ))}
      </div>

      <div className="stat">
        <h4>Backup</h4>
        <p className="hint" style={{ marginTop: 0 }}>
          Everything stays on this device. Clearing browser data erases it, so download a backup now and then.
        </p>
        <div className="btnrow">
          <button className="btn ghost" onClick={exportData}><Download size={18} /> Export</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}><Upload size={18} /> Import</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}



function FeedbackRow({ verdict, current, onAnswer, disabled }) {
  if (disabled) return null
  const answered = current && current.verdict === verdict
  return (
    <div className="fb" role="group" aria-label="Was this call right?">
      <span className="hint">Does this call feel right?</span>
      <button type="button" className="chip" aria-pressed={answered && current.agreed === true} onClick={() => onAnswer(true)}>
        Yes
      </button>
      <button type="button" className="chip" aria-pressed={answered && current.agreed === false} onClick={() => onAnswer(false)}>
        No
      </button>
    </div>
  )
}

function LearnedPanel({ data, model, store, learning }) {
  const { learned, gaps, feedback, threshold } = model
  const [open, setOpen] = useState(false)
  const need = Math.max(0, 4 - learned.ratedCount)
  const shown = gaps.filter((g) => g.kind !== 'confirmed')
  const confirmed = gaps.filter((g) => g.kind === 'confirmed')

  return (
    <div className="stat">
      <div className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>What I have learned about you</h4>
        <button className="btn ghost" style={{ padding: '8px 12px' }} onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <label className="switch">
            <input type="checkbox" checked={learning} onChange={(e) => store.setLearning(e.target.checked)} />
            <span>Let learning adjust my scores</span>
          </label>
          {!learning && (
            <p className="hint">Learning is off. Verdicts use only what you typed. Your history is still saved.</p>
          )}

          <p className="hint" style={{ margin: '8px 0' }}>
            Based on {learned.ratedCount} rated date{learned.ratedCount === 1 ? '' : 's'}, {feedback.total} answer
            {feedback.total === 1 ? '' : 's'} to "does this feel right", and {data.checkins.length} check-in
            {data.checkins.length === 1 ? '' : 's'}.
          </p>

          {learned.ratedCount < 4 ? (
            <p className="hint" style={{ margin: 0 }}>
              I need about {need} more rated date{need === 1 ? '' : 's'} before I can spot real patterns. Until then,
              I will not change any of your scores.
            </p>
          ) : shown.length === 0 && confirmed.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>
              No reliable pattern yet. That is normal early on. I only act when there are enough dates both with and
              without a quality to compare.
            </p>
          ) : (
            <>
              {shown.length > 0 && (
                <>
                  <div className="lbl" style={{ marginTop: 6 }}>Gaps between what you say and what your dates show</div>
                  <ul className="why">
                    {shown.map((g) => (
                      <li key={g.traitId} className="warn">{g.text}</li>
                    ))}
                  </ul>
                </>
              )}
              {confirmed.length > 0 && (
                <ul className="why">
                  {confirmed.map((g) => (
                    <li key={g.traitId} className="good">{g.text}</li>
                  ))}
                </ul>
              )}
              <p className="hint" style={{ margin: '4px 0 0' }}>
                Small samples can mislead. I limit how far any single pattern can move a score, and I never override a
                red line.
              </p>
            </>
          )}

          {threshold.shift !== 0 && learning && (
            <p className="adj" style={{ marginTop: 10 }}>{threshold.reason}</p>
          )}

          {feedback.total > 0 && (
            <p className="hint" style={{ margin: '10px 0 0' }}>
              You agreed with {feedback.agreed} of {feedback.total} call{feedback.total === 1 ? '' : 's'} (
              {Math.round(feedback.accuracy * 100)}%).
              {feedback.total < MIN_FEEDBACK ? ` I start tuning my decision bar after ${MIN_FEEDBACK} answers.` : ''}
            </p>
          )}

          {(data.feedback.length > 0 || data.checkins.length > 0) && (
            <button
              className="btn ghost"
              style={{ marginTop: 12 }}
              onClick={() => {
                if (confirm('Erase all feedback and check-ins? Your people and dates stay.')) store.resetLearning()
              }}
            >
              Reset what I learned
            </button>
          )}
        </div>
      )}
    </div>
  )
}


/* ---------- description reader ---------- */

const SOFT_PENALTY_TEXT = `${SOFT_PENALTY} points`
const WANT_PICK = Object.entries(WANT_LEVELS).map(([id, v]) => ({ id, label: v.label, cls: 'green' }))
const AVOID_PICK = Object.entries(AVOID_LEVELS).map(([id, v]) => ({ id, label: v.label, cls: id === 'redline' ? 'red' : 'amber' }))

function LevelPick({ options, value, onPick, label }) {
  return (
    <div className="tagpick" role="group" aria-label={label} style={{ margin: '6px 0 2px' }}>
      {options.map((l) => (
        <button key={l.id} type="button" className={l.cls} aria-pressed={value === l.id} onClick={() => onPick(l.id)}>
          {l.label}
        </button>
      ))}
    </div>
  )
}

function whoText(names) {
  if (names.length === 0) return null
  const shown = names.slice(0, 3).join(', ')
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown
}

// One keyword row in the review: tick box, editable text, optional level, and who it would hit right now.
function WordRow({ item, kind, people, dates, onChange }) {
  const who = whoText(wordHits(people, dates, item.text, kind))
  return (
    <div className="sug">
      <label className="switch">
        <input type="checkbox" checked={item.on} onChange={(e) => onChange({ on: e.target.checked })} aria-label={`Include ${item.text}`} />
        <input className="in" style={{ padding: '8px 10px' }} value={item.text} onChange={(e) => onChange({ text: e.target.value })}
          aria-label={kind === 'avoid' ? "Don't want keyword" : 'Want keyword'} />
      </label>
      {kind === 'avoid' && (
        <LevelPick options={AVOID_PICK} value={item.level} onPick={(level) => onChange({ level })} label="How strict" />
      )}
      <div className="hint">
        {who
          ? `Right now this ${kind === 'avoid' ? (item.level === 'redline' ? 'would put these on "Consider letting go"' : 'would lower the score of') : 'matches'}: ${who}.`
          : 'No one you have logged matches this yet.'}
      </div>
      {item.overwrites && (
        <div className="hint" style={{ color: '#8d2846' }}>
          Not ticked: it is currently {item.overwrites === 'redline' ? 'a red line' : 'a would-rather-not'}. Tick it to change that.
        </div>
      )}
    </div>
  )
}

function DescriptionReader({ criteria, store, people, dates }) {
  const [sugg, setSugg] = useState(null) // editable working copy, or null when not reading
  const [applied, setApplied] = useState('')

  const read = () => {
    const r = parseDescription(criteria.note, criteria)
    setApplied('')
    setSugg({
      wantTraits: r.wants.traits.map((t) => ({ ...t, on: !t.overwrites })),
      wantWords: r.wants.words.map((w) => ({ ...w, on: true })),
      avoidTraits: r.avoids.traits.map((t) => ({ ...t, on: !t.overwrites })),
      avoidWords: r.avoids.words.map((w) => ({ ...w, on: !w.overwrites })),
      conflicts: r.conflicts,
      unread: r.unread
    })
  }

  const patch = (key, i, change) =>
    setSugg((cur) => ({ ...cur, [key]: cur[key].map((x, j) => (j === i ? { ...x, ...change } : x)) }))

  const apply = () => {
    const wants = { ...criteria.wants }
    const avoids = { ...criteria.avoids }
    const list = (str) => (str || '').split(/[\n,;]+/).map((w) => w.trim()).filter(Boolean)

    let nWant = 0
    let nAvoid = 0
    sugg.wantTraits.filter((t) => t.on).forEach((t) => { wants[t.id] = t.level; nWant += 1 })
    sugg.avoidTraits.filter((t) => t.on).forEach((t) => { avoids[t.id] = t.level; nAvoid += 1 })

    const wantList = list(criteria.wantWords)
    const have = new Set(wantList.map((w) => w.toLowerCase()))
    sugg.wantWords.filter((w) => w.on).forEach((w) => {
      const txt = w.text.trim()
      if (txt.length >= 3 && !have.has(txt.toLowerCase())) { wantList.push(txt); have.add(txt.toLowerCase()); nWant += 1 }
    })

    // A word can be a red line or a would-rather-not, never both: the level you just chose replaces the other.
    let red = list(criteria.avoidWords)
    let soft = list(criteria.softAvoidWords)
    sugg.avoidWords.filter((w) => w.on).forEach((w) => {
      const txt = w.text.trim()
      const key = txt.toLowerCase()
      if (txt.length < 3) return
      red = red.filter((x) => x.toLowerCase() !== key)
      soft = soft.filter((x) => x.toLowerCase() !== key)
      if (w.level === 'redline') red.push(txt)
      else soft.push(txt)
      nAvoid += 1
    })

    store.setCriteria({ wants, avoids, wantWords: wantList.join(', '), avoidWords: red.join(', '), softAvoidWords: soft.join(', ') })
    setApplied(`Added ${nWant} thing${nWant === 1 ? '' : 's'} you want and ${nAvoid} thing${nAvoid === 1 ? '' : 's'} you do not want.`)
    setSugg(null)
  }

  const empty = !criteria.note || !criteria.note.trim()
  const nWantRows = sugg ? sugg.wantTraits.length + sugg.wantWords.length : 0
  const nAvoidRows = sugg ? sugg.avoidTraits.length + sugg.avoidWords.length : 0

  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" className="btn ghost" disabled={empty} onClick={read}>
        Read my note and sort it into wants and don't-wants
      </button>
      {empty && <span className="hint" style={{ marginLeft: 10 }}>Write your note first.</span>}
      {applied && <div className="adj" role="status" style={{ marginTop: 10 }}>{applied}</div>}

      {sugg && (
        <div className="stat" style={{ marginTop: 12 }}>
          <h4>Here is what I understood</h4>
          <p className="hint" style={{ marginTop: 0 }}>
            Nothing is added until you tap Add selected. Untick anything wrong, and change the level or wording.
          </p>

          {nWantRows + nAvoidRows === 0 && sugg.conflicts.length === 0 && (
            <p style={{ margin: '0 0 8px' }}>
              I could not find anything I can turn into a want or a don't-want. I understand plain statements like
              "I need someone who communicates well", "ideally ambitious", "I hate flaky people", "no smokers", or
              "I love hiking and travel".
            </p>
          )}

          <div className="side-head want">What you want</div>
          {nWantRows === 0 ? (
            <p className="hint" style={{ margin: '0 0 8px' }}>Nothing in your note reads as a want.</p>
          ) : (
            <>
              {sugg.wantTraits.map((t, i) => (
                <div key={'wt' + t.id} className="sug">
                  <label className="switch">
                    <input type="checkbox" checked={t.on} onChange={(e) => patch('wantTraits', i, { on: e.target.checked })} aria-label={`Include ${t.label}`} />
                    <span><strong>{t.label}</strong></span>
                  </label>
                  <LevelPick options={WANT_PICK} value={t.level} onPick={(level) => patch('wantTraits', i, { level })} label="How much it matters" />
                  <div className="hint">From: "{t.evidence}"</div>
                  {t.overwrites && (
                    <div className="hint" style={{ color: '#8d2846' }}>
                      Not ticked because it would replace your current setting. Tick it only if your note is what you mean.
                    </div>
                  )}
                </div>
              ))}
              {sugg.wantWords.length > 0 && <div className="lbl" style={{ marginTop: 8 }}>Good signs to look for</div>}
              {sugg.wantWords.map((w, i) => (
                <WordRow key={'ww' + i} item={w} kind="want" people={people} dates={dates} onChange={(c) => patch('wantWords', i, c)} />
              ))}
            </>
          )}

          <div className="side-head avoid">What you do not want</div>
          {nAvoidRows === 0 ? (
            <p className="hint" style={{ margin: '0 0 8px' }}>Nothing in your note reads as a don't-want.</p>
          ) : (
            <>
              <p className="hint" style={{ margin: '0 0 8px' }}>
                Red line: forces "Consider letting go". Would rather not: lowers the score and is flagged, but never
                forces it. Plain wording like "I don't want" starts as Would rather not; strong wording like "I hate"
                or "deal-breaker" starts as Red line.
              </p>
              {sugg.avoidTraits.map((t, i) => (
                <div key={'at' + t.id} className="sug">
                  <label className="switch">
                    <input type="checkbox" checked={t.on} onChange={(e) => patch('avoidTraits', i, { on: e.target.checked })} aria-label={`Include ${t.label}`} />
                    <span><strong>{t.label}</strong></span>
                  </label>
                  <LevelPick options={AVOID_PICK} value={t.level} onPick={(level) => patch('avoidTraits', i, { level })} label="How strict" />
                  <div className="hint">From: "{t.evidence}"</div>
                  {t.overwrites && (
                    <div className="hint" style={{ color: '#8d2846' }}>
                      Not ticked because it would replace your current setting. Tick it only if your note is what you mean.
                    </div>
                  )}
                </div>
              ))}
              {sugg.avoidWords.length > 0 && <div className="lbl" style={{ marginTop: 8 }}>Words to watch for in notes</div>}
              {sugg.avoidWords.map((w, i) => (
                <WordRow key={'aw' + i} item={w} kind="avoid" people={people} dates={dates} onChange={(c) => patch('avoidWords', i, c)} />
              ))}
              {sugg.avoidWords.length > 0 && (
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  Keywords match the exact word in a note. If you write "smoke" or "smoking" instead of "smokes", add
                  those forms too.
                </p>
              )}
            </>
          )}

          {sugg.conflicts.length > 0 && (
            <>
              <div className="lbl" style={{ marginTop: 12 }}>Where your note and your settings disagree</div>
              <ul className="why">
                {sugg.conflicts.map((c, i) => <li key={i} className="warn">{c.text}</li>)}
              </ul>
            </>
          )}

          {sugg.unread.length > 0 && (
            <>
              <div className="lbl" style={{ marginTop: 12 }}>Parts I did not use</div>
              <ul className="why">
                {sugg.unread.map((u, i) => <li key={i} className="unknown">{u}</li>)}
              </ul>
            </>
          )}

          <div className="btnrow">
            <button className="btn ghost" onClick={() => setSugg(null)}>Cancel</button>
            {nWantRows + nAvoidRows > 0 && (
              <button className="btn primary" onClick={apply}>Add selected</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- fit tab ---------- */

const RED_DEAL_TAGS = TAGS.filter((t) => t.kind === 'red')

// The saved criteria, split into the two sides so it is obvious what you want and what you do not.
function CriteriaSummary({ criteria }) {
  const c = normalizeCriteria(criteria)
  const tagLabel = (id) => TAGS.find((t) => t.id === id)?.label || id
  const wantChips = [
    ...TRAITS.filter((t) => c.wants[t.id]).map((t) => ({ k: 'w' + t.id, cls: 'green', text: `${WANT_LEVELS[c.wants[t.id]].label}: ${t.label}` })),
    ...splitWords(c.wantWords).map((w) => ({ k: 'ww' + w, cls: 'green', text: `Looks for: ${w}` }))
  ]
  const avoidChips = [
    ...TRAITS.filter((t) => c.avoids[t.id]).map((t) => ({
      k: 'a' + t.id, cls: c.avoids[t.id] === 'redline' ? 'red' : 'amber', text: `${AVOID_LEVELS[c.avoids[t.id]].label}: ${t.avoidLabel}`
    })),
    ...c.dealTags.map((id) => ({ k: 'dt' + id, cls: 'red', text: `Red line: tagged ${tagLabel(id)}` })),
    ...splitWords(c.avoidWords).map((w) => ({ k: 'rw' + w, cls: 'red', text: `Red line: "${w}"` })),
    ...splitWords(c.softAvoidWords).map((w) => ({ k: 'sw' + w, cls: 'amber', text: `Would rather not: "${w}"` })),
    ...(c.ageMin !== null || c.ageMax !== null
      ? [{
          k: 'age', cls: c.ageLevel === 'redline' ? 'red' : 'amber',
          text: `${AVOID_LEVELS[c.ageLevel].label}: age outside ${c.ageMin !== null && c.ageMax !== null ? `${c.ageMin} to ${c.ageMax}` : c.ageMin !== null ? `${c.ageMin}+` : `up to ${c.ageMax}`}`
        }]
      : []),
    ...(splitPlaces(c.places).length
      ? [{ k: 'places', cls: c.placesLevel === 'redline' ? 'red' : 'amber', text: `${AVOID_LEVELS[c.placesLevel].label}: outside ${splitPlaces(c.places).join(', ')}` }]
      : [])
  ]
  const side = (title, cls, chips) => (
    <div style={{ marginTop: 10 }}>
      <div className={'side-head ' + cls} style={{ marginTop: 0 }}>{title}</div>
      {chips.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>Nothing yet.</p>
      ) : (
        <div className="mini">{chips.map((x) => <span key={x.k} className={'tag ' + x.cls}>{x.text}</span>)}</div>
      )}
    </div>
  )
  return (
    <div>
      {side('I want', 'want', wantChips)}
      {side('I do not want', 'avoid', avoidChips)}
      {c.note && <p style={{ margin: '12px 0 0', fontSize: 14 }}>{c.note}</p>}
    </div>
  )
}

// What matched for one person: which of your wants and don't-wants showed up, and where.
function FlagList({ flags }) {
  if (!flags || flags.length === 0) return null
  const cls = (f) => (f.side === 'want' ? 'green' : f.level === 'redline' ? 'red' : 'amber')
  const text = (f) =>
    f.side === 'want' ? `Want: ${f.label}` : `${f.level === 'redline' ? 'Red line' : 'Would rather not'}: ${f.label}`
  const shown = flags.slice(0, 8)
  return (
    <ul className="flags" aria-label="Flags from your notes">
      {shown.map((f, i) => (
        <li key={i}>
          <span className={'tag ' + cls(f)}>{text(f)}</span>
          <span className="hint"> {f.detail}</span>
        </li>
      ))}
      {flags.length > shown.length && <li className="hint">+{flags.length - shown.length} more</li>}
    </ul>
  )
}

function Fit({ data, store, onOpen }) {
  const { people, dates, criteria } = data
  const [editing, setEditing] = useState(() => !hasCriteria(criteria))
  const wantVoice = useSpeech((t) =>
    store.setCriteria({ note: (criteria.note ? criteria.note + ' ' : '') + t })
  )

  // Wants and don't-wants are two separate maps, so one quality can be wanted AND its opposite refused.
  const setWant = (id, lvl) => {
    const next = { ...criteria.wants }
    if (next[id] === lvl) delete next[id]
    else next[id] = lvl
    store.setCriteria({ wants: next })
  }
  const setAvoid = (id, lvl) => {
    const next = { ...criteria.avoids }
    if (next[id] === lvl) delete next[id]
    else next[id] = lvl
    store.setCriteria({ avoids: next })
  }
  const toggleDeal = (id) => {
    const cur = criteria.dealTags
    store.setCriteria({ dealTags: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }

  const active = people.filter(isActive)
  const learning = data.learning !== false
  const model = useMemo(() => buildModel(data), [data])
  const scorer = useMemo(() => {
    if (!learning) return null
    return {
      weightFor: (id, stated) =>
        adjustedWeight(id, stated, model.learned, model.checkinBias[id] || 0),
      thresholdShift: model.threshold.shift,
      thresholdReason: model.threshold.reason
    }
  }, [learning, model])
  const results = useMemo(
    () => active.map((p) => ({ p, r: evaluate(p, dates, criteria, scorer) })),
    [active, dates, criteria, scorer]
  )
  const rank = { pursue: 0, watch: 1, unknown: 2, letgo: 3 }
  results.sort((a, b) => rank[a.r.verdict] - rank[b.r.verdict] || b.r.score - a.r.score)

  const ready = hasCriteria(criteria)

  return (
    <>
      <details className="stat fitfold">
        <summary>
          <h4 style={{ display: 'inline', margin: 0 }}>What I am looking for</h4>
          <span className="hint"> {ready ? '' : 'Nothing set yet.'}</span>
        </summary>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn ghost" style={{ padding: '8px 12px' }} onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <div style={{ marginTop: 14 }}>
            <p className="hint" style={{ marginTop: 0 }}>
              What you want and what you do not want are set separately, so you can want a quality and also refuse its
              opposite. Tap a level to set it, and tap it again to clear it.
            </p>

            <div className="side-head want">What I want</div>
            {TRAITS.map((t) => (
              <div key={'w' + t.id} style={{ marginBottom: 10 }}>
                <span className="lbl" style={{ marginBottom: 4 }}>{t.label}</span>
                <LevelPick options={WANT_PICK} value={criteria.wants[t.id]} onPick={(l) => setWant(t.id, l)} label={`How much ${t.label} matters`} />
              </div>
            ))}
            <label className="field" style={{ marginTop: 14 }}>
              <span>Good signs to look for</span>
              <input
                className="in"
                placeholder="hiking, travel, faith, close family"
                value={criteria.wantWords}
                onChange={(e) => store.setCriteria({ wantWords: e.target.value })}
              />
              <span className="hint" style={{ display: 'block', fontWeight: 400, marginTop: 6 }}>
                Comma separated. Raises someone's fit score when a word appears in their notes, tags, or date
                impressions. It matches the exact word, not its meaning.
              </span>
            </label>

            <div className="side-head avoid">What I do not want</div>
            <p className="hint" style={{ margin: '0 0 10px' }}>
              <strong>Red line</strong>: forces "Consider letting go" no matter the score.{' '}
              <strong>Would rather not</strong>: lowers the score by {SOFT_PENALTY_TEXT} and flags it, but never forces
              it on its own.
            </p>
            {TRAITS.map((t) => (
              <div key={'a' + t.id} style={{ marginBottom: 10 }}>
                <span className="lbl" style={{ marginBottom: 4 }}>{t.avoidLabel}</span>
                <LevelPick options={AVOID_PICK} value={criteria.avoids[t.id]} onPick={(l) => setAvoid(t.id, l)} label={`How strict about: ${t.avoidLabel}`} />
              </div>
            ))}

            <span className="lbl" style={{ marginTop: 14 }}>Red-flag tags that are red lines</span>
            <div className="tagpick">
              {RED_DEAL_TAGS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="red"
                  aria-pressed={criteria.dealTags.includes(t.id)}
                  onClick={() => toggleDeal(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="hint" style={{ margin: '6px 0 0' }}>
              Any red-flag tag you add to someone already lowers their score. Picking one here makes it a red line.
            </p>

            <label className="field" style={{ marginTop: 14 }}>
              <span>Red line words</span>
              <input
                className="in"
                placeholder="smokes, still texts ex"
                value={criteria.avoidWords}
                onChange={(e) => store.setCriteria({ avoidWords: e.target.value })}
              />
              <span className="hint" style={{ display: 'block', fontWeight: 400, marginTop: 6 }}>
                If any of these appear in someone's notes, tags, or date impressions, they are marked "Consider letting
                go". "Doesn't smoke" will not trigger "smokes".
              </span>
            </label>
            <label className="field">
              <span>Would rather not words</span>
              <input
                className="in"
                placeholder="clingy, always on their phone"
                value={criteria.softAvoidWords}
                onChange={(e) => store.setCriteria({ softAvoidWords: e.target.value })}
              />
              <span className="hint" style={{ display: 'block', fontWeight: 400, marginTop: 6 }}>
                Same matching, but each one only lowers the score and is flagged.
              </span>
            </label>

            <span className="lbl" style={{ marginTop: 14 }}>Age range I am open to</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="field" style={{ flex: 1, marginBottom: 6 }}>
                <span>From</span>
                <input className="in" inputMode="numeric" placeholder="25" aria-label="Youngest age" value={criteria.ageMin ?? ''}
                  onChange={(e) => store.setCriteria({ ageMin: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} />
              </label>
              <label className="field" style={{ flex: 1, marginBottom: 6 }}>
                <span>To</span>
                <input className="in" inputMode="numeric" placeholder="35" aria-label="Oldest age" value={criteria.ageMax ?? ''}
                  onChange={(e) => store.setCriteria({ ageMax: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} />
              </label>
            </div>
            <LevelPick options={AVOID_PICK} value={criteria.ageLevel || 'rathernot'} onPick={(l) => store.setCriteria({ ageLevel: l })} label="How strict about age" />
            <label className="field" style={{ marginTop: 12 }}>
              <span>Places that work for me</span>
              <input className="in" placeholder="Hartford, Bloomfield, West Hartford" value={criteria.places || ''}
                onChange={(e) => store.setCriteria({ places: e.target.value })} />
            </label>
            <LevelPick options={AVOID_PICK} value={criteria.placesLevel || 'rathernot'} onPick={(l) => store.setCriteria({ placesLevel: l })} label="How strict about place" />
            <p className="hint" style={{ margin: '6px 0 0' }}>
              Someone outside your age range or places counts as a don't-want at the strength you pick. Comma separated
              places are matched against the location on their profile. If a profile has no age or location, nothing is
              checked and it is not held against them.
            </p>

            <div className="section" style={{ marginTop: 18 }}>Describe your ideal partner</div>
            <label className="field">
              <span>What does a great partner look like for you?</span>
              <textarea
                className="in"
                placeholder="Example: I need someone who communicates well. Ideally ambitious. I hate flaky people. No smokers. I love hiking and travel."
                value={criteria.note}
                onChange={(e) => store.setCriteria({ note: e.target.value })}
              />
              <span className="hint" style={{ display: 'block', fontWeight: 400, marginTop: 6 }}>
                Write it in plain sentences, including what you do not want. Tap the button below and I will sort it
                into wants and don't-wants for you to review. Nothing changes your scores until you add it.
              </span>
            </label>
            <DescriptionReader criteria={criteria} store={store} people={people} dates={dates} />
            {wantVoice.supported && (
              <>
                <p className="hint" style={{ margin: '0 0 8px' }}>
                  The microphone types into the description above.
                </p>
                <button
                  type="button"
                  className={'btn rose ' + (wantVoice.listening ? 'pulse' : '')}
                  onClick={wantVoice.listening ? wantVoice.stop : wantVoice.start}
                >
                  {wantVoice.listening ? <Square size={18} /> : <Mic size={18} />}
                  {wantVoice.listening ? 'Stop' : 'Speak my description'}
                </button>
              </>
            )}
            {wantVoice.listening && <div className="live">{wantVoice.interim || 'Listening…'}</div>}
            {wantVoice.error && <div className="warn">{wantVoice.error}</div>}
            <button className="btn primary" style={{ marginTop: 14 }} onClick={() => setEditing(false)}>
              Save what I want
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            <CriteriaSummary criteria={criteria} />
            {!ready && <p className="hint" style={{ margin: '10px 0 0' }}>Tap Edit to say what you want and what you do not.</p>}
          </div>
        )}
      </details>

      <LearnedPanel data={data} model={model} store={store} learning={learning} />

      {!ready ? (
        <div className="empty">
          <h3>Tell me what you want first</h3>
          <p>Say what you want and what you do not, above. Then each person gets a clear call.</p>
        </div>
      ) : active.length === 0 ? (
        <div className="empty"><h3>No one to check yet</h3><p>Add someone from the People tab.</p></div>
      ) : (
        results.map(({ p, r }) => {
          const v = VERDICT[r.verdict]
          return (
            <div key={p.id} className="verdict" style={{ '--edge': `var(--${v.tone})` }}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <h3 style={{ fontFamily: 'var(--display)', fontSize: 21, margin: 0 }}>{p.name || 'Unnamed'}</h3>
                <span className="status">{v.label}</span>
              </div>
              <div className="meta" style={{ color: 'var(--stone)', fontSize: 13, marginTop: 2 }}>
                Fit {r.score} of 100 · {r.confidence} confidence · {r.dateCount} date{r.dateCount === 1 ? '' : 's'} logged
              </div>
              <details className="fold">
              <summary>Why this call</summary>
              <FlagList flags={r.flags} />
              {r.penalty > 0 && (
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  "Would rather not" flags lowered the score from {r.baseScore} to {r.score}.
                </p>
              )}
              <FitParts r={r} />
              {r.confidence === 'low' && (
                <p className="hint" style={{ margin: '4px 0 8px' }}>
                  Low confidence: log more dates, tags, and notes for a more reliable call.
                </p>
              )}
              {r.adjustments.length > 0 && (
                <div className="adj">
                  <strong>Adjusted by what I learned about you</strong>
                  <ul>
                    {r.adjustments.map((a) => (
                      <li key={a.traitId}>
                        {a.label}: weight {a.from} to {a.to} ({a.shift > 0 ? '+' : ''}{a.shift}). {a.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <FeedbackRow
                verdict={r.verdict}
                current={data.feedback.find((f) => f.personId === p.id)}
                onAnswer={(agreed) => store.addFeedback(p.id, r.verdict, agreed)}
                disabled={r.verdict === 'unknown'}
              />
              <button className="btn ghost" style={{ padding: '8px 12px', marginTop: 8 }} onClick={() => onOpen(p.id)}>
                Open profile
              </button>
              </details>
            </div>
          )
        })
      )}

      <p className="hint" style={{ marginTop: 16 }}>
        This is a mirror of your own notes against your own standards, not a prediction about the person.
        You make the final call.
      </p>
    </>
  )
}

/* ---------- plans, remember, reflection ---------- */

const daysLabel = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 ? `In ${n} days` : n === -1 ? 'Yesterday' : `${-n} days ago`)

function RememberItems({ items, limit = 4 }) {
  if (!items.length) return null
  return (
    <ul className="remember-inline" aria-label="Saved for this plan">
      {items.slice(0, limit).map((r) => <li key={r.id}><strong>{REMEMBER_KINDS.find((k) => k.id === r.kind)?.label}:</strong> {r.text}</li>)}
      {items.length > limit && <li className="hint">+{items.length - limit} more on their profile</li>}
    </ul>
  )
}

function PlanSection({ person, store, onLogDate }) {
  const today = todayDay()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [day, setDay] = useState(today)
  const [remind, setRemind] = useState(true)
  const [msg, setMsg] = useState('')
  const plans = plansOf(person).sort((a, b) => a.date.localeCompare(b.date))
  const remember = rememberOf(person).filter((r) => !r.done)

  const save = () => {
    if (!day || day < today) return setMsg('Pick today or a day ahead.')
    if (!title.trim() && !place.trim()) return setMsg('Say what you are planning, or where.')
    store.addPlan(person.id, { date: day, title: title.trim(), place: place.trim(), remind })
    setTitle(''); setPlace(''); setDay(today); setRemind(true); setMsg(''); setOpen(false)
  }

  return (
    <div>
      {plans.length === 0 && <p className="hint" style={{ margin: '0 0 8px' }}>No plans yet.</p>}
      {plans.length > 0 && (
        <ul className="notes" aria-label="Plans">
          {plans.map((pl) => {
            const n = daysBetween(today, pl.date)
            return (
              <li key={pl.id} style={{ alignItems: 'flex-start' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{fmtDate(pl.date)}</strong> <span className={'tag ' + (n < 0 ? 'amber' : n <= 2 ? 'green' : '')}>{daysLabel(n)}</span>
                  <br />{pl.title || 'Planned date'}{pl.place ? ` at ${pl.place}` : ''}{pl.remind ? '' : ' (no reminder)'}
                  {n >= 0 && <RememberItems items={remember} limit={3} />}
                  {n < 0 && (
                    <button type="button" className="btn ghost" style={{ padding: '6px 10px', marginTop: 6 }} onClick={onLogDate}>It happened: log the date</button>
                  )}
                </span>
                <button className="icon-btn" aria-label={`Remove plan on ${fmtDate(pl.date)}`} onClick={() => store.deletePlan(person.id, pl.id)}><X size={16} /></button>
              </li>
            )
          })}
        </ul>
      )}
      {open ? (
        <div className="stat" style={{ marginTop: 10 }}>
          <h4>Plan a date</h4>
          <label className="field"><span>What</span>
            <input className="in" maxLength={MAX_PLAN_TEXT} value={title} placeholder="Hike, dinner, coffee…" onChange={(e) => { setTitle(e.target.value); setMsg('') }} /></label>
          <label className="field"><span>Where</span>
            <input className="in" maxLength={MAX_PLAN_TEXT} value={place} placeholder="Sleeping Giant, that ramen place…" onChange={(e) => { setPlace(e.target.value); setMsg('') }} /></label>
          <label className="field"><span>When</span>
            <input className="in" type="date" min={today} value={day} aria-label="Plan date" onChange={(e) => setDay(e.target.value)} /></label>
          <label className="switch"><input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} /><span>Remind me on the Today screen</span></label>
          {msg && <div className="warn" role="status">{msg}</div>}
          <div className="btnrow">
            <button type="button" className="btn ghost" onClick={() => { setOpen(false); setMsg('') }}>Cancel</button>
            <button type="button" className="btn primary" onClick={save}>Save plan</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setOpen(true)}><CalendarClock size={18} /> Plan a date</button>
      )}
    </div>
  )
}

function RememberSection({ person, store }) {
  const [kind, setKind] = useState('preference')
  const [text, setText] = useState('')
  const items = rememberOf(person)
  const add = () => {
    if (!text.trim()) return
    store.addRemember(person.id, { kind, text: text.trim() })
    setText('')
  }
  return (
    <div>
      {items.length === 0 && <p className="hint" style={{ margin: '0 0 8px' }}>Coffee order, places to try, topics to bring up, ideas for a date.</p>}
      {items.length > 0 && (
        <ul className="notes" aria-label="Remember for next time">
          {items.map((r) => (
            <li key={r.id}>
              <label className="switch" style={{ flex: 1, minWidth: 0 }}>
                <input type="checkbox" checked={r.done} aria-label={`Done: ${r.text}`} onChange={() => store.toggleRemember(person.id, r.id)} />
                <span style={r.done ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
                  <strong>{REMEMBER_KINDS.find((k) => k.id === r.kind)?.label}:</strong> {r.text}
                </span>
              </label>
              <button className="icon-btn" aria-label={`Remove ${r.text}`} onClick={() => store.deleteRemember(person.id, r.id)}><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="tagpick" role="group" aria-label="Kind of reminder" style={{ marginTop: 8 }}>
        {REMEMBER_KINDS.map((k) => (
          <button key={k.id} type="button" className="plain" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
        ))}
      </div>
      <div className="row" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input className="in" style={{ flex: 1 }} maxLength={MAX_REMEMBER_TEXT} value={text} aria-label="Remember this" placeholder="Oat milk latte, pet's name, a story…"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button type="button" className="btn ghost" onClick={add} aria-label="Add reminder"><Plus size={18} /></button>
      </div>
    </div>
  )
}

// Quick answers plus optional writing, saved on the date. Tap an answer again to clear it.
function ReflectionForm({ value, onChange }) {
  const pick = (key, id) => onChange({ ...value, [key]: value[key] === id ? undefined : id })
  const row = (key, label, answers) => (
    <div key={key} style={{ marginBottom: 10 }}>
      <span className="lbl" style={{ marginBottom: 4 }}>{label}</span>
      <div className="tagpick" role="group" aria-label={label}>
        {answers.map((a) => (
          <button key={a.id} type="button" className="plain" aria-pressed={value[key] === a.id} onClick={() => pick(key, a.id)}>{a.label}</button>
        ))}
      </div>
    </div>
  )
  return (
    <div className="stat" style={{ marginTop: 6 }}>
      <h4>Reflection</h4>
      <p className="hint" style={{ marginTop: 0 }}>Optional, and every question can be skipped. This is for you: how it felt, not just how it went.</p>
      {REFLECTION_QUESTIONS.map((q) => row(q.id, q.label, REFLECTION_ANSWERS))}
      {row('again', 'I am interested in seeing them again', AGAIN_ANSWERS)}
      <label className="field"><span>Is there anything I want to understand better?</span>
        <input className="in" maxLength={MAX_REFLECTION_NOTE} value={value.understand || ''} onChange={(e) => onChange({ ...value, understand: e.target.value })} /></label>
      <label className="field"><span>Journal (optional)</span>
        <textarea className="in" maxLength={MAX_REFLECTION_JOURNAL} value={value.journal || ''} onChange={(e) => onChange({ ...value, journal: e.target.value })} /></label>
      <p className="hint" style={{ margin: 0 }}>Your answers count in Fit: your last three reflections, up to 4 points either way, inside the shared 10 point cap.</p>
    </div>
  )
}

// One suggested question at a time, collapsed until opened. Saving it puts it in Remember for next time.
function PromptSection({ person, dates, store }) {
  const [skip, setSkip] = useState(0)
  const [category, setCategory] = useState('all')
  const list = promptCandidates(person, dates, { category })
  const covered = usedPromptIds(person).size
  const pick = list.length ? list[skip % list.length] : null
  const save = (done) => {
    if (!pick) return
    store.addRemember(person.id, { kind: 'topic', text: pick.text, done, promptId: pick.id })
    if (done) store.addMoment(person.id, { date: todayDay(), type: 'conversation', text: `Talked about: ${pick.text}`, feeling: null })
    setSkip(0)
  }
  return (
    <details className="fold" aria-label="Conversation prompts">
      <summary>Conversation prompts{covered ? ` (${covered} used)` : ''}</summary>
      <label className="field" style={{ margin: '4px 0 8px' }}>
        <span>Theme</span>
        <select className="in" value={category} aria-label="Prompt theme" onChange={(e) => { setCategory(e.target.value); setSkip(0) }}>
          <option value="all">Any</option>
          {PROMPT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      {pick ? (
        <div className="stat" style={{ margin: '0 0 8px' }}>
          <span className="tag">{PROMPT_CATEGORIES.find((c) => c.id === pick.category)?.label}</span>
          <p style={{ margin: '8px 0', fontSize: 16, lineHeight: 1.4 }} aria-live="polite">{pick.text}</p>
          <div className="btnrow" style={{ marginTop: 0 }}>
            <button type="button" className="btn ghost" onClick={() => setSkip(skip + 1)}>Another</button>
            <button type="button" className="btn ghost" onClick={() => save(false)}>Save for next time</button>
          </div>
          <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => save(true)}>We talked about it</button>
        </div>
      ) : (
        <p className="hint" style={{ margin: '0 0 8px' }}>{covered ? 'You have used every prompt in this theme with them.' : 'No prompts in this theme.'}</p>
      )}
      <p className="hint" style={{ margin: 0 }}>Just questions to spark a conversation. Light ones come first while you are getting to know someone.</p>
    </details>
  )
}

/* ---------- today ---------- */

function QuickLog({ people, store, onLogDate }) {
  const [personId, setPersonId] = useState('')
  const [note, setNote] = useState('')
  const [feeling, setFeeling] = useState('')
  const [msg, setMsg] = useState('')
  const who = people.find((p) => p.id === personId) || people[0]
  if (!who) return null
  const said = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }
  const talked = () => { store.addContact(who.id, todayDay(), ''); said(`Logged: you talked to ${who.name || 'them'} today.`) }
  const saveNote = () => {
    if (!note.trim() && !feeling) return said('Write a line, or pick how it felt.')
    store.addMoment(who.id, { date: todayDay(), type: note.trim() ? 'conversation' : 'feeling', text: note.trim(), feeling: feeling || null })
    setNote(''); setFeeling(''); said(`Saved to ${who.name || 'their'} timeline.`)
  }
  return (
    <details className="stat fitfold" aria-label="Quick log">
      <summary><h4 style={{ display: 'inline', margin: 0 }}>Quick log</h4></summary>
      <label className="field" style={{ margin: '10px 0 8px' }}>
        <span>With</span>
        <select className="in" value={who.id} aria-label="Quick log person" onChange={(e) => setPersonId(e.target.value)}>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name || 'Unnamed'}</option>)}
        </select>
      </label>
      <div className="btnrow" style={{ marginTop: 0 }}>
        <button type="button" className="btn ghost" onClick={talked}><MessageCircle size={18} /> We talked today</button>
        <button type="button" className="btn rose" onClick={() => onLogDate(who.id)}><CalendarHeart size={18} /> Log a date</button>
      </div>
      <input className="in" style={{ marginTop: 10 }} value={note} maxLength={MAX_MOMENT_TEXT} aria-label="Quick note" placeholder="One line about today…"
        onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveNote()} />
      <div className="tagpick" role="group" aria-label="Quick feeling" style={{ marginTop: 8 }}>
        {FEELINGS.map((f) => (
          <button key={f.id} type="button" className={FEEL_CLASS[f.id]} aria-pressed={feeling === f.id} onClick={() => setFeeling(feeling === f.id ? '' : f.id)}>{f.label}</button>
        ))}
      </div>
      <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={saveNote}><Sparkles size={18} /> Save note</button>
      {msg && <div className="adj" role="status" style={{ marginTop: 8 }}>{msg}</div>}
    </details>
  )
}

// A slim banner that only exists when a plan with a reminder is due. Nothing else from the old Today screen survives.
function ReminderBanner({ data, onOpenPerson }) {
  const t = useMemo(() => buildToday(data, { today: todayDay(), reminderDays: data.settings.reminderDays }), [data])
  const due = t.upcoming.filter((u) => u.due)
  if (due.length === 0) return null
  return (
    <div className="stat remind" role="region" aria-label="Reminders">
      <h4><Bell size={16} aria-hidden="true" /> Coming up</h4>
      {due.map((u) => (
        <div key={u.plan.id} style={{ marginBottom: 8 }}>
          <span className="tag green">{daysLabel(u.days)}</span> <strong>{u.person.name || 'Unnamed'}</strong>: {u.plan.title || 'Planned date'}{u.plan.place ? ` at ${u.plan.place}` : ''}
          <RememberItems items={u.remember} />
          <button type="button" className="tl-link" onClick={() => onOpenPerson(u.person.id)}>Open profile</button>
        </div>
      ))}
    </div>
  )
}

// Dates from the last three weeks that have no reflection yet. Collapsed so the Dates tab stays calm.
function UnfinishedReflections({ people, dates, onReflect }) {
  const list = useMemo(() => buildToday({ people, dates }, { today: todayDay() }).reflections, [people, dates])
  if (list.length === 0) return null
  return (
    <details className="stat fitfold" aria-label="Unfinished reflections">
      <summary><h4 style={{ display: 'inline', margin: 0 }}>Unfinished reflections</h4><span className="hint"> {list.length}</span></summary>
      <p className="hint" style={{ margin: '8px 0' }}>Dates from the last three weeks you have not reflected on. Optional, and only for you.</p>
      {list.map((x) => (
        <p key={x.date.id} style={{ margin: '0 0 8px' }}>
          <strong>{x.person.name || 'Unnamed'}</strong>, {fmtDate(x.date.date)}{x.date.activity ? `, ${x.date.activity}` : ''}{' '}
          <button type="button" className="tl-link" onClick={() => onReflect(x.date.id)}>Reflect</button>
        </p>
      ))}
    </details>
  )
}

/* ---------- lock, undo, settings ---------- */

function LockScreen({ onUnlock }) {
  const [pin, setPinIn] = useState('')
  const [msg, setMsg] = useState('')
  const [wait, setWait] = useState(() => waitLeft())
  useEffect(() => {
    if (wait <= 0) return undefined
    const id = setInterval(() => { const w = waitLeft(); setWait(w); if (w <= 0) setMsg('') }, 500)
    return () => clearInterval(id)
  }, [wait])
  const submit = async () => {
    if (wait > 0 || !PIN_RE.test(pin)) return setMsg('Enter your 4 to 8 digit PIN.')
    if (await verifyPin(pin)) { resetFails(); onUnlock(); return }
    recordFail()
    setPinIn('')
    const w = waitLeft()
    setWait(w)
    setMsg(w > 0 ? 'Too many tries. Wait a moment.' : 'That PIN is not right.')
  }
  return (
    <div className="lockscreen" role="dialog" aria-modal="true" aria-label="Date-a-Dex is locked">
      <Lock size={36} aria-hidden="true" />
      <h1>Date-a-Dex</h1>
      <p>Enter your PIN to open.</p>
      <input className="in pin" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} aria-label="PIN" autoFocus
        onChange={(e) => setPinIn(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <button type="button" className="btn primary" disabled={wait > 0} onClick={submit}>{wait > 0 ? `Try again in ${Math.ceil(wait / 1000)}s` : 'Unlock'}</button>
      {msg && <div className="warn" role="alert">{msg}</div>}
    </div>
  )
}

function UndoToast({ store }) {
  const u = store.undo
  useEffect(() => {
    if (!u) return undefined
    const id = setTimeout(store.dismissUndo, 8000)
    return () => clearTimeout(id)
  }, [u?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!u) return null
  return (
    <div className="toast" role="status">
      <span>{u.label}</span>
      <button type="button" onClick={store.undoLast}><Undo2 size={16} aria-hidden="true" /> Undo</button>
    </div>
  )
}

function downloadText(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function SettingsSheet({ store, onClose, onLockNow }) {
  const { data } = store
  const st = data.settings
  const [pinSet, setPinSetState] = useState(hasPin())
  const [cur, setCur] = useState('')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')
  const [pending, setPending] = useState(null)
  const [passIn, setPassIn] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef(null)
  const say = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const moments = data.people.reduce((n, p) => n + momentsOf(p).length, 0)
  const plans = data.people.reduce((n, p) => n + plansOf(p).length, 0)
  const reflections = data.dates.filter((d) => reflectionOf(d)).length
  const kb = Math.max(1, Math.round(new Blob([JSON.stringify(data)]).size / 1024))

  const savePin = async () => {
    if (!PIN_RE.test(pin1)) return say('Use 4 to 8 digits.')
    if (pin1 !== pin2) return say('The two PINs do not match.')
    if (pinSet && !(await verifyPin(cur))) return say('The current PIN is not right.')
    await setPin(pin1)
    setPinSetState(true); setCur(''); setPin1(''); setPin2('')
    say(pinSet ? 'PIN changed.' : 'App lock is on.')
  }
  const removePin = async () => {
    if (!(await verifyPin(cur))) return say('Enter your current PIN to turn the lock off.')
    clearPin(); setPinSetState(false); setCur(''); say('App lock is off.')
  }

  const exportPlain = () => {
    downloadText(`date-a-dex-backup-${todayISO()}.json`, JSON.stringify(data, null, 2))
    store.setSettings({ lastBackup: todayDay() }); say('Backup downloaded. It is NOT encrypted.')
  }
  const exportEncrypted = async () => {
    if (pass1.length < MIN_PASSPHRASE) return say(`Use a passphrase of at least ${MIN_PASSPHRASE} characters.`)
    if (pass1 !== pass2) return say('The two passphrases do not match.')
    try {
      const file = await encryptBackup(JSON.stringify(data), pass1)
      downloadText(`date-a-dex-encrypted-${todayISO()}.json`, JSON.stringify(file))
      store.setSettings({ lastBackup: todayDay() }); setPass1(''); setPass2('')
      say('Encrypted backup downloaded. Without the passphrase it cannot be opened, by anyone.')
    } catch (e) { say(e.message) }
  }
  const restore = (parsed) => {
    if (!parsed || !Array.isArray(parsed.people) || !Array.isArray(parsed.dates)) return say('That file is not a valid backup.')
    if (confirm('Replace everything on this device with this backup?')) { store.replaceAll(parsed); say('Backup restored.') }
  }
  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const parsed = JSON.parse(await f.text())
      if (isEncryptedBackup(parsed)) { setPending(parsed); setPassIn(''); return }
      restore(parsed)
    } catch { say('That file is not a valid backup.') }
  }
  const decrypt = async () => {
    try { const text = await decryptBackup(pending, passIn); setPending(null); setPassIn(''); restore(JSON.parse(text)) }
    catch (e) { say(e.message) }
  }
  const cardToggle = (key, label) => (
    <label key={key} className="switch"><input type="checkbox" checked={st.card[key]} onChange={(e) => store.setSettings({ card: { [key]: e.target.checked } })} /><span>{label}</span></label>
  )

  return (
    <Sheet title="Settings" onClose={onClose}>
      {msg && <div className="adj" role="status" style={{ position: 'sticky', top: 0, zIndex: 2 }}>{msg}</div>}

      <div className="section">Privacy</div>
      <div className="stat" aria-label="Privacy dashboard">
        <p style={{ margin: '0 0 8px' }}>Everything is stored only in this browser, on this device. Nothing is sent anywhere, and there is no account.</p>
        <ul className="why">
          <li className="good">{data.people.length} people, {data.dates.length} dates, {moments} moments, {plans} plans, {reflections} reflections</li>
          <li className="good">About {kb} KB stored on this device</li>
          <li className={pinSet ? 'good' : 'warn'}>App lock: {pinSet ? 'on' : 'off'}</li>
          <li className={st.lastBackup ? 'good' : 'warn'}>Last backup: {st.lastBackup ? fmtDate(st.lastBackup) : 'never'}</li>
        </ul>
        <p className="hint" style={{ margin: 0 }}>Clearing this site's data in your browser erases everything, so keep a backup.</p>
      </div>

      <div className="section">App lock</div>
      <p className="hint" style={{ marginTop: 0 }}>
        A PIN keeps casual snoopers out of the app. It does not encrypt what is stored in the browser; an encrypted backup is how you protect a copy.
        If you forget the PIN, the only way back in is clearing this site's data in your browser, which erases everything. Keep a backup.
      </p>
      {pinSet && <label className="field"><span>Current PIN</span><input className="in" type="password" inputMode="numeric" maxLength={8} value={cur} aria-label="Current PIN" onChange={(e) => setCur(e.target.value.replace(/\D/g, ''))} /></label>}
      <label className="field"><span>{pinSet ? 'New PIN' : 'Choose a PIN (4 to 8 digits)'}</span><input className="in" type="password" inputMode="numeric" maxLength={8} value={pin1} aria-label="New PIN" onChange={(e) => setPin1(e.target.value.replace(/\D/g, ''))} /></label>
      <label className="field"><span>Repeat the PIN</span><input className="in" type="password" inputMode="numeric" maxLength={8} value={pin2} aria-label="Repeat PIN" onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} /></label>
      <div className="btnrow">
        <button type="button" className="btn primary" onClick={savePin}>{pinSet ? 'Change PIN' : 'Turn on app lock'}</button>
        {pinSet && <button type="button" className="btn ghost" onClick={removePin}>Turn off</button>}
      </div>
      {pinSet && (
        <>
          <label className="field" style={{ marginTop: 12 }}><span>Lock again</span>
            <select className="in" value={st.autoLockSeconds} aria-label="Lock again" onChange={(e) => store.setSettings({ autoLockSeconds: Number(e.target.value) })}>
              {LOCK_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select></label>
          <button type="button" className="btn ghost" style={{ width: '100%' }} onClick={onLockNow}><Lock size={18} /> Lock now</button>
        </>
      )}

      <div className="section">Backups</div>
      <div className="btnrow" style={{ marginTop: 0 }}>
        <button type="button" className="btn ghost" onClick={exportPlain}><Download size={18} /> Plain backup</button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}><Upload size={18} /> Restore</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={onFile} aria-label="Backup file" />
      <div className="stat" style={{ marginTop: 10 }}>
        <h4>Encrypted backup</h4>
        <p className="hint" style={{ marginTop: 0 }}>Protected with a passphrase you choose. We cannot recover it: if you lose it, that backup is gone for good.</p>
        <label className="field"><span>Passphrase (at least {MIN_PASSPHRASE} characters)</span><input className="in" type="password" autoComplete="off" value={pass1} aria-label="Passphrase" onChange={(e) => setPass1(e.target.value)} /></label>
        <label className="field"><span>Repeat the passphrase</span><input className="in" type="password" autoComplete="off" value={pass2} aria-label="Repeat passphrase" onChange={(e) => setPass2(e.target.value)} /></label>
        <button type="button" className="btn primary" style={{ width: '100%' }} onClick={exportEncrypted}><Lock size={18} /> Download encrypted backup</button>
      </div>
      {pending && (
        <div className="stat" style={{ marginTop: 10 }}>
          <h4>This backup is encrypted</h4>
          <label className="field"><span>Passphrase</span><input className="in" type="password" autoComplete="off" value={passIn} aria-label="Backup passphrase" onChange={(e) => setPassIn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && decrypt()} /></label>
          <div className="btnrow">
            <button type="button" className="btn ghost" onClick={() => setPending(null)}>Cancel</button>
            <button type="button" className="btn primary" onClick={decrypt}>Decrypt and restore</button>
          </div>
        </div>
      )}

      <div className="section">People cards</div>
      <p className="hint" style={{ marginTop: 0 }}>Choose what shows on each card in the People list. Profiles always show everything.</p>
      {cardToggle('details', 'Details on cards (age, job, location, how you met)')}
      {cardToggle('notes', 'Remembered details on cards')}
      {cardToggle('flags', 'Green and red flags on cards')}
      {cardToggle('contact', 'Last contact on cards')}

      <div className="section">Profile sections</div>
      <p className="hint" style={{ marginTop: 0 }}>Hide the parts of a profile you do not use. Hiding a section only tucks it away: nothing is deleted, and it still counts in Fit.</p>
      {[['flags', 'Green and red flags on profiles'], ['plans', 'Plan a date on profiles'], ['remember', 'Remember for next time on profiles'], ['prompts', 'Conversation prompts on profiles'], ['timeline', 'Timeline and contact log on profiles']].map(([k, label]) => (
        <label key={k} className="switch"><input type="checkbox" checked={st.profile[k]} onChange={(e) => store.setSettings({ profile: { [k]: e.target.checked } })} /><span>{label}</span></label>
      ))}

      <div className="section">Reminders</div>
      <label className="field"><span>Remind me about a plan</span>
        <select className="in" value={st.reminderDays} aria-label="Reminder days" onChange={(e) => store.setSettings({ reminderDays: Number(e.target.value) })}>
          {[0, 1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n === 0 ? 'Only on the day' : n === 1 ? '1 day before' : `${n} days before`}</option>)}
        </select></label>
      <p className="hint" style={{ marginTop: 0 }}>Reminders show on the Today screen when you open the app. Date-a-Dex does not send notifications, because everything stays on your device.</p>

      <div className="section">Danger zone</div>
      <button type="button" className="btn danger" style={{ width: '100%' }}
        onClick={() => { if (confirm('Erase all people, dates, and notes from this device? You can undo for a few seconds.')) { store.eraseEverything(); onClose() } }}>
        <Trash2 size={18} /> Erase everything
      </button>
    </Sheet>
  )
}

/* ---------- personal patterns (Insights) ---------- */

function EmotionChart({ series }) {
  if (series.length < 2) return <p className="hint" style={{ margin: 0 }}>Add a feeling to a few moments, or answer the reflection questions after dates, and a line of how things have felt will appear here.</p>
  const W = 300, H = 120, pad = 14
  const x = (i) => pad + (i * (W - 2 * pad)) / (series.length - 1)
  const y = (v) => H / 2 - v * (H / 2 - pad)
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = series[series.length - 1]
  const word = (v) => (v >= 0.5 ? 'good' : v > -0.5 ? 'mixed' : 'hard')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: '100%', height: 'auto' }}
      aria-label={`How things have felt over ${series.length} entries, from ${fmtDate(series[0].date)} to ${fmtDate(last.date)}. Most recent: ${word(last.value)}.`}>
      <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} stroke="#cdbfc6" strokeDasharray="4 4" />
      <text x={pad} y={12} fontSize="9" fill="#7a6a72">Better</text>
      <text x={pad} y={H - 4} fontSize="9" fill="#7a6a72">Harder</text>
      <polyline points={pts} fill="none" stroke="#c8456b" strokeWidth="2" strokeLinejoin="round" />
      {series.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="3.5" fill={p.source === 'reflection' ? '#2b1b2e' : '#c8456b'} />)}
    </svg>
  )
}

function PatternsCard({ data }) {
  const [who, setWho] = useState('')
  const series = useMemo(() => emotionSeries(data.people, data.dates, who || null), [data.people, data.dates, who])
  const acts = activityAverages(data.dates).slice(0, 3)
  const words = themes(data.people, data.dates)
  const trends = reflectionTrends(data.dates)
  return (
    <>
      <div className="stat" aria-label="How things have felt">
        <h4>How things have felt</h4>
        <label className="field" style={{ marginBottom: 8 }}>
          <span>Show</span>
          <select className="in" value={who} aria-label="Feelings for" onChange={(e) => setWho(e.target.value)}>
            <option value="">Everyone</option>
            {data.people.map((p) => <option key={p.id} value={p.id}>{p.name || 'Unnamed'}</option>)}
          </select>
        </label>
        <EmotionChart series={series} />
        <p className="hint" style={{ margin: '6px 0 0' }}>Dots are moment feelings (rose) and reflections (dark).</p>
      </div>
      <div className="stat" aria-label="Personal patterns">
        <h4>Patterns in your own entries</h4>
        {acts.length === 0 && words.length === 0 && trends.rows.length === 0 && (
          <p className="hint" style={{ margin: 0 }}>Patterns appear once you have a few rated dates, notes, and reflections.</p>
        )}
        {acts.length > 0 && (
          <p style={{ margin: '0 0 8px' }}><strong>Dates you rated highest:</strong> {acts.map((a) => `${a.activity} (${a.avg.toFixed(1)} across ${a.n})`).join(', ')}.</p>
        )}
        {words.length > 0 && (
          <p style={{ margin: '0 0 8px' }}><strong>Words that keep coming up in what you wrote:</strong> {words.map((w) => `${w.word} (${w.n})`).join(', ')}.</p>
        )}
        {trends.rows.length > 0 && (
          <div>
            <strong>Your reflection answers ({trends.reflections}):</strong>
            <ul className="why" style={{ marginTop: 6 }}>
              {trends.rows.map((r) => <li key={r.id} className={r.no > r.yes ? 'warn' : 'good'}>{r.short}: Yes {r.yes} of {r.n}, No {r.no}</li>)}
            </ul>
          </div>
        )}
        <p className="hint" style={{ margin: '6px 0 0' }}>These describe your own records only. Small samples can mislead, and they are not advice about any person.</p>
      </div>
    </>
  )
}

/* ---------- fit explanation ---------- */

// Four honest parts instead of one list: what fits, how much we know, what is unexplored, and how it has felt.
function FitParts({ r }) {
  const pick = (sec) => r.reasons.filter((x) => !x.dup && x.section === sec)
  const comp = pick('compatibility')
  const exp = pick('experience')
  const ev = r.evidence
  const bits = [[ev.dates, 'date'], [ev.reflections, 'reflection'], [ev.notes, 'note'], [ev.contacts, 'contact'], [ev.moments, 'moment'], [ev.flags, 'flag'], [ev.plans, 'plan'], [ev.remembered, 'remembered detail']]
    .filter(([n]) => n > 0)
    .map(([n, w]) => `${n} ${w}${n === 1 ? '' : 's'}`)
  return (
    <div className="fitparts">
      <section aria-label="Compatibility">
        <h5>Compatibility</h5>
        {comp.length ? <ul className="why">{comp.slice(0, 6).map((x, i) => <li key={i} className={x.kind}>{x.text}</li>)}</ul> : <p className="hint">Nothing to compare yet.</p>}
      </section>
      <section aria-label="Personal experience">
        <h5>Personal experience</h5>
        {exp.length ? <ul className="why">{exp.map((x, i) => <li key={i} className={x.kind}>{x.text}</li>)}</ul> : <p className="hint">Nothing about how it has felt yet. A moment with a feeling, or a reflection after a date, adds it.</p>}
      </section>
      <section aria-label="Unknowns">
        <h5>Unknowns</h5>
        {r.unknowns.length ? <ul className="why">{r.unknowns.map((u, i) => <li key={i} className="unknown">{u}</li>)}</ul> : <p className="hint">Nothing you care about is unexplored.</p>}
      </section>
      <section aria-label="Evidence">
        <h5>Evidence</h5>
        <p className="hint" style={{ margin: 0 }}>{r.confidence[0].toUpperCase() + r.confidence.slice(1)} confidence, from {bits.join(', ') || 'no records yet'}.</p>
      </section>
    </div>
  )
}

/* ---------- timeline tab ---------- */

const TL_GROUPS = [
  { id: 'all', label: 'Everything' },
  { id: 'dates', label: 'Dates' },
  { id: 'contact', label: 'In touch' },
  { id: 'moments', label: 'Moments' }
]

function TimelineTab({ data, store, onOpenPerson, onOpenDate }) {
  const [personId, setPersonId] = useState('')
  const [group, setGroup] = useState('all')
  const [archived, setArchived] = useState(false)
  const entries = useMemo(
    () => buildTimeline(data.people, data.dates, { personId: personId || null, group, includeArchived: archived, endReasons: END_REASONS }),
    [data.people, data.dates, personId, group, archived]
  )
  const options = [...data.people].filter((p) => archived || !p.archived || p.id === personId).sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  if (data.people.length === 0) {
    return <div className="empty"><h3>No story yet</h3><p>Add someone from the People tab, and everything you record about them will line up here.</p></div>
  }
  return (
    <>
      <label className="field">
        <span>Show</span>
        <select className="in" value={personId} aria-label="Person" onChange={(e) => setPersonId(e.target.value)}>
          <option value="">Everyone</option>
          {options.map((p) => <option key={p.id} value={p.id}>{p.name || 'Unnamed'}{p.archived ? ' (archived)' : ''}</option>)}
        </select>
      </label>
      <div className="tagpick" role="group" aria-label="Type of entry">
        {TL_GROUPS.map((g) => (
          <button key={g.id} type="button" className="plain" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>{g.label}</button>
        ))}
      </div>
      <label className="switch" style={{ margin: '10px 0' }}>
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
        <span>Include archived people</span>
      </label>
      <p className="hint" style={{ margin: '0 0 6px' }}>{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}, newest first.</p>
      <TimelineList
        entries={entries}
        showPerson={!personId}
        empty="Nothing matches. Try another person or type."
        onOpenPerson={onOpenPerson}
        onOpenDate={onOpenDate}
        onDelete={(e) => {
          if (e.kind === 'moment') store.deleteMoment(e.personId, e.refId)
          else if (e.kind === 'plan') store.deletePlan(e.personId, e.refId)
          else store.deleteContact(e.personId, e.refId)
        }}
      />
    </>
  )
}

/* ---------- root ---------- */

const TABS = [
  { id: 'roster', label: 'People', icon: Users, sub: 'Everyone you are talking to' },
  { id: 'timeline', label: 'Timeline', icon: History, sub: 'Dates, contact and moments in order' },
  { id: 'dates', label: 'Dates', icon: CalendarHeart, sub: 'Your date history' },
  { id: 'fit', label: 'Fit', icon: Scale, sub: 'Do they match what you want?' },
  { id: 'insights', label: 'Insights', icon: BarChart3, sub: 'Patterns over time' }
]

export default function App() {
  const store = useStore()
  const { data } = store
  const [tab, setTab] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    const id = q === 'people' ? 'roster' : q
    return TABS.some((t) => t.id === id) ? id : 'roster'
  })
  const [locked, setLocked] = useState(() => hasPin())
  const hiddenAt = useRef(0)
  const lockAfter = store.data.settings.autoLockSeconds
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return }
      if (!hasPin() || !hiddenAt.current) return
      if ((Date.now() - hiddenAt.current) / 1000 >= lockAfter) setLocked(true)
      hiddenAt.current = 0
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [lockAfter])
  const [sheet, setSheet] = useState(null) // {type, ...}

  const current = TABS.find((t) => t.id === tab)
  const person = sheet?.personId ? data.people.find((p) => p.id === sheet.personId) : null
  const activePeople = data.people.filter(isActive)
  // New dates can only be logged with people you are still seeing. But an EXISTING date must always show its own
  // person, even if they have since been let go or archived, or the dropdown would display someone else.
  const datePeople = (existing) => {
    const owner = existing ? data.people.find((p) => p.id === existing.personId) : null
    return owner && !activePeople.some((p) => p.id === owner.id) ? [...activePeople, owner] : activePeople
  }

  const openDate = (id, reflect = false) => {
    const d = data.dates.find((x) => x.id === id)
    if (d) setSheet({ type: 'date', date: d, reflect })
  }

  const fabLabel = tab === 'dates' ? 'Log date' : 'Add match'
  const onFab = () =>
    setSheet(tab === 'dates' ? { type: 'date' } : { type: 'quick' })

  if (locked && hasPin()) return <LockScreen onUnlock={() => setLocked(false)} />

  return (
    <div className="app">
      <header className="top">
        <button type="button" className="gear" aria-label="Settings" onClick={() => setSheet({ type: 'settings' })}><SettingsIcon size={22} /></button>
        <div className="brand">Date-a-Dex</div>
        <h1>{current.label}</h1>
        <p>{current.sub}</p>
      </header>

      <main className="scroll">
        {tab === 'roster' && <People people={data.people} dates={data.dates} store={store} onOpen={(id) => setSheet({ type: 'person', personId: id })} onLogDate={(personId) => setSheet({ type: 'date', defaultPersonId: personId })} />}
        {tab === 'timeline' && <TimelineTab data={data} store={store} onOpenPerson={(id) => setSheet({ type: 'person', personId: id })} onOpenDate={openDate} />}
        {tab === 'dates' && <DateLog people={data.people} dates={data.dates} onEdit={(d) => setSheet({ type: 'date', date: d })} onReflect={(id) => openDate(id, true)} />}
        {tab === 'fit' && <Fit data={data} store={store} onOpen={(id) => setSheet({ type: 'person', personId: id })} />}
        {tab === 'insights' && <Insights data={data} store={store} />}
      </main>

      {tab !== 'insights' && tab !== 'fit' && tab !== 'timeline' && (
        <button className="fab" onClick={onFab}>
          <Plus size={20} /> {fabLabel}
        </button>
      )}

      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner" role="tablist">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                <Icon size={22} />
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>

      {sheet?.type === 'quick' && (
        <QuickAdd
          onClose={() => setSheet(null)}
          onSave={(p) => {
            store.addPerson(p)
            setSheet(null)
          }}
        />
      )}

      {sheet?.type === 'person' && person && (
        <PersonSheet
          person={person}
          dates={data.dates}
          store={store}
          onClose={() => setSheet(null)}
          onLogDate={() => setSheet({ type: 'date', defaultPersonId: person.id })}
          onEditDate={(d) => setSheet({ type: 'date', date: d })}
        />
      )}

      {sheet?.type === 'date' && (
        <DateSheet
          people={datePeople(sheet.date)}
          initial={sheet.date}
          defaultPersonId={sheet.defaultPersonId}
          store={store}
          onClose={() => setSheet(null)}
          onCheckin={(personId, dateId) => setSheet({ type: 'checkin', personId, dateId })}
          openReflection={Boolean(sheet.reflect)}
        />
      )}

      {sheet?.type === 'settings' && (
        <SettingsSheet store={store} onClose={() => setSheet(null)} onLockNow={() => { setSheet(null); setLocked(true) }} />
      )}

      <UndoToast store={store} />

      {sheet?.type === 'checkin' && data.people.find((p) => p.id === sheet.personId) && (
        <CheckinSheet
          person={data.people.find((p) => p.id === sheet.personId)}
          dateRec={{ id: sheet.dateId }}
          onClose={() => setSheet(null)}
          onSave={(entry) => {
            store.addCheckin(entry)
            setSheet(null)
          }}
        />
      )}
    </div>
  )
}
