// src/components/WaveformField.jsx
import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const NUM_LINES       = 32
const POINTS_PER_LINE = 128  // Aumentato per maggiore dettaglio
const WIDTH           = 12
const VERTICAL_SCALE  = 4
const BASE_AMPLITUDE  = 0.3
const MIN_AMPLITUDE   = 0.05
const SMOOTHING       = 0.8  // Fattore di smoothing per transizioni più fluide

// Colori per effetto gradiente basato sull'intensità
const LOW_COLOR = new THREE.Color('#3498db')    // Blu per basse intensità
const MID_COLOR = new THREE.Color('#9b59b6')    // Viola per medie intensità
const HIGH_COLOR = new THREE.Color('#e74c3c')   // Rosso per alte intensità

const freqBands = [
  [20,25],[25,31],[31,39],[39,50],[50,63],[63,78],[78,100],[100,125],
  [125,157],[157,200],[200,250],[250,315],[315,400],[400,500],[500,630],[630,800],
  [800,1000],[1000,1250],[1250,1600],[1600,2000],[2000,2500],[2500,3150],
  [3150,4000],[4000,5000],[5000,6300],[6300,8000],[8000,10000],
  [10000,12500],[12500,16000],[16000,18000],[18000,19500],[19500,20000]
]

export default function WaveformField({
  analyserRef,
  dataArrayRef,
  sampleRate = 44100,
  fftSize     = 2048
}) {
  const lineRefs = useRef([])
  const hasAudioRef = useRef(false)
  const prevIntensitiesRef = useRef(Array(NUM_LINES).fill(0))
  const peakIntensitiesRef = useRef(Array(NUM_LINES).fill(0))
  const peakDecayRef = useRef(0.98) // Fattore di decadimento dei picchi

  const hzToBin = hz => Math.floor(hz / (sampleRate / fftSize))

  // Funzione migliorata per calcolare l'intensità delle bande
  function getBandIntensity(data, bandIndex) {
    const [minHz, maxHz] = freqBands[bandIndex]
    const startBin = hzToBin(minHz)
    const endBin   = Math.max(startBin + 1, hzToBin(maxHz))
    
    // Assicuriamoci che la slice contenga almeno un elemento
    const slice = data.slice(startBin, endBin)
    
    // Se la slice è vuota o troppo piccola, restituiamo un valore minimo
    if (slice.length === 0 || slice.every(v => v < 10)) {
      return MIN_AMPLITUDE / BASE_AMPLITUDE
    }
    
    // Calcolo migliorato dell'intensità con enfasi sui picchi
    const max = Math.max(...slice)
    const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length
    // Combiniamo media e massimo per una risposta più dinamica
    const combined = (max * 0.7 + avg * 0.3) / 255
    
    // Applichiamo smoothing con il valore precedente
    const prevIntensity = prevIntensitiesRef.current[bandIndex]
    const smoothedIntensity = prevIntensity * SMOOTHING + combined * (1 - SMOOTHING)
    prevIntensitiesRef.current[bandIndex] = smoothedIntensity
    
    // Aggiorniamo il valore di picco se necessario
    if (smoothedIntensity > peakIntensitiesRef.current[bandIndex]) {
      peakIntensitiesRef.current[bandIndex] = smoothedIntensity
    } else {
      // Altrimenti applichiamo il decadimento
      peakIntensitiesRef.current[bandIndex] *= peakDecayRef.current
    }
    
    return Math.max(smoothedIntensity, MIN_AMPLITUDE / BASE_AMPLITUDE)
  }

  function checkIfAudioIsPlaying(data) {
    // Verifica migliorata per rilevare l'audio attivo
    const threshold = 5
    const significantValues = data.filter(value => value > threshold)
    return significantValues.length > NUM_LINES / 4 // Almeno 1/4 delle bande deve avere segnale
  }

  // Funzione per calcolare il colore in base all'intensità
  function getColorForIntensity(intensity) {
    if (intensity < 0.3) {
      // Da LOW a MID
      const t = intensity / 0.3
      return LOW_COLOR.clone().lerp(MID_COLOR, t)
    } else {
      // Da MID a HIGH
      const t = (intensity - 0.3) / 0.7
      return MID_COLOR.clone().lerp(HIGH_COLOR, t)
    }
  }

  useFrame(({ clock }) => {
    if (!analyserRef.current || !dataArrayRef.current) return
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const data = dataArrayRef.current
    const t = clock.getElapsedTime()
    
    // Verifica se c'è audio in riproduzione
    hasAudioRef.current = checkIfAudioIsPlaying(data)
    
    // Se non c'è audio, mantieni le linee nella posizione base senza animazione
    if (!hasAudioRef.current) {
      for (let i = 0; i < NUM_LINES; i++) {
        const line = lineRefs.current[i]
        if (!line) continue

        const arr = line.geometry.attributes.position.array
        const tt = (i + 0.5) / NUM_LINES
        const yOffset = (tt * 2 - 1) * VERTICAL_SCALE

        for (let j = 0; j < POINTS_PER_LINE; j++) {
          const x = (j / (POINTS_PER_LINE - 1)) * WIDTH - WIDTH / 2
          const y = yOffset // Linea piatta quando non c'è audio
          const idx = j * 3
          arr[idx + 0] = x
          arr[idx + 1] = y
          arr[idx + 2] = 0
        }

        // Ripristina il colore base quando non c'è audio
        line.material.color = LOW_COLOR.clone()
        line.geometry.attributes.position.needsUpdate = true
      }
      return
    }
    
    // Se c'è audio, anima le linee in base alle frequenze
    for (let i = 0; i < NUM_LINES; i++) {
      const line = lineRefs.current[i]
      if (!line) continue

      const arr = line.geometry.attributes.position.array
      const intensity = getBandIntensity(data, i)
      const peakIntensity = peakIntensitiesRef.current[i]
      
      // Ampiezza basata sull'intensità corrente
      const amp = BASE_AMPLITUDE * intensity * 1.5 // Amplificato per maggiore visibilità
      
      const tt = (i + 0.5) / NUM_LINES
      const yOffset = (tt * 2 - 1) * VERTICAL_SCALE

      // Forma d'onda più complessa e reattiva
      for (let j = 0; j < POINTS_PER_LINE; j++) {
        const x = (j / (POINTS_PER_LINE - 1)) * WIDTH - WIDTH / 2
        
        // Usiamo una combinazione di funzioni sinusoidali per un effetto più interessante
        const phase = j * 0.3 + t * 2
        const wave1 = Math.sin(phase) * amp
        const wave2 = Math.sin(phase * 1.5) * amp * 0.3
        const wave3 = Math.sin(phase * 0.5) * amp * 0.2
        
        const y = yOffset + wave1 + wave2 + wave3
        
        const idx = j * 3
        arr[idx + 0] = x
        arr[idx + 1] = y
        arr[idx + 2] = 0
      }

      // Aggiorna il colore in base all'intensità
      line.material.color = getColorForIntensity(intensity)
      
      // Aumenta lo spessore della linea in base all'intensità
      line.material.linewidth = 1 + intensity * 2
      
      line.geometry.attributes.position.needsUpdate = true
    }
  })

  const lines = useMemo(() => {
    return Array.from({ length: NUM_LINES }, () => {
      const positions = new Float32Array(POINTS_PER_LINE * 3)
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity)
      
      // Utilizziamo LineBasicMaterial per supportare il colore dinamico
      const mat = new THREE.LineBasicMaterial({ 
        color: LOW_COLOR.clone(),
        linewidth: 1,
        linecap: 'round',
        linejoin: 'round'
      })
      
      return { geometry: geom, material: mat }
    })
  }, [])

  return (
    <>
      {lines.map(({ geometry, material }, i) => (
        <line
          key={i}
          geometry={geometry}
          material={material}
          frustumCulled={false}
          ref={el => (lineRefs.current[i] = el)}
        />
      ))}
    </>
  )
}
