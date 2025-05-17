import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import FrequencyField from './FrequencyField'

export default function Visualizer({ audioRef }) {
  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
      <color attach="background" args={['white']} />
      <ambientLight intensity={0.5} />
      <FrequencyField audioRef={audioRef} />
      <OrbitControls enableZoom={true} enableRotate={false} autoRotate={false} />
    </Canvas>
  )
}
