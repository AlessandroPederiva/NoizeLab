import React, { useState, useRef, useEffect } from 'react'
import VisualizerSwitcher from './components/VisualizerSwitcher'

function App() {
  const [audioUrl, setAudioUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [visualMode, setVisualMode] = useState('frequency')
  const audioRef = useRef(null)
  const analyserRef = useRef(null)
  const dataArrayRef = useRef(null)

  useEffect(() => {
    if (!audioRef.current) return

    const ctx = new AudioContext()
    const src = ctx.createMediaElementSource(audioRef.current)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    src.connect(analyser)
    analyser.connect(ctx.destination)

    const data = new Uint8Array(analyser.frequencyBinCount)
    analyserRef.current = analyser
    dataArrayRef.current = data

    return () => {
      src.disconnect()
      analyser.disconnect()
    }
  }, [audioUrl])

  const handleAudioUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setAudioUrl(url)
      setIsPlaying(false)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    isPlaying ? audioRef.current.pause() : audioRef.current.play()
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
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={togglePlay}>
                {isPlaying ? '⏸ Pausa' : '▶️ Play'}
              </button>
              <button onClick={() => skip(-5)}>⏪ -5s</button>
              <button onClick={() => skip(5)}>⏩ +5s</button>
              <button onClick={restart}>🔁 Restart</button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setVisualMode('frequency')}>🎛 Frequency</button>
              <button onClick={() => setVisualMode('particles')}>💥 Particles</button>
            </div>
          </div>

          <VisualizerSwitcher
            mode={visualMode}
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
          />
        </>
      )}
    </div>
  )
}

export default App
