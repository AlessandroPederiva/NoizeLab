import React, { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Line2, LineMaterial, LineGeometry } from '../utils/LineMaterialUtils'

const LINE_COUNT = 32
const POINTS_PER_LINE = 48
const startY = 4

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

export default function FrequencyField({ analyserRef, dataArrayRef }) {
  const lines = useRef([])

  const spacing = 0.55
  const lineMeshes = useMemo(() => {
    const group = []

    for (let i = 0; i < LINE_COUNT; i++) {
      const positions = []
      for (let j = 0; j < POINTS_PER_LINE; j++) {
        const y = startY - (j / (POINTS_PER_LINE - 1)) * 8
        positions.push(0, y, 0)
      }

      const geometry = new LineGeometry()
      geometry.setPositions(positions)

      const material = new LineMaterial({
        color: 0x000000,
        linewidth: 1.6,
        transparent: true,
        opacity: 1.0,
        depthTest: false
      })

      material.resolution.set(window.innerWidth, window.innerHeight)
      window.addEventListener('resize', () => {
        material.resolution.set(window.innerWidth, window.innerHeight)
      })

      const line = new Line2(geometry, material)
      line.position.x = (i - LINE_COUNT / 2) * spacing
      line.computeLineDistances()
      group.push(line)
    }

    return group
  }, [])

  useEffect(() => {
    lines.current = lineMeshes
  }, [lineMeshes])

  useFrame(() => {
    if (!analyserRef.current || !dataArrayRef.current) return
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const data = dataArrayRef.current

    lines.current.forEach((line, i) => {
      const [low, high] = freqBands[i]
      const lowBin = freqToBin(low)
      const highBin = freqToBin(high)
      const bandData = data.slice(lowBin, highBin + 1)
      let bandValue = bandData.reduce((sum, v) => sum + v, 0) / bandData.length / 255
      bandValue = Math.pow(bandValue, 0.6)

      const minLineWidth = 1.6
      const maxLineWidth = 19.0
      const curvedWidth = minLineWidth + bandValue * (maxLineWidth - minLineWidth)

      line.material.linewidth = curvedWidth
      line.material.resolution.set(window.innerWidth, window.innerHeight)

      const positions = []
      for (let j = 0; j < POINTS_PER_LINE; j++) {
        const y = startY - (j / (POINTS_PER_LINE - 1)) * 8
        const strength = j / (POINTS_PER_LINE - 1)
        const moveX = bandValue * 0.6 * strength * Math.sin(j * 0.3 + i * 0.05)
        const moveZ = bandValue * 0.6 * strength * Math.cos(j * 0.25 + i * 0.07)
        positions.push(moveX, y, moveZ)
      }

      line.geometry.setPositions(positions)
      line.geometry.attributes.position.needsUpdate = true
    })
  })

  return (
    <group>
      {lineMeshes.map((line, i) => (
        <primitive object={line} key={i} />
      ))}
    </group>
  )
}
