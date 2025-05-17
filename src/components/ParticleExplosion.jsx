import React, { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const TOTAL_PARTICLES = 5000
const NUM_BANDS = 16
const PARTICLES_PER_BAND = TOTAL_PARTICLES / NUM_BANDS
const FREQUENCY_BINS = 256
const BAND_WIDTH = FREQUENCY_BINS / NUM_BANDS

export default function ParticleExplosion({ analyserRef, dataArrayRef }) {
  const meshRef = useRef()
  const positions = useRef(new Float32Array(TOTAL_PARTICLES * 3))
  const angles = useRef(new Float32Array(TOTAL_PARTICLES))
  const radius = useRef(new Float32Array(TOTAL_PARTICLES))
  const baseSpeed = useRef(new Float32Array(TOTAL_PARTICLES))
  const currentSpeed = useRef(new Float32Array(TOTAL_PARTICLES))
  const bands = useRef(new Uint8Array(TOTAL_PARTICLES)) // 0–15

  useEffect(() => {
    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      angles.current[i] = Math.random() * Math.PI * 2

      // 🔢 Banda 0–15
      const band = Math.floor(i / PARTICLES_PER_BAND)
      bands.current[i] = band

      // 🎯 Raggio sfumato per banda (da 1 a 9)
      const baseRadius = 1 + (band / (NUM_BANDS - 1)) * 8 // 1–9
      const r = baseRadius + (Math.random() - 0.5) * 1.5 // sfumatura morbida
      radius.current[i] = r

      // 🐢 Velocità iniziale molto lenta
      const speed = 0.0002 + Math.random() * 0.0002
      baseSpeed.current[i] = speed
      currentSpeed.current[i] = speed
    }
  }, [])

  useFrame(() => {
    if (!analyserRef.current || !dataArrayRef.current || !meshRef.current) return

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const data = dataArrayRef.current

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const i3 = i * 3
      const band = bands.current[i]

      // 🎚️ Calcolo media dell’intensità della banda specifica
      const start = Math.floor(band * BAND_WIDTH)
      const end = Math.floor(start + BAND_WIDTH)
      const slice = data.slice(start, end)
      const intensity = slice.reduce((a, b) => a + b, 0) / slice.length / 255

      // ⚡ Spinta con intensità audio
      const boost = intensity * 0.0005
      currentSpeed.current[i] += boost

      // 🧘 Damping
      currentSpeed.current[i] *= 0.98

      // 🔁 Orbita
      angles.current[i] += currentSpeed.current[i]

      // ⭕ Raggio con max 10% variazione
      const r = radius.current[i] * (1 + intensity * 0.1)
      const angle = angles.current[i]

      positions.current[i3 + 0] = Math.cos(angle) * r
      positions.current[i3 + 1] = Math.sin(angle) * r
      positions.current[i3 + 2] = Math.sin(angle * 0.5) * r * 0.3
    }

    meshRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={TOTAL_PARTICLES}
          array={positions.current}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="black" size={0.08} sizeAttenuation />
    </points>
  )
}
