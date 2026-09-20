import { useMemo, useRef, useState } from 'react'
import {
  Users, BookHeart, CalendarHeart, BarChart3, Plus, X, Mic, Square,
  Star, Trash2, Archive, ArchiveRestore, Download, Upload, Check, Scale
} from 'lucide-react'
import {
  useStore, STATUSES, TAGS, agoLabel, daysSince, fmtDate
} from './store.js'
import { useSpeech, summarizeToBullets } from './useSpeech.js'
import { TRAITS, PRIORITY, VERDICT, evaluate, hasCriteria } from './fit.js'
import { buildModel, adjustedWeight, MIN_FEEDBACK } from './learn.js'

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
  const [status, setStatus] = useState('texting')
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
      <span className="lbl">Status</span>
      <div className="tagpick" style={{ marginBottom: 18 }}>
        {STATUSES.map((s) => (
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
      <button className="btn primary" onClick={save}>Add to roster</button>
    </Sheet>
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
      <span className="lbl">Status</span>
      <div className="tagpick" style={{ marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="green"
            aria-pressed={person.status === s.id}
            onClick={() => set({ status: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>

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

      <div className="section">Contact</div>
      <p className="hint" style={{ margin: '0 0 8px' }}>Last contact: {agoLabel(person.lastContact)}</p>
      <div className="btnrow">
        <button className="btn ghost" onClick={() => set({ lastContact: new Date().toISOString() })}>
          <Check size={18} /> We talked today
        </button>
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
            <option key={p.id} value={p.id}>{p.name || 'Unnamed'}</option>
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

function Roster({ people, onOpen }) {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('contact')

  const list = useMemo(() => {
    let l = people.filter((p) => !p.archived)
    if (filter !== 'all') l = l.filter((p) => p.status === filter)
    if (sort === 'contact') {
      l = [...l].sort((a, b) => new Date(a.lastContact) - new Date(b.lastContact))
    } else if (sort === 'name') {
      l = [...l].sort((a, b) => a.name.localeCompare(b.name))
    } else {
      l = [...l].sort((a, b) => new Date(b.created) - new Date(a.created))
    }
    return l
  }, [people, filter, sort])

  return (
    <>
      <div className="filters" role="group" aria-label="Filter by status">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
        {STATUSES.map((s) => (
          <button key={s.id} className="chip" aria-pressed={filter === s.id} onClick={() => setFilter(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="sortrow">
        Sort by
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort order">
          <option value="contact">Longest since contact</option>
          <option value="recent">Newest match</option>
          <option value="name">Name</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <h3>{people.filter((p) => !p.archived).length === 0 ? 'Your roster is empty' : 'No one matches this filter'}</h3>
          <p>Tap Add match to log someone in under ten seconds.</p>
        </div>
      ) : (
        list.map((p) => {
          const s = statusOf(p.status)
          const d = daysSince(p.lastContact)
          const due = d !== null && d >= 3
          return (
            <button key={p.id} className="person" style={{ '--edge': s.color }} onClick={() => onOpen(p.id)}>
              <div className="row">
                <h3>{p.name || 'Unnamed'}</h3>
                <span className="status">{s.label}</span>
              </div>
              <div className="meta">
                {[p.age && `${p.age}`, p.job, p.met && `via ${p.met}`].filter(Boolean).join(', ') || 'No details yet'}
              </div>
              {p.tags.length > 0 && (
                <div className="mini">
                  {p.tags.slice(0, 4).map((id) => {
                    const t = tagOf(id)
                    return t ? <span key={id} className={'tag ' + t.kind}>{t.label}</span> : null
                  })}
                </div>
              )}
              <div className={'reply' + (due ? ' due' : '')}>
                Last contact {agoLabel(p.lastContact)}
                {due ? ', maybe reply?' : ''}
              </div>
            </button>
          )
        })
      )}
    </>
  )
}

function CRM({ people, onOpen, store }) {
  const archived = people.filter((p) => p.archived)
  const [q, setQ] = useState('')
  const active = people
    .filter((p) => !p.archived)
    .filter((p) => (p.name + p.job + p.met).toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <input className="in" placeholder="Search profiles" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search profiles" style={{ marginBottom: 14 }} />
      {active.length === 0 && (
        <div className="empty"><h3>No profiles found</h3><p>Add someone with the Add match button.</p></div>
      )}
      {active.map((p) => (
        <button key={p.id} className="person" style={{ '--edge': statusOf(p.status).color }} onClick={() => onOpen(p.id)}>
          <div className="row">
            <h3>{p.name || 'Unnamed'}</h3>
            <span className="meta">{p.location}</span>
          </div>
          {p.notes.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14 }}>
              {p.notes.slice(0, 3).map((n, i) => <li key={i}>{n}</li>)}
              {p.notes.length > 3 && <li className="hint">+{p.notes.length - 3} more</li>}
            </ul>
          )}
          <div className="mini">
            {p.tags.map((id) => {
              const t = tagOf(id)
              return t ? <span key={id} className={'tag ' + t.kind}>{t.label}</span> : null
            })}
          </div>
        </button>
      ))}

      {archived.length > 0 && (
        <>
          <div className="section">Archived</div>
          {archived.map((p) => (
            <div key={p.id} className="person" style={{ '--edge': 'var(--line)' }}>
              <div className="row">
                <h3>{p.name || 'Unnamed'}</h3>
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
          <div><div className="bignum">{people.filter((p) => !p.archived).length}</div><div className="hint">active people</div></div>
          <div><div className="bignum">{dates.length}</div><div className="hint">dates logged</div></div>
        </div>
      </div>

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
                deal-breaker.
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

/* ---------- fit tab ---------- */

const RED_DEAL_TAGS = TAGS.filter((t) => t.kind === 'red')

function Fit({ data, store, onOpen }) {
  const { people, dates, criteria } = data
  const [editing, setEditing] = useState(() => !hasCriteria(criteria))
  const wantVoice = useSpeech((t) =>
    store.setCriteria({ note: (criteria.note ? criteria.note + ' ' : '') + t })
  )

  const setPri = (id, pri) => {
    const next = { ...criteria.wants }
    if (next[id] === pri) delete next[id]
    else next[id] = pri
    store.setCriteria({ wants: next })
  }
  const toggleDeal = (id) => {
    const cur = criteria.dealTags
    store.setCriteria({ dealTags: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }

  const active = people.filter((p) => !p.archived)
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
              For each quality, tap once for Must have, again to switch level. Tap the same level again to clear it.
              Deal-breaker means you want to avoid people who show the opposite.
            </p>
            {TRAITS.map((t) => (
              <div key={t.id} style={{ marginBottom: 12 }}>
                <span className="lbl" style={{ marginBottom: 6 }}>{t.label}</span>
                <div className="tagpick">
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      className={k === 'dealbreaker' ? 'red' : 'green'}
                      aria-pressed={criteria.wants[t.id] === k}
                      onClick={() => setPri(t.id, k)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="section" style={{ marginTop: 18 }}>Automatic deal-breakers</div>
            <p className="hint" style={{ margin: '0 0 8px' }}>If you tag someone with any of these, the app flags them.</p>
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

            <div className="section" style={{ marginTop: 18 }}>In your own words</div>
            <label className="field">
              <span>Words I want to see (comma separated)</span>
              <input
                className="in"
                placeholder="hiking, travel, faith, close family"
                value={criteria.wantWords}
                onChange={(e) => store.setCriteria({ wantWords: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Words I want to avoid (comma separated)</span>
              <input
                className="in"
                placeholder="smokes, still texts ex, never wants kids"
                value={criteria.avoidWords}
                onChange={(e) => store.setCriteria({ avoidWords: e.target.value })}
              />
            </label>
            <label className="field">
              <span>My description (for you, not used for scoring)</span>
              <textarea
                className="in"
                placeholder="What does a great partner look like for you?"
                value={criteria.note}
                onChange={(e) => store.setCriteria({ note: e.target.value })}
              />
            </label>
            {wantVoice.supported && (
              <button
                type="button"
                className={'btn rose ' + (wantVoice.listening ? 'pulse' : '')}
                onClick={wantVoice.listening ? wantVoice.stop : wantVoice.start}
              >
                {wantVoice.listening ? <Square size={18} /> : <Mic size={18} />}
                {wantVoice.listening ? 'Stop' : 'Speak it'}
              </button>
            )}
            {wantVoice.listening && <div className="live">{wantVoice.interim || 'Listening…'}</div>}
            {wantVoice.error && <div className="warn">{wantVoice.error}</div>}
            <button className="btn primary" style={{ marginTop: 14 }} onClick={() => setEditing(false)}>
              Save what I want
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            {Object.entries(criteria.wants).length > 0 && (
              <div className="mini">
                {Object.entries(criteria.wants).map(([id, pri]) => (
                  <span key={id} className={'tag ' + (pri === 'dealbreaker' ? 'red' : 'green')}>
                    {PRIORITY[pri].label}: {TRAITS.find((t) => t.id === id)?.label}
                  </span>
                ))}
              </div>
            )}
            {criteria.note && <p style={{ margin: '10px 0 0', fontSize: 14 }}>{criteria.note}</p>}
            {!ready && <p className="hint" style={{ margin: 0 }}>Tap Edit to say what you want.</p>}
          </div>
        )}
      </div>

      <LearnedPanel data={data} model={model} store={store} learning={learning} />

      {!ready ? (
        <div className="empty">
          <h3>Tell me what you want first</h3>
          <p>Pick a few qualities above. Then each person gets a clear call.</p>
        </div>
      ) : active.length === 0 ? (
        <div className="empty"><h3>No one to check yet</h3><p>Add someone from the Roster tab.</p></div>
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
              <ul className="why">
                {r.reasons.slice(0, 6).map((x, i) => (
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
  { id: 'roster', label: 'Roster', icon: Users, sub: 'Who is active right now' },
  { id: 'crm', label: 'Profiles', icon: BookHeart, sub: 'Details, flags, and notes' },
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
  const activePeople = data.people.filter((p) => !p.archived)

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
        {tab === 'roster' && <Roster people={data.people} onOpen={(id) => setSheet({ type: 'person', personId: id })} />}
        {tab === 'crm' && <CRM people={data.people} store={store} onOpen={(id) => setSheet({ type: 'person', personId: id })} />}
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
          people={activePeople}
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
