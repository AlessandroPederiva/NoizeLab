// src/components/WaveformField.jsx
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const NUM_LINES       = 32
const POINTS_PER_LINE = 64
const WIDTH           = 12
const VERTICAL_SCALE  = 4
const BASE_AMPLITUDE  = 0.3
const MIN_AMPLITUDE   = 0.05  // Aggiungiamo un'ampiezza minima per garantire visibilità

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

  const hzToBin = hz => Math.floor(hz / (sampleRate / fftSize))

  function getBandIntensity(data, bandIndex) {
    const [minHz, maxHz] = freqBands[bandIndex]
    const startBin = hzToBin(minHz)
    const endBin   = Math.max(startBin + 1, hzToBin(maxHz))  // Garantiamo almeno 1 bin di differenza
    
    // Assicuriamoci che la slice contenga almeno un elemento
    const slice    = data.slice(startBin, endBin)
    
    // Se la slice è vuota o troppo piccola, restituiamo un valore minimo
    if (slice.length === 0 || slice.every(v => v < 10)) {
      return MIN_AMPLITUDE / BASE_AMPLITUDE  // Garantiamo un valore minimo
    }
    
    const avg      = slice.reduce((sum, v) => sum + v, 0) / slice.length
    return Math.max(avg / 255, MIN_AMPLITUDE / BASE_AMPLITUDE)  // Garantiamo un valore minimo
  }

  useFrame(({ clock }) => {
    if (!analyserRef.current || !dataArrayRef.current) return
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const data = dataArrayRef.current
    const t    = clock.getElapsedTime()

    for (let i = 0; i < NUM_LINES; i++) {
      const line = lineRefs.current[i]
      if (!line) continue

      const arr       = line.geometry.attributes.position.array
      const intensity = getBandIntensity(data, i)
      // Garantiamo un'ampiezza minima per ogni banda
      const amp       = BASE_AMPLITUDE * intensity

      const tt      = (i + 0.5) / NUM_LINES
      const yOffset = (tt * 2 - 1) * VERTICAL_SCALE

      for (let j = 0; j < POINTS_PER_LINE; j++) {
        const x   = (j / (POINTS_PER_LINE - 1)) * WIDTH - WIDTH / 2
        const y   = yOffset + Math.sin(j * 0.3 + t * 2) * amp
        const idx = j * 3
        arr[idx + 0] = x
        arr[idx + 1] = y
        arr[idx + 2] = 0
      }

      line.geometry.attributes.position.needsUpdate = true
    }
  })

  const lines = useMemo(() => {
    return Array.from({ length: NUM_LINES }, () => {
      const positions = new Float32Array(POINTS_PER_LINE * 3)
      const geom      = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity)
      const mat       = new THREE.LineBasicMaterial({ color: 'black' })
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
