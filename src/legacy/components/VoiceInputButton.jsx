import { useRef, useState, useEffect } from 'react'

const SpeechRecognitionAPI = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

// Кнопка-микрофон для диктовки. Поддерживается в Chrome/Yandex Browser (Chromium).
// onResult получает распознанный текст при каждой финальной фразе — вызывающий
// компонент сам решает, добавить его в конец поля или заменить.
export default function VoiceInputButton({ onResult, lang = 'ru-RU' }) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  if (!SpeechRecognitionAPI) return null

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript)
        .join(' ')
      if (transcript.trim()) onResult(transcript.trim())
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  return (
    <button
      type="button"
      className={listening ? 'voice-btn listening' : 'voice-btn'}
      onClick={toggle}
      title={listening ? 'Остановить запись' : 'Диктовка голосом'}
    >
      {listening ? '● Слушаю…' : '🎤'}
    </button>
  )
}
