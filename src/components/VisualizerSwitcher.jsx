import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import FrequencyField from './FrequencyField'
import ParticleExplosion from './ParticleExplosion'
import WaveformField from './WaveformField'
import SquareField from './SquareField'

export default function VisualizerSwitcher({ mode, analyserRef, dataArrayRef }) {
  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
      <color attach="background" args={['white']} />
      <ambientLight intensity={0.5} />

      {mode === 'frequency' && (
        <FrequencyField analyserRef={analyserRef} dataArrayRef={dataArrayRef} />
      )}

      {mode === 'particles' && (
        <ParticleExplosion analyserRef={analyserRef} dataArrayRef={dataArrayRef} />
      )}

      {mode === 'waveform' && (
        <WaveformField analyserRef={analyserRef} dataArrayRef={dataArrayRef} />
      )}

      {mode === 'square' && (
        <SquareField analyserRef={analyserRef} dataArrayRef={dataArrayRef} />
      )}

      <OrbitControls enableZoom={true} enableRotate={true} autoRotate={false} />
    </Canvas>
  )
}
