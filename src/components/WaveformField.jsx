// src/components/WaveformField.jsx
import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const NUM_LINES = 32
const HISTORY_POINTS = 200  // Numero di punti nella storia temporale
const WIDTH = 12
const VERTICAL_SCALE = 4
const LINE_WIDTH = 6  // Spessore triplicato delle linee
const SCROLL_SPEED = 0.05  // Velocità di scorrimento
const GLOW_INTENSITY = 0.8  // Intensità dell'effetto glow
const AREA_OPACITY = 0.15   // Opacità dell'area sotto le linee

// Colore nero per le linee
const LINE_COLOR = new THREE.Color('#000000')

// Palette di colori per il glow e le aree
const LOW_COLOR = new THREE.Color('#00bcd4')    // Ciano per basse intensità
const MID_COLOR = new THREE.Color('#9c27b0')    // Viola per medie intensità
const HIGH_COLOR = new THREE.Color('#ff1744')   // Rosso acceso per alte intensità

// Fattori di bilanciamento per le diverse gamme di frequenze
const FREQ_BALANCE = {
  low: 0.7,      // Riduce leggermente le basse frequenze (0-500 Hz)
  mid: 1.2,      // Amplifica le medie frequenze (500-2000 Hz)
  high: 1.5      // Amplifica maggiormente le alte frequenze (2000+ Hz)
}

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
  fftSize = 2048
}) {
  const lineRefs = useRef([])
  const areaRefs = useRef([])  // Riferimenti per le aree sotto le linee
  const hasAudioRef = useRef(false)
  
  // Buffer per la storia temporale di ogni banda
  const historyBuffersRef = useRef(
    Array(NUM_LINES).fill().map(() => Array(HISTORY_POINTS).fill(0))
  )
  
  // Buffer per i valori di picco
  const peakValuesRef = useRef(Array(NUM_LINES).fill(0))
  const peakDecayRef = useRef(0.98)

  const hzToBin = hz => Math.floor(hz / (sampleRate / fftSize))

  // Funzione per ottenere il fattore di bilanciamento in base alla banda di frequenza
  function getFrequencyBalanceFactor(bandIndex) {
    const [minHz, maxHz] = freqBands[bandIndex]
    const centerFreq = (minHz + maxHz) / 2
    
    if (centerFreq < 500) {
      return FREQ_BALANCE.low
    } else if (centerFreq < 2000) {
      return FREQ_BALANCE.mid
    } else {
      return FREQ_BALANCE.high
    }
  }

  // Funzione migliorata per calcolare l'intensità di una banda di frequenza
  function getBandIntensity(data, bandIndex) {
    const [minHz, maxHz] = freqBands[bandIndex]
    const startBin = hzToBin(minHz)
    const endBin = Math.max(startBin + 1, hzToBin(maxHz))
    
    // Assicuriamoci che la slice contenga almeno un elemento
    const slice = data.slice(startBin, endBin)
    
    // Se la slice è vuota o troppo piccola, restituiamo zero
    if (slice.length === 0 || slice.every(v => v < 5)) {
      return 0
    }
    
    // Calcolo dell'intensità con enfasi sui picchi per maggiore precisione
    const max = Math.max(...slice)
    const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length
    // Combiniamo media e massimo per una risposta più dinamica
    const rawIntensity = (max * 0.7 + avg * 0.3) / 255
    
    // Applichiamo il fattore di bilanciamento in base alla banda di frequenza
    const balanceFactor = getFrequencyBalanceFactor(bandIndex)
    return Math.min(1, rawIntensity * balanceFactor)
  }

  function checkIfAudioIsPlaying(data) {
    // Verifica se c'è audio in riproduzione
    const threshold = 5
    const significantValues = data.filter(value => value > threshold)
    return significantValues.length > NUM_LINES / 4 // Almeno 1/4 delle bande deve avere segnale
  }

  // Funzione per calcolare il colore in base all'intensità
  function getColorForIntensity(intensity) {
    if (intensity < 0.3) {
      // Da LOW a MID
      const t = intensity / 0.3
      return LOW_COLOR.clone().lerp(MID_COLOR, t)
    } else {
      // Da MID a HIGH
      const t = (intensity - 0.3) / 0.7
      return MID_COLOR.clone().lerp(HIGH_COLOR, t)
    }
  }
  
  // Funzione per creare un effetto glow
  function createGlowEffect(material, intensity) {
    // Aumenta la luminosità del colore per simulare il glow
    const color = material.color.clone()
    const hsl = {}
    color.getHSL(hsl)
    hsl.l = Math.min(1, hsl.l + intensity * 0.5)  // Aumenta la luminosità
    color.setHSL(hsl.h, hsl.s, hsl.l)
    
    return color
  }

  // Inizializza i buffer di storia
  useEffect(() => {
    historyBuffersRef.current = Array(NUM_LINES)
      .fill()
      .map(() => Array(HISTORY_POINTS).fill(0))
    
    peakValuesRef.current = Array(NUM_LINES).fill(0)
  }, [])

  useFrame(({ clock }) => {
    if (!analyserRef.current || !dataArrayRef.current) return
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    const data = dataArrayRef.current
    const time = clock.getElapsedTime()
    
    // Verifica se c'è audio in riproduzione
    hasAudioRef.current = checkIfAudioIsPlaying(data)
    
    // Aggiorna i buffer di storia per ogni banda
    for (let i = 0; i < NUM_LINES; i++) {
      const line = lineRefs.current[i]
      const area = areaRefs.current[i]
      if (!line || !area) continue
      
      const historyBuffer = historyBuffersRef.current[i]
      
      // Sposta tutti i valori di un posto a sinistra (scorrimento)
      for (let j = 0; j < HISTORY_POINTS - 1; j++) {
        historyBuffer[j] = historyBuffer[j + 1]
      }
      
      // Aggiungi il nuovo valore a destra
      const intensity = hasAudioRef.current ? getBandIntensity(data, i) : 0
      historyBuffer[HISTORY_POINTS - 1] = intensity
      
      // Aggiorna il valore di picco
      if (intensity > peakValuesRef.current[i]) {
        peakValuesRef.current[i] = intensity
      } else {
        peakValuesRef.current[i] *= peakDecayRef.current
      }
      
      // Aggiorna la geometria della linea
      const lineArr = line.geometry.attributes.position.array
      const areaArr = area.geometry.attributes.position.array
      const tt = (i + 0.5) / NUM_LINES
      const yOffset = (tt * 2 - 1) * VERTICAL_SCALE
      
      // Aggiorna i punti della linea e dell'area
      for (let j = 0; j < HISTORY_POINTS; j++) {
        // Posizione X da destra a sinistra
        const x = (j / (HISTORY_POINTS - 1)) * WIDTH - WIDTH / 2
        
        // Altezza basata sull'intensità storica
        const intensity = historyBuffer[j]
        const y = yOffset + intensity * VERTICAL_SCALE * 0.5
        
        // Aggiorna la posizione della linea
        const lineIdx = j * 3
        lineArr[lineIdx + 0] = x
        lineArr[lineIdx + 1] = y
        lineArr[lineIdx + 2] = 0
        
        // Aggiorna la posizione dell'area (due punti per ogni posizione x)
        const areaIdx = j * 2 * 3
        // Punto superiore (sulla linea)
        areaArr[areaIdx + 0] = x
        areaArr[areaIdx + 1] = y
        areaArr[areaIdx + 2] = 0
        // Punto inferiore (sulla linea di base)
        areaArr[areaIdx + 3] = x
        areaArr[areaIdx + 4] = yOffset
        areaArr[areaIdx + 5] = 0
      }
      
      // Aggiorna il colore in base all'intensità corrente
      const currentIntensity = historyBuffer[HISTORY_POINTS - 1]
      
      // Linee sempre nere
      line.material.color = LINE_COLOR.clone()
      
      // Colore dell'area basato sull'intensità
      const areaColor = getColorForIntensity(currentIntensity)
      area.material.color = areaColor
      area.material.opacity = AREA_OPACITY * (0.5 + currentIntensity * 0.5)
      
      // Aggiorna le geometrie
      line.geometry.attributes.position.needsUpdate = true
      area.geometry.attributes.position.needsUpdate = true
    }
  })

  const visualElements = useMemo(() => {
    const elements = []
    
    // Crea le linee e le aree
    for (let i = 0; i < NUM_LINES; i++) {
      // Crea la geometria della linea
      const linePositions = new Float32Array(HISTORY_POINTS * 3)
      const lineGeom = new THREE.BufferGeometry()
      lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
      lineGeom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity)
      
      // Crea il materiale della linea con spessore triplicato e colore nero
      const lineMat = new THREE.LineBasicMaterial({ 
        color: LINE_COLOR.clone(),
        linewidth: LINE_WIDTH,
        linecap: 'round',
        linejoin: 'round'
      })
      
      // Crea la geometria dell'area (due punti per ogni posizione x)
      const areaPositions = new Float32Array(HISTORY_POINTS * 2 * 3)
      const areaGeom = new THREE.BufferGeometry()
      areaGeom.setAttribute('position', new THREE.BufferAttribute(areaPositions, 3))
      areaGeom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity)
      
      // Crea gli indici per i triangoli dell'area
      const indices = []
      for (let j = 0; j < HISTORY_POINTS - 1; j++) {
        const a = j * 2
        const b = a + 1
        const c = a + 2
        const d = a + 3
        indices.push(a, b, c)
        indices.push(c, b, d)
      }
      areaGeom.setIndex(indices)
      
      // Crea il materiale dell'area con trasparenza
      const areaMat = new THREE.MeshBasicMaterial({
        color: LOW_COLOR.clone(),
        transparent: true,
        opacity: AREA_OPACITY,
        side: THREE.DoubleSide
      })
      
      elements.push({
        line: { geometry: lineGeom, material: lineMat },
        area: { geometry: areaGeom, material: areaMat }
      })
    }
    
    return elements
  }, [])

  return (
    <>
      {visualElements.map(({ line, area }, i) => (
        <group key={i}>
          <line
            geometry={line.geometry}
            material={line.material}
            frustumCulled={false}
            ref={el => (lineRefs.current[i] = el)}
          />
          <mesh
            geometry={area.geometry}
            material={area.material}
            frustumCulled={false}
            ref={el => (areaRefs.current[i] = el)}
          />
        </group>
      ))}
    </>
  )
}
