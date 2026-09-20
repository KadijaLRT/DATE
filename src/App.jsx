import { useMemo, useRef, useState } from 'react'
import {
  Users, CalendarHeart, BarChart3, Plus, X, Mic, Square,
  Star, Trash2, Archive, ArchiveRestore, Download, Upload, Scale
} from 'lucide-react'
import {
  useStore, STATUSES, ACTIVE_STATUSES, END_REASONS, isActive, TAGS, agoLabel, daysSince, fmtDate, lastContactOf, todayDay
} from './store.js'
import { useSpeech, summarizeToBullets } from './useSpeech.js'
import { TRAITS, WANT_LEVELS, AVOID_LEVELS, VERDICT, SOFT_PENALTY, evaluate, hasCriteria, normalizeCriteria, splitWords, wordHits } from './fit.js'
import { buildModel, adjustedWeight, MIN_FEEDBACK } from './learn.js'
import { parseDescription } from './describe.js'

const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0]
const tagOf = (id) => TAGS.find((t) => t.id === id)
const todayISO = () => new Date().toISOString().slice(0, 10)

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

function TagPicker({ value, onChange }) {
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="tagpick">
      {TAGS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={t.kind}
          aria-pressed={value.includes(t.id)}
          onClick={() => toggle(t.id)}
        >
          {t.kind === 'green' ? 'Green: ' : 'Red: '}
          {t.label}
        </button>
      ))}
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
      <button className="btn primary" onClick={save}>Add to roster</button>
    </Sheet>
  )
}


function ContactLog({ person, dates, store }) {
  const [day, setDay] = useState(todayDay())
  const [note, setNote] = useState('')
  const last = lastContactOf(person, dates)
  const items = [...(person.contacts || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

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

      <div className="two" style={{ alignItems: 'end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>When</span>
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

      {items.length > 0 && (
        <ul className="notes" style={{ marginTop: 12 }}>
          {items.map((c) => (
            <li key={c.id}>
              <span>
                <strong>{fmtDate(c.date)}</strong>
                {c.note ? `, ${c.note}` : ''}
              </span>
              <button className="icon-btn" aria-label={`Delete contact on ${fmtDate(c.date)}`}
                onClick={() => store.deleteContact(person.id, c.id)}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
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

function PersonSheet({ person, dates, store, onClose, onLogDate }) {
  const [note, setNote] = useState('')
  const set = (patch) => store.updatePerson(person.id, patch)
  const mine = dates.filter((d) => d.personId === person.id)

  const addNote = () => {
    if (!note.trim()) return
    set({ notes: [...person.notes, note.trim()] })
    setNote('')
  }

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

      <div className="section">Green and red flags</div>
      <TagPicker value={person.tags} onChange={(tags) => set({ tags })} />

      <div className="section">Things to remember</div>
      <ul className="notes">
        {person.notes.map((n, i) => (
          <li key={i}>
            <span>{n}</span>
            <button
              className="icon-btn"
              aria-label="Remove note"
              onClick={() => set({ notes: person.notes.filter((_, j) => j !== i) })}
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      <div className="addnote">
        <input
          className="in"
          placeholder="Favorite food, pet's name, a story…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
        />
        <button className="btn ghost" onClick={addNote} aria-label="Add note"><Plus size={18} /></button>
      </div>

      <div className="section">Contact history</div>
      <ContactLog person={person} dates={dates} store={store} />

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

function DateSheet({ people, initial, defaultPersonId, store, onClose, onCheckin }) {
  const editing = Boolean(initial)
  const [personId, setPersonId] = useState(initial?.personId || defaultPersonId || people[0]?.id || '')
  const [date, setDate] = useState(initial?.date || todayISO())
  const [activity, setActivity] = useState(initial?.activity || '')
  const [rating, setRating] = useState(initial?.rating || 0)
  const [followUp, setFollowUp] = useState(initial?.followUp || 'none')
  const [impressions, setImpressions] = useState(initial?.impressions || [])

  const save = () => {
    if (!personId) return
    const payload = { personId, date, activity: activity.trim(), rating, followUp, impressions }
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
          <p>Dates are linked to people in your roster.</p>
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

function PersonCard({ p, dates, onOpen }) {
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
      <div className="meta">{details || 'No details yet'}</div>
      {ended && (
        <div className="reply" style={{ color: 'var(--ink)' }}>
          Ended {fmtDate(p.end?.date)}{reason ? `: ${reason}` : ''}
        </div>
      )}
      {p.notes.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14 }}>
          {p.notes.slice(0, 2).map((n, i) => <li key={i}>{n}</li>)}
          {p.notes.length > 2 && <li className="hint">+{p.notes.length - 2} more</li>}
        </ul>
      )}
      {p.tags.length > 0 && (
        <div className="mini">
          {p.tags.map((id) => {
            const t = tagOf(id)
            return t ? <span key={id} className={'tag ' + t.kind}>{t.label}</span> : null
          })}
        </div>
      )}
      <div className={'reply' + (due ? ' due' : '')}>
        {lc ? `Last contact ${agoLabel(lc)}` : 'No contact recorded'}
        {due ? ', maybe reply?' : ''}
      </div>
    </button>
  )
}

function People({ people, dates, onOpen, store }) {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('contact')
  const [q, setQ] = useState('')

  const query = q.trim().toLowerCase()

  const { list, ended, archived, endedTotal } = useMemo(() => {
    const matches = (p) =>
      !query || [p.name, p.job, p.met, p.location, ...(p.notes || [])].join(' ').toLowerCase().includes(query)

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
      <input
        className="in"
        placeholder="Search names, jobs, notes"
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
        list.map((p) => <PersonCard key={p.id} p={p} dates={dates} onOpen={onOpen} />)
      )}

      {ended.length > 0 && (
        <>
          <div className="section">Let go / ended</div>
          {ended.map((p) => <PersonCard key={p.id} p={p} dates={dates} onOpen={onOpen} />)}
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

function DateLog({ people, dates, onEdit }) {
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
  const tagCounts = count(people.flatMap((p) => p.tags))
  const maxMeet = meets[0]?.[1] || 1
  const maxTag = tagCounts[0]?.[1] || 1

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roster-backup-${todayISO()}.json`
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

      <div className="stat">
        <h4>Most common tags</h4>
        {tagCounts.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>Tag people with green and red flags to see trends.</p>
        ) : tagCounts.map(([k, n]) => (
          <div className="bar" key={k}>
            <span>{tagOf(k)?.label || k}</span>
            <div className="track"><div className="fill" style={{ width: `${(n / maxTag) * 100}%`, background: tagOf(k)?.kind === 'green' ? 'var(--sage)' : 'var(--rose)' }} /></div>
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
  const [open, setOpen] = useState(true)
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
    ...splitWords(c.softAvoidWords).map((w) => ({ k: 'sw' + w, cls: 'amber', text: `Would rather not: "${w}"` }))
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
      <div className="stat">
        <div className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>What I am looking for</h4>
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
      </div>

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
          const reasons = r.reasons.filter((x) => !x.dup)
          return (
            <div key={p.id} className="verdict" style={{ '--edge': `var(--${v.tone})` }}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <h3 style={{ fontFamily: 'var(--display)', fontSize: 21, margin: 0 }}>{p.name || 'Unnamed'}</h3>
                <span className="status">{v.label}</span>
              </div>
              <div className="meta" style={{ color: 'var(--stone)', fontSize: 13, marginTop: 2 }}>
                Fit {r.score} of 100 · {r.confidence} confidence · {r.dateCount} date{r.dateCount === 1 ? '' : 's'} logged
              </div>
              <FlagList flags={r.flags} />
              {r.penalty > 0 && (
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  "Would rather not" flags lowered the score from {r.baseScore} to {r.score}.
                </p>
              )}
              <ul className="why">
                {reasons.slice(0, 6).map((x, i) => (
                  <li key={i} className={x.kind}>{x.text}</li>
                ))}
              </ul>
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

/* ---------- root ---------- */

const TABS = [
  { id: 'roster', label: 'People', icon: Users, sub: 'Everyone you are talking to' },
  { id: 'dates', label: 'Dates', icon: CalendarHeart, sub: 'Your date history' },
  { id: 'fit', label: 'Fit', icon: Scale, sub: 'Do they match what you want?' },
  { id: 'insights', label: 'Insights', icon: BarChart3, sub: 'Patterns over time' }
]

export default function App() {
  const store = useStore()
  const { data } = store
  const [tab, setTab] = useState('roster')
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

  const fabLabel = tab === 'dates' ? 'Log date' : 'Add match'
  const onFab = () =>
    setSheet(tab === 'dates' ? { type: 'date' } : { type: 'quick' })

  return (
    <div className="app">
      <header className="top">
        <h1>{current.label}</h1>
        <p>{current.sub}</p>
      </header>

      <main className="scroll">
        {tab === 'roster' && <People people={data.people} dates={data.dates} store={store} onOpen={(id) => setSheet({ type: 'person', personId: id })} />}
        {tab === 'dates' && <DateLog people={data.people} dates={data.dates} onEdit={(d) => setSheet({ type: 'date', date: d })} />}
        {tab === 'fit' && <Fit data={data} store={store} onOpen={(id) => setSheet({ type: 'person', personId: id })} />}
        {tab === 'insights' && <Insights data={data} store={store} />}
      </main>

      {tab !== 'insights' && tab !== 'fit' && (
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
        />
      )}

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
