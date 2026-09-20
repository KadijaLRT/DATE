import { useCallback, useEffect, useRef, useState } from 'react'

const SR =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export const speechSupported = Boolean(SR)

// Calls onFinal(text) whenever the browser finalizes a phrase.
export function useSpeech(onFinal) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const recRef = useRef(null)
  const cbRef = useRef(onFinal)
  useEffect(() => {
    cbRef.current = onFinal
  }, [onFinal])

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!SR) return
    setError('')
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = navigator.language || 'en-US'
    rec.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) cbRef.current(r[0].transcript.trim())
        else live += r[0].transcript
      }
      setInterim(live)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access is blocked. Allow it in your browser settings.')
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError('Voice input stopped: ' + e.error)
      }
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [])

  useEffect(() => () => recRef.current?.abort(), [])

  return { listening, interim, error, start, stop, supported: speechSupported }
}

// Turns a rambling transcript into short bullet points, on-device.
export function summarizeToBullets(text) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const parts = clean
    .split(/(?<=[.!?])\s+|\s+(?:and then|also|but then)\s+/i)
    .map((s) => s.trim().replace(/^[,;\s]+|[,;\s]+$/g, ''))
    .filter((s) => s.length > 3)
  return parts.map((s) => {
    const t = s.charAt(0).toUpperCase() + s.slice(1)
    return t.replace(/[.!?]+$/, '')
  })
}
