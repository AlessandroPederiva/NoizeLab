// src/components/SquareField.jsx
import React, { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Configurazione della griglia
const MIN_GRID_SIZE = 10 // Dimensione minima della griglia (senza audio)
const MAX_GRID_SIZE = 40 // Dimensione massima della griglia (con audio al massimo)
const SQUARE_SIZE = 0.5 // Dimensione base dei quadrati
const AUDIO_THRESHOLD = 10 // Soglia per considerare l'audio attivo
const FEEDBACK_DECAY = 0.97 // Fattore di decadimento per l'effetto feedback (aumentato per rallentare ulteriormente)
const GRID_CHANGE_SPEED = 0.03 // Velocità di cambiamento della griglia (ridotta per rallentare ulteriormente)
const PATTERN_CHANGE_THRESHOLD = 0.25 // Soglia per il cambiamento del pattern (ridotta per cambiamenti più frequenti)
const COLOR_TRANSITION_SPEED = 0.03 // Velocità di transizione dei colori (ridotta per transizioni più fluide)

// Colori
const LOW_COLOR = new THREE.Color('#00bcd4') // Ciano per bassa intensità
const MID_COLOR = new THREE.Color('#9c27b0') // Viola per media intensità
const HIGH_COLOR = new THREE.Color('#ff1744') // Rosa/Rosso per alta intensità
const STATIC_COLOR = new THREE.Color('#444444') // Grigio quando non c'è audio

// Classe per generare rumore Perlin
class NoiseGenerator {
  constructor(seed = Math.random()) {
    this.seed = seed;
    this.p = new Uint8Array(512);
    this.permutation = new Uint8Array(256);
    
    // Inizializza la permutazione con valori casuali
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    
    // Mescola la permutazione
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((seed * 256) % (i + 1));
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }
    
    // Estendi la permutazione
    for (let i = 0; i < 512; i++) {
      this.p[i] = this.permutation[i & 255];
    }
  }
  
  // Funzione di fade
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  // Funzione di lerp
  lerp(t, a, b) {
    return a + t * (b - a);
  }
  
  // Funzione di grad
  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  // Funzione di rumore 3D
  noise(x, y, z) {
    // Trova le coordinate del cubo unitario che contiene il punto
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    
    // Trova la posizione relativa del punto nel cubo
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    
    // Calcola le curve di fade
    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);
    
    // Hash delle coordinate
    const A = this.p[X] + Y;
    const AA = this.p[A] + Z;
    const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y;
    const BA = this.p[B] + Z;
    const BB = this.p[B + 1] + Z;
    
    // Interpola i risultati
    return this.lerp(w, 
      this.lerp(v, 
        this.lerp(u, 
          this.grad(this.p[AA], x, y, z),
          this.grad(this.p[BA], x - 1, y, z)
        ),
        this.lerp(u, 
          this.grad(this.p[AB], x, y - 1, z),
          this.grad(this.p[BB], x - 1, y - 1, z)
        )
      ),
      this.lerp(v, 
        this.lerp(u, 
          this.grad(this.p[AA + 1], x, y, z - 1),
          this.grad(this.p[BA + 1], x - 1, y, z - 1)
        ),
        this.lerp(u, 
          this.grad(this.p[AB + 1], x, y - 1, z - 1),
          this.grad(this.p[BB + 1], x - 1, y - 1, z - 1)
        )
      )
    );
  }
  
  // Rumore fBm (Fractional Brownian Motion)
  fbm(x, y, z, octaves = 6, lacunarity = 2.0, gain = 0.5) {
    let result = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    
    for (let i = 0; i < octaves; i++) {
      result += amplitude * this.noise(x * frequency, y * frequency, z * frequency);
      frequency *= lacunarity;
      amplitude *= gain;
    }
    
    return result;
  }
}

// Pattern generatori
const patterns = {
  // Pattern a cerchi concentrici
  circles: (x, y, time, noise, freqBands) => {
    const distance = Math.sqrt(x * x + y * y);
    // Usa le bande di frequenza basse per modulare i cerchi
    const bassModulation = freqBands[0] * 2;
    return Math.sin(distance * (3 + bassModulation) - time) * 0.5 + 0.5;
  },
  
  // Pattern a spirale
  spiral: (x, y, time, noise, freqBands) => {
    const angle = Math.atan2(y, x);
    const distance = Math.sqrt(x * x + y * y);
    // Usa le bande di frequenza medie per modulare la spirale
    const midModulation = freqBands[Math.floor(freqBands.length / 2)] * 3;
    return Math.sin(distance * 5 + angle * (3 + midModulation) + time) * 0.5 + 0.5;
  },
  
  // Pattern a onde
  waves: (x, y, time, noise, freqBands) => {
    // Usa le bande di frequenza alte per modulare le onde
    const highModulation = freqBands[freqBands.length - 1] * 3;
    return Math.sin(x * (3 + highModulation) + time) * Math.cos(y * 2 - time * 0.5) * 0.5 + 0.5;
  },
  
  // Pattern a scacchiera pulsante
  checkerboard: (x, y, time, noise, freqBands) => {
    // Usa l'intensità media per modulare la scala
    const avgIntensity = freqBands.reduce((sum, val) => sum + val, 0) / freqBands.length;
    const scale = 0.5 + Math.sin(time * 0.2) * 0.2 + avgIntensity * 0.3;
    return ((Math.floor(x / scale) + Math.floor(y / scale)) % 2) ? 1 : 0;
  },
  
  // Pattern di rumore Perlin modulato
  perlinNoise: (x, y, time, noise, freqBands) => {
    // Usa le bande di frequenza per modulare il rumore
    const bassInfluence = freqBands[0] * 0.5;
    const midInfluence = freqBands[Math.floor(freqBands.length / 2)] * 0.3;
    const highInfluence = freqBands[freqBands.length - 1] * 0.2;
    
    return noise.noise(
      x + bassInfluence, 
      y + midInfluence, 
      time + highInfluence
    ) * 0.5 + 0.5;
  },
  
  // Pattern di rumore fBm con modulazione audio
  fbmNoise: (x, y, time, noise, freqBands) => {
    // Usa l'intensità media per modulare il rumore
    const avgIntensity = freqBands.reduce((sum, val) => sum + val, 0) / freqBands.length;
    const octaves = 3 + Math.floor(avgIntensity * 3); // 3-6 ottave
    
    return noise.fbm(x, y, time, octaves, 2.0, 0.5) * 0.5 + 0.5;
  },
  
  // Pattern a vortice reattivo
  vortex: (x, y, time, noise, freqBands) => {
    const angle = Math.atan2(y, x);
    const distance = Math.sqrt(x * x + y * y);
    
    // Usa diverse bande di frequenza per modulare il vortice
    const bassInfluence = freqBands[0] * 3;
    const midInfluence = freqBands[Math.floor(freqBands.length / 2)] * 5;
    
    return Math.sin(distance * (3 + bassInfluence) - angle * (5 + midInfluence) + time) * 0.5 + 0.5;
  },
  
  // Pattern a righe pulsanti
  stripes: (x, y, time, noise, freqBands) => {
    // Usa le bande di frequenza per modulare le righe
    const bassInfluence = freqBands[0] * 5;
    const midInfluence = freqBands[Math.floor(freqBands.length / 2)] * 3;
    
    const freq = 5 + Math.sin(time * 0.1) * 2 + bassInfluence;
    const phase = time + midInfluence;
    
    return Math.sin(x * freq + phase) * 0.5 + 0.5;
  },
  
  // Pattern a griglia pulsante
  grid: (x, y, time, noise, freqBands) => {
    // Usa le bande di frequenza per modulare la griglia
    const bassInfluence = freqBands[0] * 3;
    const highInfluence = freqBands[freqBands.length - 1] * 3;
    
    const xGrid = Math.sin(x * (10 + bassInfluence) + time) * 0.5 + 0.5;
    const yGrid = Math.sin(y * (10 + highInfluence) - time * 0.5) * 0.5 + 0.5;
    
    return Math.max(xGrid, yGrid);
  },
  
  // Pattern a mandala
  mandala: (x, y, time, noise, freqBands) => {
    const angle = Math.atan2(y, x);
    const distance = Math.sqrt(x * x + y * y);
    
    // Usa diverse bande di frequenza per modulare il mandala
    const bassInfluence = freqBands[0] * 2;
    const midInfluence = freqBands[Math.floor(freqBands.length / 2)] * 3;
    const highInfluence = freqBands[freqBands.length - 1] * 4;
    
    const petals = 8 + Math.floor(midInfluence * 8); // 8-16 petali
    const radialWaves = Math.sin(angle * petals) * 0.5 + 0.5;
    const concentricWaves = Math.sin(distance * (5 + bassInfluence) - time) * 0.5 + 0.5;
    
    return (radialWaves * 0.7 + concentricWaves * 0.3) * (1 + highInfluence * 0.5);
  }
};

export default function SquareField({
  analyserRef,
  dataArrayRef,
  sampleRate = 44100,
  fftSize = 2048
}) {
  // Stato per la dimensione corrente della griglia
  const [gridSize, setGridSize] = useState(MIN_GRID_SIZE);
  
  // Refs per gestire i quadrati e altri valori
  const squaresRef = useRef([]);
  const hasAudioRef = useRef(false);
  const groupRef = useRef();
  const timeRef = useRef(0);
  const lastAudioTimeRef = useRef(0);
  const prevIntensitiesRef = useRef([]);
  const prevColorsRef = useRef([]);
  const targetGridSizeRef = useRef(MIN_GRID_SIZE);
  const currentPatternRef = useRef('perlinNoise');
  const noiseRef = useRef(new NoiseGenerator(Math.random()));
  const lastPatternChangeRef = useRef(0);
  const currentGridSizeRef = useRef(MIN_GRID_SIZE);
  const lastIntensityRef = useRef(0);
  const patternHistoryRef = useRef([]);
  
  // Funzione per verificare se c'è audio in riproduzione
  function checkIfAudioIsPlaying(data) {
    const threshold = AUDIO_THRESHOLD;
    let sum = 0;
    
    // Calcola la somma dei valori audio
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    
    // Calcola la media
    const avg = sum / data.length;
    
    // Considera l'audio attivo se la media supera la soglia
    return avg > threshold;
  }
  
  // Funzione per dividere i dati audio in bande di frequenza
  function getFrequencyBands(freqData) {
    const bands = [];
    const bandCount = 32; // Numero di bande di frequenza
    
    // Calcola la dimensione di ogni banda
    const bandSize = Math.floor(freqData.length / bandCount);
    
    // Calcola il valore medio per ogni banda
    for (let i = 0; i < bandCount; i++) {
      const start = i * bandSize;
      const end = start + bandSize;
      let sum = 0;
      
      for (let j = start; j < end; j++) {
        sum += freqData[j];
      }
      
      // Normalizza il valore della banda (0-1)
      bands.push(sum / bandSize / 255);
    }
    
    return bands;
  }
  
  // Funzione per calcolare l'intensità media di tutte le bande
  function getAverageIntensity(bands) {
    let sum = 0;
    for (let i = 0; i < bands.length; i++) {
      sum += bands[i];
    }
    return sum / bands.length;
  }
  
  // Funzione per interpolare il colore in base all'intensità
  function getColorForIntensity(intensity, patternValue) {
    // Combina l'intensità con il valore del pattern per una colorazione più interessante
    const combinedIntensity = intensity * 0.7 + patternValue * 0.3;
    
    if (combinedIntensity < 0.33) {
      // Da grigio a ciano
      return STATIC_COLOR.clone().lerp(LOW_COLOR, combinedIntensity * 3);
    } else if (combinedIntensity < 0.66) {
      // Da ciano a viola
      return LOW_COLOR.clone().lerp(MID_COLOR, (combinedIntensity - 0.33) * 3);
    } else {
      // Da viola a rosso
      return MID_COLOR.clone().lerp(HIGH_COLOR, (combinedIntensity - 0.66) * 3);
    }
  }
  
  // Funzione per aggiornare la griglia in base ai dati audio
  function updateGrid(freqData) {
    // Verifica se c'è audio in riproduzione
    const isAudioPlaying = checkIfAudioIsPlaying(freqData);
    hasAudioRef.current = isAudioPlaying;
    
    // Ottieni le bande di frequenza
    const freqBands = getFrequencyBands(freqData);
    
    // Calcola l'intensità media complessiva
    const avgIntensity = isAudioPlaying ? getAverageIntensity(freqBands) : 0;
    
    // Calcola la dimensione target della griglia in base all'intensità
    const newTargetGridSize = Math.floor(MIN_GRID_SIZE + (MAX_GRID_SIZE - MIN_GRID_SIZE) * avgIntensity);
    targetGridSizeRef.current = newTargetGridSize;
    
    // Aggiorna la dimensione della griglia con un effetto di smoothing
    if (currentGridSizeRef.current !== targetGridSizeRef.current) {
      // Avvicina gradualmente la dimensione corrente a quella target
      if (currentGridSizeRef.current < targetGridSizeRef.current) {
        currentGridSizeRef.current += GRID_CHANGE_SPEED;
      } else if (currentGridSizeRef.current > targetGridSizeRef.current) {
        currentGridSizeRef.current -= GRID_CHANGE_SPEED;
      }
      
      // Arrotonda al numero intero più vicino
      setGridSize(Math.round(currentGridSizeRef.current));
    }
    
    // Aggiorna il tempo per l'animazione solo se c'è audio
    if (isAudioPlaying) {
      // Velocità di animazione proporzionale all'intensità, ma più lenta
      timeRef.current += 0.005 * (0.5 + avgIntensity * 0.5);
      lastAudioTimeRef.current = timeRef.current;
      
      // Rileva cambiamenti significativi nell'intensità audio
      const intensityChange = Math.abs(avgIntensity - lastIntensityRef.current);
      
      // Cambia pattern se l'intensità cambia significativamente
      if (intensityChange > PATTERN_CHANGE_THRESHOLD) {
        const patternKeys = Object.keys(patterns);
        
        // Evita di ripetere lo stesso pattern
        let newPattern;
        do {
          newPattern = patternKeys[Math.floor(Math.random() * patternKeys.length)];
        } while (newPattern === currentPatternRef.current && patternKeys.length > 1);
        
        // Aggiorna il pattern corrente
        currentPatternRef.current = newPattern;
        lastPatternChangeRef.current = avgIntensity;
        
        // Crea un nuovo generatore di rumore con seed casuale
        noiseRef.current = new NoiseGenerator(Math.random());
        
        // Aggiorna la storia dei pattern
        patternHistoryRef.current.push({
          pattern: newPattern,
          time: timeRef.current,
          intensity: avgIntensity
        });
        
        // Limita la storia a 10 pattern
        if (patternHistoryRef.current.length > 10) {
          patternHistoryRef.current.shift();
        }
        
        console.log(`Pattern changed to: ${newPattern} (intensity change: ${intensityChange.toFixed(2)})`);
      }
      
      // Aggiorna l'ultima intensità
      lastIntensityRef.current = avgIntensity;
    } else {
      // Mantieni il tempo fermo quando non c'è audio
      timeRef.current = lastAudioTimeRef.current;
    }
    
    // Inizializza i buffer se non esistono
    if (prevIntensitiesRef.current.length === 0) {
      prevIntensitiesRef.current = Array(MAX_GRID_SIZE * MAX_GRID_SIZE).fill(0);
      prevColorsRef.current = Array(MAX_GRID_SIZE * MAX_GRID_SIZE).fill().map(() => new THREE.Color(STATIC_COLOR));
    }
    
    // Calcola la separazione tra i quadrati per mantenere l'area costante
    const separation = (MAX_GRID_SIZE / gridSize) * SQUARE_SIZE;
    const halfGrid = (gridSize * separation) / 2;
    
    // Ottieni il pattern corrente
    const currentPattern = patterns[currentPatternRef.current];
    
    // Aggiorna ogni quadrato
    for (let i = 0; i < squaresRef.current.length; i++) {
      const square = squaresRef.current[i];
      if (!square) continue;
      
      // Calcola la posizione nella griglia
      const ix = i % MAX_GRID_SIZE;
      const iy = Math.floor(i / MAX_GRID_SIZE);
      
      // Determina se il quadrato è all'interno della griglia corrente
      const isInCurrentGrid = ix < gridSize && iy < gridSize;
      
      // Imposta la visibilità
      square.visible = isInCurrentGrid;
      
      if (!isInCurrentGrid) continue;
      
      // Calcola la posizione del quadrato
      const x = (ix * separation) - halfGrid + (separation / 2);
      const y = (iy * separation) - halfGrid + (separation / 2);
      square.position.x = x;
      square.position.y = y;
      
      // Imposta la scala in base alla dimensione del quadrato
      square.scale.set(separation * 0.9, separation * 0.9, 1);
      
      // Determina l'intensità per questo quadrato
      // Ogni riga (y) corrisponde a una banda di frequenza specifica
      const freqIndex = Math.floor((iy / gridSize) * freqBands.length);
      let intensity = isAudioPlaying ? freqBands[freqIndex] || 0 : 0;
      
      // Normalizza le coordinate per il pattern
      const nx = (ix / gridSize) * 2 - 1;
      const ny = (iy / gridSize) * 2 - 1;
      
      // Ottieni il valore del pattern
      let patternValue = 0;
      if (isAudioPlaying) {
        // Passa anche le bande di frequenza al pattern per una maggiore reattività
        patternValue = currentPattern(nx, ny, timeRef.current, noiseRef.current, freqBands);
        
        // Combina l'intensità della frequenza con il valore del pattern
        intensity = intensity * 0.6 + patternValue * 0.4;
      }
      
      // Applica feedback per un effetto più fluido
      const prevIntensity = prevIntensitiesRef.current[i] || 0;
      const newIntensity = prevIntensity * FEEDBACK_DECAY + intensity * (1 - FEEDBACK_DECAY);
      prevIntensitiesRef.current[i] = newIntensity;
      
      // Calcola il colore basato sull'intensità e sul pattern
      const targetColor = isAudioPlaying 
        ? getColorForIntensity(newIntensity, patternValue)
        : STATIC_COLOR;
      
      // Applica feedback al colore
      const prevColor = prevColorsRef.current[i];
      prevColor.lerp(targetColor, COLOR_TRANSITION_SPEED); // Transizioni più fluide
      square.material.color.copy(prevColor);
      
      // Imposta l'opacità in base all'intensità
      square.material.opacity = isAudioPlaying 
        ? Math.max(0.3, Math.min(0.9, newIntensity + 0.3))
        : 0.7;
      
      // Imposta la posizione Z per un leggero effetto 3D
      square.position.z = isAudioPlaying ? newIntensity * 2 : 0;
    }
  }
  
  // Aggiorna la visualizzazione ad ogni frame
  useFrame(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    
    // Ottieni i dati audio
    const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(freqData);
    
    // Aggiorna la griglia
    updateGrid(freqData);
    
    // Effetto di rotazione dell'intero gruppo solo se c'è audio
    if (groupRef.current && hasAudioRef.current) {
      // Rotazione leggera per un effetto 3D
      groupRef.current.rotation.x = Math.sin(timeRef.current * 0.1) * 0.05;
      groupRef.current.rotation.y = Math.cos(timeRef.current * 0.1) * 0.05;
    } else if (groupRef.current) {
      // Resetta gradualmente la rotazione quando non c'è audio
      groupRef.current.rotation.x *= 0.95;
      groupRef.current.rotation.y *= 0.95;
    }
  });
  
  // Crea la griglia di quadrati
  const squares = useMemo(() => {
    const items = [];
    
    for (let iy = 0; iy < MAX_GRID_SIZE; iy++) {
      for (let ix = 0; ix < MAX_GRID_SIZE; ix++) {
        // Crea la geometria e il materiale
        const geometry = new THREE.PlaneGeometry(1, 1); // Dimensione base 1x1, scalata dopo
        const material = new THREE.MeshBasicMaterial({
          color: STATIC_COLOR,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7
        });
        
        // Determina se il quadrato è all'interno della griglia iniziale
        const isInInitialGrid = ix < MIN_GRID_SIZE && iy < MIN_GRID_SIZE;
        
        items.push({
          geometry,
          material,
          visible: isInInitialGrid
        });
      }
    }
    
    return items;
  }, []);
  
  // Effetto per gestire il ridimensionamento della finestra
  useEffect(() => {
    const handleResize = () => {
      // Aggiorna la posizione della camera o altri parametri se necessario
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Effetto di debug per monitorare i cambiamenti di dimensione della griglia
  useEffect(() => {
    console.log(`Grid size changed to: ${gridSize}x${gridSize}`);
  }, [gridSize]);
  
  return (
    <group ref={groupRef}>
      {squares.map((square, i) => (
        <mesh
          key={i}
          position={[0, 0, 0]} // Posizione inizializzata a zero, aggiornata in useFrame
          geometry={square.geometry}
          material={square.material}
          visible={square.visible}
          ref={el => (squaresRef.current[i] = el)}
        />
      ))}
    </group>
  );
}
