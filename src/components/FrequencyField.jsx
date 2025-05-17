import React, { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const LINE_COUNT = 32
const POINTS_PER_LINE = 48
const startY = 4
const sampleRate = 44100

function freqToBin(freq, fftSize = 2048, sampleRate = 44100) {
  return Math.floor((freq / sampleRate) * fftSize)
}

const freqBands = [
  [20, 25], [25, 31], [31, 39], [39, 50], [50, 63], [63, 78], [78, 100], [100, 125],
  [125, 157], [157, 200], [200, 250], [250, 315], [315, 400], [400, 500], [500, 630], [630, 800],
  [800, 1000], [1000, 1250], [1250, 1600], [1600, 2000], [2000, 2500], [2500, 3150],
  [3150, 4000], [4000, 5000], [5000, 6300], [6300, 8000], [8000, 10000],
  [10000, 12500], [12500, 16000], [16000, 18000], [18000, 19500], [19500, 20000]
]

export default function FrequencyField({ audioRef }) {
  const lines = useRef([])
  const analyserRef = useRef()
  const dataArrayRef = useRef()

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
  }, [audioRef])

  const spacing = 0.55
  const lineMeshes = useMemo(() => {
    const group = []
    for (let i = 0; i < LINE_COUNT; i++) {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(POINTS_PER_LINE * 3)

      for (let j = 0; j < POINTS_PER_LINE; j++) {
        const y = startY - (j / (POINTS_PER_LINE - 1)) * 8
        positions[j * 3 + 0] = 0
        positions[j * 3 + 1] = y
        positions[j * 3 + 2] = 0
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.LineBasicMaterial({ color: 'black', transparent: true, opacity: 0.8 })
      const line = new THREE.Line(geometry, material)
      line.position.x = (i - LINE_COUNT / 2) * spacing
      group.push(line)
    }
    return group
  }, [])

  useEffect(() => {
    lines.current = lineMeshes
  }, [lineMeshes])

  const topLine = useRef()

  useFrame(() => {
    if (!analyserRef.current || !dataArrayRef.current) return
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const data = dataArrayRef.current

    const topPositions = new Float32Array(LINE_COUNT * 3)

    for (let i = 0; i < LINE_COUNT; i++) {
      const [low, high] = freqBands[i]
      const lowBin = freqToBin(low)
      const highBin = freqToBin(high)

      const bandData = data.slice(lowBin, highBin + 1)
      const bandValue = bandData.reduce((sum, v) => sum + v, 0) / bandData.length / 255

      const line = lines.current[i]
      const pos = line.geometry.attributes.position.array
      const x = (i - LINE_COUNT / 2) * spacing

      // Punto superiore statico
      pos[0] = 0
      pos[1] = startY
      pos[2] = 0

      topPositions[i * 3 + 0] = x
      topPositions[i * 3 + 1] = startY
      topPositions[i * 3 + 2] = 0

      for (let j = 1; j < POINTS_PER_LINE; j++) {
        const y = startY - (j / (POINTS_PER_LINE - 1)) * 8
        const strength = j / (POINTS_PER_LINE - 1)
        const moveX = bandValue * 0.6 * strength * Math.sin(j * 0.3 + i * 0.05)
        const moveZ = bandValue * 0.6 * strength * Math.cos(j * 0.25 + i * 0.07)

        pos[j * 3 + 0] = moveX
        pos[j * 3 + 1] = y
        pos[j * 3 + 2] = moveZ
      }

      line.geometry.attributes.position.needsUpdate = true
    }

    topLine.current.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(topPositions, 3)
    )
  })

  return (
    <group>
      {lineMeshes.map((line, i) => (
        <primitive object={line} key={i} />
      ))}
      <line ref={topLine}>
        <bufferGeometry />
        <lineBasicMaterial color="black" transparent opacity={0.4} />
      </line>
    </group>
  )
}
