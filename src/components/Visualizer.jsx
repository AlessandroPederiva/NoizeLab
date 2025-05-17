import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import FrequencyField from './FrequencyField'

export default function Visualizer({ audioRef }) {
  return (
    <Canvas camera={{ position: [0, 2, 10], fov: 60 }}>
      <color attach="background" args={['#000010']} />
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={2} />
      <FrequencyField audioRef={audioRef} />
      <OrbitControls autoRotate autoRotateSpeed={0.2} enableZoom={false} />
    </Canvas>
  )
}
