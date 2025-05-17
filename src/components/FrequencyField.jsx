import React, { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const LINE_COUNT = 16
const POINTS_PER_LINE = 48

export default function FrequencyField({ audioRef }) {
  const lines = useRef([])
  const analyserRef = useRef()
  const dataArrayRef = useRef()

  useEffect(() => {
    if (!audioRef.current) return

    const ctx = new AudioContext()
    const src = ctx.createMediaElementSource(audioRef.current)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512 // alta risoluzione
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

  const spacing = 0.8
  const lineMeshes = useMemo(() => {
    const group = []
    for (let i = 0; i < LINE_COUNT; i++) {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(POINTS_PER_LINE * 3)
      for (let j = 0; j < POINTS_PER_LINE; j++) {
        const y = (j / (POINTS_PER_LINE - 1)) * 8 - 4
        positions[j * 3] = 0
        positions[j * 3 + 1] = y
        positions[j * 3 + 2] = 0
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.LineBasicMaterial({ color: 'white', transparent: true, opacity: 0.8 })
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
  const bottomLine = useRef()

  useFrame(() => {
    if (!analyserRef.current || !dataArrayRef.current) return
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const data = dataArrayRef.current

    const getLogIndex = (i) => {
      const logIndex = Math.floor(
        Math.pow(i / LINE_COUNT, 2) * data.length
      )
      return Math.min(data.length - 1, Math.max(0, logIndex))
    }

    const topPositions = new Float32Array(LINE_COUNT * 3)
    const bottomPositions = new Float32Array(LINE_COUNT * 3)

    for (let i = 0; i < LINE_COUNT; i++) {
      const bandIndex = getLogIndex(i)
      const band = data[bandIndex] / 255
      const line = lines.current[i]
      const pos = line.geometry.attributes.position.array

      for (let j = 0; j < POINTS_PER_LINE; j++) {
        const y = (j / (POINTS_PER_LINE - 1)) * 8 - 4
        const movement = band * 0.8

        pos[j * 3] = movement * Math.sin(j * 0.2 + bandIndex * 0.1)
        pos[j * 3 + 1] = y
        pos[j * 3 + 2] = movement * Math.cos(j * 0.15 + bandIndex * 0.05)
      }

      line.geometry.attributes.position.needsUpdate = true

      // Top and bottom connectors
      const x = (i - LINE_COUNT / 2) * spacing
      topPositions[i * 3] = x + pos[(POINTS_PER_LINE - 1) * 3]
      topPositions[i * 3 + 1] = 4
      topPositions[i * 3 + 2] = pos[(POINTS_PER_LINE - 1) * 3 + 2]

      bottomPositions[i * 3] = x + pos[0]
      bottomPositions[i * 3 + 1] = -4
      bottomPositions[i * 3 + 2] = pos[2]
    }

    topLine.current.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(topPositions, 3)
    )
    bottomLine.current.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(bottomPositions, 3)
    )
  })

  return (
    <group>
      {lineMeshes.map((line, i) => (
        <primitive object={line} key={i} />
      ))}
      <line ref={topLine}>
        <bufferGeometry />
        <lineBasicMaterial color="white" transparent opacity={0.3} />
      </line>
      <line ref={bottomLine}>
        <bufferGeometry />
        <lineBasicMaterial color="white" transparent opacity={0.3} />
      </line>
    </group>
  )
}
