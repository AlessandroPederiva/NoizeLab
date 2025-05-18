// src/components/SquareField.jsx
import React, { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Configurazione della griglia
const MIN_GRID_SIZE = 32 // Dimensione minima della griglia (senza audio)
const MAX_GRID_SIZE = 128 // Dimensione massima della griglia (con audio al massimo)
const SQUARE_SIZE = 0.5 // Dimensione base dei quadrati
const AUDIO_THRESHOLD = 10 // Soglia per considerare l'audio attivo
const FEEDBACK_DECAY = 0.92 // Aumentato per un decadimento più lento
const GRID_CHANGE_SPEED = 0.05 // Velocità di cambiamento della griglia (ridotta per rallentare ulteriormente)
const PATTERN_CHANGE_THRESHOLD = 0.05 // Soglia per il cambiamento del pattern (ridotta per cambiamenti più frequenti)
const COLOR_TRANSITION_SPEED = 0.05 // Leggermente aumentato per transizioni più reattive
const PATTERN_MEMORY_LENGTH = 15 // Numero di pattern da ricordare
const EDGE_ENHANCEMENT = 0.2 // Fattore di enfatizzazione dei bordi

// Colori in scala di grigi
const STATIC_COLOR = new THREE.Color('#333333'); // Grigio scuro quando non c'è audio
const LOW_COLOR = new THREE.Color('#555555');    // Grigio medio-scuro
const MID_COLOR = new THREE.Color('#888888');    // Grigio medio
const HIGH_COLOR = new THREE.Color('#cccccc');   // Grigio chiaro (non bianco puro)

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

// Pattern generatori - modificati per la nuova mappatura frequenze-ampiezza
const patterns = {
  // Pattern a linee di frequenza
  frequencyLines: (x, y, time, noise, freqBands, freqX, ampY) => {
    // Usa la posizione X come indice di frequenza e Y come ampiezza
    const freqValue = freqBands[freqX] || 0;
    
    // Crea linee orizzontali basate sull'ampiezza
    const lineThreshold = 0.1;
    const lineWidth = 0.05 + freqValue * 0.1;
    
    // Se l'ampiezza della frequenza è maggiore della posizione Y, mostra il quadrato
    return ampY <= freqValue ? 1.0 : 0.0;
  },
  
  // Pattern a spettrogramma
  spectrogram: (x, y, time, noise, freqBands, freqX, ampY) => {
    // Usa la posizione X come indice di frequenza
    const freqValue = freqBands[freqX] || 0;
    
    // Crea un effetto di persistenza temporale
    const persistenceFactor = Math.max(0, 1 - (y / 1.0)); // Diminuisce con l'aumentare di Y
    
    // Combina il valore di frequenza con la persistenza
    return freqValue * persistenceFactor;
  },
  
  // Pattern a contorni di frequenza
  frequencyContours: (x, y, time, noise, freqBands, freqX, ampY) => {
    // Ottieni il valore della frequenza corrente e delle frequenze adiacenti
    const freqValue = freqBands[freqX] || 0;
    const freqLeft = freqBands[Math.max(0, freqX - 1)] || 0;
    const freqRight = freqBands[Math.min(freqBands.length - 1, freqX + 1)] || 0;
    
    // Calcola il gradiente di frequenza
    const freqGradient = Math.abs(freqRight - freqLeft);
    
    // Crea contorni basati sul gradiente e sull'ampiezza
    const contourValue = Math.abs(ampY - freqValue);
    const lineWidth = 0.05 + freqGradient * 0.2;
    
    return contourValue < lineWidth ? 1.0 : 0.0;
  },
  
  // Pattern a onde di frequenza
  frequencyWaves: (x, y, time, noise, freqBands, freqX, ampY) => {
    // Usa la posizione X come indice di frequenza
    const freqValue = freqBands[freqX] || 0;
    
    // Crea onde basate sul tempo e sul valore della frequenza
    const wavePhase = time * 0.5 + freqX * 0.1;
    const waveAmplitude = freqValue * 0.5;
    const waveValue = Math.sin(wavePhase) * waveAmplitude;
    
    // Confronta con la posizione Y
    const distanceFromWave = Math.abs(ampY - (0.5 + waveValue));
    const lineWidth = 0.05 + freqValue * 0.1;
    
    return distanceFromWave < lineWidth ? 1.0 : 0.0;
  },
  
  // Pattern a matrice di frequenza
  frequencyMatrix: (x, y, time, noise, freqBands, freqX, ampY) => {
    // Usa la posizione X come indice di frequenza
    const freqValue = freqBands[freqX] || 0;
    
    // Crea una matrice di punti basata su frequenza e tempo
    const gridSize = 0.1 + freqValue * 0.2;
    const gridX = Math.floor(x / gridSize);
    const gridY = Math.floor(y / gridSize);
    
    // Alterna i punti in base alla parità della somma delle coordinate
    const isVisible = (gridX + gridY) % 2 === 0;
    
    // Modula la visibilità in base all'ampiezza
    return isVisible && ampY <= freqValue ? 1.0 : 0.0;
  },
  
  // Pattern a flusso di frequenza
  frequencyFlow: (x, y, time, noise, freqBands, freqX, ampY) => {
    // Usa la posizione X come indice di frequenza
    const freqValue = freqBands[freqX] || 0;
    
    // Crea un campo di flusso basato sul rumore e modulato dalla frequenza
    const flowScale = 2.0 + freqValue * 3.0;
    const flowTime = time * 0.1;
    
    // Campiona il rumore nella posizione corrente
    const noiseValue = noise.noise(x * flowScale, y * flowScale, flowTime);
    
    // Modula il rumore in base all'ampiezza e al valore della frequenza
    const threshold = 0.4 + freqValue * 0.3;
    
    return noiseValue > threshold && ampY <= freqValue * 1.2 ? 1.0 : 0.0;
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
  const currentPatternRef = useRef('frequencyLines');
  const noiseRef = useRef(new NoiseGenerator(Math.random()));
  const lastPatternChangeRef = useRef(0);
  const currentGridSizeRef = useRef(MIN_GRID_SIZE);
  const lastIntensityRef = useRef(0);
  const patternHistoryRef = useRef([]);
  const prevPatternValuesRef = useRef([]); // Per il sistema di memoria
  const freqBandsHistoryRef = useRef([]); // Per memorizzare la storia delle bande di frequenza
  
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
    const bandCount = Math.min(MAX_GRID_SIZE, freqData.length / 2); // Limita il numero di bande alla dimensione della griglia
    
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
    // Usa una funzione non lineare per enfatizzare i contrasti
    const enhancedPattern = Math.pow(patternValue, 1.5); // Esponente > 1 aumenta il contrasto
    
    // Combina l'intensità con il valore del pattern con più peso sul pattern
    const combinedIntensity = intensity * 0.4 + enhancedPattern * 0.6;
    
    // Applica una curva sigmoidale per aumentare il contrasto
    const contrastedIntensity = 1 / (1 + Math.exp(-10 * (combinedIntensity - 0.5)));
    
    if (contrastedIntensity < 0.33) {
      // Da grigio scuro a grigio medio-scuro
      return STATIC_COLOR.clone().lerp(LOW_COLOR, contrastedIntensity * 3);
    } else if (contrastedIntensity < 0.66) {
      // Da grigio medio-scuro a grigio medio
      return LOW_COLOR.clone().lerp(MID_COLOR, (contrastedIntensity - 0.33) * 3);
    } else {
      // Da grigio medio a grigio chiaro
      return MID_COLOR.clone().lerp(HIGH_COLOR, (contrastedIntensity - 0.66) * 3);
    }
  }
  
  // Funzione per aggiornare la griglia in base ai dati audio
  function updateGrid(freqData) {
    // Verifica se c'è audio in riproduzione
    const isAudioPlaying = checkIfAudioIsPlaying(freqData);
    hasAudioRef.current = isAudioPlaying;
    
    // Ottieni le bande di frequenza
    const freqBands = getFrequencyBands(freqData);
    
    // Aggiorna la storia delle bande di frequenza
    if (freqBandsHistoryRef.current.length >= 10) {
      freqBandsHistoryRef.current.shift();
    }
    freqBandsHistoryRef.current.push(freqBands);
    
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
        // Definisci i pattern preferiti per la visualizzazione frequenze-ampiezza
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
      
      // NUOVA MAPPATURA: X = frequenza, Y = ampiezza
      // Normalizza le coordinate per il pattern
      const nx = (ix / gridSize) * 2 - 1; // Coordinate normalizzate per il pattern
      const ny = (iy / gridSize) * 2 - 1;
      
      // Calcola l'indice di frequenza e il valore di ampiezza normalizzati
      const freqIndex = Math.floor((ix / gridSize) * freqBands.length);
      const ampValue = 1.0 - (iy / gridSize); // Inverti Y per avere 1.0 in basso e 0.0 in alto
      
      // Ottieni il valore del pattern
      let patternValue = 0;
      let intensity = 0;
      
      if (isAudioPlaying) {
        // Usa la nuova mappatura per il pattern
        patternValue = currentPattern(nx, ny, timeRef.current, noiseRef.current, freqBands, freqIndex, ampValue);
        
        // Ottieni il valore della frequenza corrente
        const freqValue = freqBands[freqIndex] || 0;
        
        // Calcola l'intensità basata sulla frequenza e sull'ampiezza
        intensity = freqValue * (1.0 - Math.abs(ampValue - freqValue));
      }
      
      // Sistema di memoria per pattern più coerenti
      if (!prevPatternValuesRef.current[i]) {
        prevPatternValuesRef.current[i] = Array(PATTERN_MEMORY_LENGTH).fill(patternValue);
      } else {
        // Sposta tutti i valori e aggiungi quello nuovo
        prevPatternValuesRef.current[i].shift();
        prevPatternValuesRef.current[i].push(patternValue);
      }
      
      // Calcola la media dei valori memorizzati per un effetto più fluido
      const averagePatternValue = prevPatternValuesRef.current[i].reduce((sum, val) => sum + val, 0) / 
                                prevPatternValuesRef.current[i].length;
      
      // Applica feedback per un effetto più fluido
      const prevIntensity = prevIntensitiesRef.current[i] || 0;
      const newIntensity = prevIntensity * FEEDBACK_DECAY + intensity * (1 - FEEDBACK_DECAY);
      prevIntensitiesRef.current[i] = newIntensity;
      
      // Calcola il colore basato sull'intensità e sul pattern
      const targetColor = isAudioPlaying 
        ? getColorForIntensity(newIntensity, averagePatternValue)
        : STATIC_COLOR;
      
      // Applica feedback al colore
      const prevColor = prevColorsRef.current[i];
      prevColor.lerp(targetColor, COLOR_TRANSITION_SPEED);
      square.material.color.copy(prevColor);
      
      // Imposta l'opacità in base all'intensità e al pattern
      square.material.opacity = isAudioPlaying 
        ? Math.max(0.3, Math.min(0.9, averagePatternValue + 0.3))
        : 0.7;
      
      // Imposta la posizione Z per un leggero effetto 3D
      square.position.z = isAudioPlaying ? averagePatternValue * 2 : 0;
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
