import React, { useState, useRef } from 'react'
import Visualizer from './components/Visualizer'

function App() {
  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)

  const handleAudioUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setAudioUrl(url)
      setAudioFile(file)
      setIsPlaying(false)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
    }
  }

  const skip = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds
    }
  }

  return (
    <div style={{ height: '100vh', width: '100vw', background: 'black', overflow: 'hidden' }}>
      {!audioUrl && (
        <div style={{ position: 'absolute', zIndex: 10, color: 'white', padding: '2rem' }}>
          <h1>NoizeLab</h1>
          <p>Carica un file audio per iniziare</p>
          <input type="file" accept="audio/*" onChange={handleAudioUpload} />
        </div>
      )}

      {audioUrl && (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            loop
            style={{ display: 'none' }}
          />
          <div style={{
            position: 'absolute',
            zIndex: 10,
            top: '1rem',
            left: '1rem',
            color: 'white',
            display: 'flex',
            gap: '1rem'
          }}>
            <button onClick={togglePlay}>
              {isPlaying ? '⏸ Pausa' : '▶️ Play'}
            </button>
            <button onClick={() => skip(-5)}>⏪ -5s</button>
            <button onClick={() => skip(5)}>⏩ +5s</button>
            <button onClick={restart}>🔁 Restart</button>
          </div>
          <Visualizer audioRef={audioRef} />
        </>
      )}
    </div>
  )
}

export default App
