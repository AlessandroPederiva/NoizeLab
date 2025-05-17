import React, { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const TOTAL_PARTICLES = 5000
const NUM_BANDS = 16
const FREQUENCY_BINS = 256
const bandRanges = []

// Bande logaritmiche
for (let i = 0; i < NUM_BANDS; i++) {
  const start = Math.floor(Math.pow(i / NUM_BANDS, 2) * FREQUENCY_BINS)
  const end = Math.floor(Math.pow((i + 1) / NUM_BANDS, 2) * FREQUENCY_BINS)
  bandRanges.push([start, end])
}

export default function ParticleExplosion({ analyserRef, dataArrayRef }) {
  const meshRef = useRef()
  const positions = useRef(new Float32Array(TOTAL_PARTICLES * 3))
  const angles = useRef(new Float32Array(TOTAL_PARTICLES))
  const radius = useRef(new Float32Array(TOTAL_PARTICLES))
  const baseSpeed = useRef(new Float32Array(TOTAL_PARTICLES))
  const currentSpeed = useRef(new Float32Array(TOTAL_PARTICLES))
  const bands = useRef(new Uint8Array(TOTAL_PARTICLES))

  useEffect(() => {
    // Distribuzione proporzionale alle aree
    const bandAreas = []
    for (let i = 0; i < NUM_BANDS; i++) {
      const r1 = 1 + (i / NUM_BANDS) * 8
      const r2 = 1 + ((i + 1) / NUM_BANDS) * 8
      const area = Math.PI * (r2 * r2 - r1 * r1)
      bandAreas.push(area)
    }

    const totalArea = bandAreas.reduce((a, b) => a + b, 0)
    const bandParticleCounts = bandAreas.map(area =>
      Math.round((area / totalArea) * TOTAL_PARTICLES)
    )

    let index = 0
    for (let band = 0; band < NUM_BANDS; band++) {
      const count = bandParticleCounts[band]
      for (let j = 0; j < count; j++) {
        if (index >= TOTAL_PARTICLES) break

        angles.current[index] = Math.random() * Math.PI * 2
        bands.current[index] = band

        const baseRadius = 1 + (band / (NUM_BANDS - 1)) * 8
        const isInsideBand = Math.random() < 0.88

        let r
        if (isInsideBand) {
          r = baseRadius + (Math.random() - 0.5) * 1.5
        } else {
          const otherBands = [...Array(NUM_BANDS).keys()].filter(b => b !== band)
          const randomOther = otherBands[Math.floor(Math.random() * otherBands.length)]
          const altBaseRadius = 1 + (randomOther / (NUM_BANDS - 1)) * 8
          r = altBaseRadius + (Math.random() - 0.5) * 1.5
        }

        radius.current[index] = r
        baseSpeed.current[index] = 0.00005 + Math.random() * 0.00005
        currentSpeed.current[index] = 0
        index++
      }
    }
  }, [])

  useFrame(() => {
    if (!analyserRef.current || !dataArrayRef.current || !meshRef.current) return

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const data = dataArrayRef.current

    const total = data.reduce((a, b) => a + b, 0)
    const avgVolume = total / data.length / 255
    const isAudioActive = avgVolume > 0.01

    // Raggio massimo dinamico
    const maxRadius = 10 + avgVolume * 2

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const i3 = i * 3
      const band = bands.current[i]
      const [start, end] = bandRanges[band]
      const slice = data.slice(start, end)
      const intensity = slice.length
        ? slice.reduce((a, b) => a + b, 0) / slice.length / 255
        : 0

      if (isAudioActive) {
        currentSpeed.current[i] += intensity * 0.001
      }

      currentSpeed.current[i] *= 0.92
      const speed = baseSpeed.current[i] + currentSpeed.current[i]
      angles.current[i] += speed

      // Calcolo raggio con limite massimo
      let r = radius.current[i] * (1 + intensity * 0.1)
      r = Math.min(r, maxRadius) // 🔒 Clamp dolce

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
