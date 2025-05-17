import React, { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function ParticleExplosion({ analyserRef, dataArrayRef }) {
  const meshRef = useRef()
  const particleCount = 500
  const positions = useRef(new Float32Array(particleCount * 3))

  useEffect(() => {
    for (let i = 0; i < particleCount * 3; i++) {
      positions.current[i] = (Math.random() - 0.5) * 10
    }
  }, [])

  useFrame(() => {
    if (!analyserRef.current || !dataArrayRef.current) return
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const data = dataArrayRef.current
    const avg = data.reduce((a, b) => a + b) / data.length / 255

    const scale = 1 + avg * 5
    meshRef.current.scale.set(scale, scale, scale)
    meshRef.current.rotation.y += 0.002 + avg * 0.05
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions.current}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="black" size={0.05} sizeAttenuation />
    </points>
  )
}
