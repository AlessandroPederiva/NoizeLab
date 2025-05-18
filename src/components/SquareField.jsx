// src/components/SquareField.jsx
import React, { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Configurazione della griglia
const MIN_GRID_SIZE = 10 // Dimensione minima della griglia (senza audio)
const MAX_GRID_SIZE = 128 // Dimensione massima della griglia (con audio al massimo)
const SQUARE_SIZE = 0.5 // Dimensione base dei quadrati
const AUDIO_THRESHOLD = 3 // Soglia ridotta per considerare l'audio attivo
const FREQUENCY_AMPLIFICATION = 2.5 // Amplificazione dei valori di frequenza per renderli più visibili
const MIN_OPACITY = 0.2 // Opacità minima per i quadrati inattivi
const MAX_OPACITY = 1.0 // Opacità massima per i quadrati attivi
const FREQUENCY_SMOOTHING = 0.3 // Leggero smoothing per le frequenze (evita flickering)

// Colori con maggiore contrasto
const STATIC_COLOR = new THREE.Color('#222222'); // Grigio molto scuro quando non c'è audio
const LOW_COLOR = new THREE.Color('#666666');    // Grigio scuro
const MID_COLOR = new THREE.Color('#aaaaaa');    // Grigio medio
const HIGH_COLOR = new THREE.Color('#ffffff');   // Bianco per massimo contrasto

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
  const prevFreqBandsRef = useRef([]);
  
  // Funzione per verificare se c'è audio in riproduzione e ottenere il livello
  function getAudioLevel(data) {
    let sum = 0;
    
    // Calcola la somma dei valori audio
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    
    // Calcola la media
    const avg = sum / data.length;
    
    // Restituisce il livello audio normalizzato (0-1)
    return Math.min(1, Math.max(0, avg / 255));
  }
  
  // Funzione per dividere i dati audio in bande di frequenza
  function getFrequencyBands(freqData) {
    const bands = [];
    const bandCount = MAX_GRID_SIZE; // Usa la dimensione massima della griglia per avere una banda per ogni colonna
    
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
  
  // Funzione per applicare una scala logaritmica ai valori di frequenza
  function applyLogScale(value) {
    // Evita log(0)
    const minValue = 0.01;
    value = Math.max(minValue, value);
    
    // Scala logaritmica normalizzata
    return Math.log(1 + value * 9) / Math.log(10);
  }
  
  // Funzione per amplificare i valori di frequenza
  function amplifyFrequency(value) {
    // Applica una scala logaritmica per enfatizzare i valori bassi
    const logValue = applyLogScale(value);
    
    // Amplifica il valore
    return Math.min(1.0, logValue * FREQUENCY_AMPLIFICATION);
  }
  
  // Funzione per aggiornare la griglia in base ai dati audio
  function updateGrid(freqData) {
    // Ottieni il livello audio
    const audioLevel = getAudioLevel(freqData);
    const isAudioPlaying = audioLevel > AUDIO_THRESHOLD / 255;
    hasAudioRef.current = isAudioPlaying;
    
    // Ottieni le bande di frequenza
    let freqBands = getFrequencyBands(freqData);
    
    // Applica un leggero smoothing per evitare flickering
    if (prevFreqBandsRef.current.length > 0) {
      freqBands = freqBands.map((value, index) => {
        const prevValue = prevFreqBandsRef.current[index] || 0;
        return prevValue * FREQUENCY_SMOOTHING + value * (1 - FREQUENCY_SMOOTHING);
      });
    }
    prevFreqBandsRef.current = [...freqBands];
    
    // VARIAZIONE ISTANTANEA: Imposta direttamente la dimensione della griglia in base al livello audio
    // Più audio = più quadrati, meno audio = meno quadrati
    const newGridSize = Math.floor(MIN_GRID_SIZE + (MAX_GRID_SIZE - MIN_GRID_SIZE) * audioLevel);
    setGridSize(newGridSize);
    
    // Aggiorna il tempo per l'animazione solo se c'è audio
    if (isAudioPlaying) {
      // Velocità di animazione proporzionale al livello audio
      timeRef.current += 0.005 * (0.5 + audioLevel * 0.5);
      lastAudioTimeRef.current = timeRef.current;
    } else {
      // Mantieni il tempo fermo quando non c'è audio
      timeRef.current = lastAudioTimeRef.current;
    }
    
    // Calcola la separazione tra i quadrati per mantenere l'area costante
    const separation = (MAX_GRID_SIZE / newGridSize) * SQUARE_SIZE;
    const halfGrid = (newGridSize * separation) / 2;
    
    // Aggiorna ogni quadrato
    for (let i = 0; i < squaresRef.current.length; i++) {
      const square = squaresRef.current[i];
      if (!square) continue;
      
      // Calcola la posizione nella griglia
      const ix = i % MAX_GRID_SIZE;
      const iy = Math.floor(i / MAX_GRID_SIZE);
      
      // Determina se il quadrato è all'interno della griglia corrente
      const isInCurrentGrid = ix < newGridSize && iy < newGridSize;
      
      // Imposta la visibilità
      square.visible = isInCurrentGrid;
      
      if (!isInCurrentGrid) continue;
      
      // Calcola la posizione del quadrato
      const x = (ix * separation) - halfGrid + (separation / 2);
      const y = (iy * separation) - halfGrid + (separation / 2);
      square.position.x = x;
      square.position.y = y;
      
      // Imposta la scala in base alla dimensione del quadrato
      square.scale.set(separation * 0.98, separation * 0.98, 1); // Aumentato per ridurre lo spazio tra i quadrati
      
      // MAPPATURA MIGLIORATA: Usa l'indice assoluto per accedere alle bande di frequenza
      // e amplifica i valori per renderli più visibili
      const freqIndex = Math.min(freqBands.length - 1, ix);
      let freqValue = freqBands[freqIndex] || 0;
      
      // Amplifica il valore della frequenza per renderlo più visibile
      freqValue = amplifyFrequency(freqValue);
      
      // Normalizza la posizione Y rispetto alla dimensione massima della griglia
      // per garantire una mappatura coerente indipendentemente dalla dimensione attuale
      const normalizedY = 1 - (iy / newGridSize); // 1 in basso, 0 in alto
      
      // Un quadrato è "attivo" se la sua posizione Y è inferiore al valore della frequenza amplificato
      // Aggiungiamo una soglia minima per garantire che ci sia sempre qualcosa di visibile
      const isActive = normalizedY <= freqValue;
      
      // Calcola l'intensità basata sulla distanza dal valore della frequenza
      // Questo crea un gradiente invece di un taglio netto
      const distanceFromThreshold = Math.max(0, 1 - Math.abs(normalizedY - freqValue) * 5);
      const intensity = isActive ? Math.max(distanceFromThreshold, 0.5) : distanceFromThreshold * 0.3;
      
      // Imposta direttamente il colore senza smoothing per una risposta istantanea
      let targetColor;
      if (isAudioPlaying) {
        // Calcola il colore basato sull'intensità della frequenza
        if (freqValue < 0.33) {
          // Da grigio scuro a grigio medio-scuro
          targetColor = STATIC_COLOR.clone().lerp(LOW_COLOR, freqValue * 3);
        } else if (freqValue < 0.66) {
          // Da grigio medio-scuro a grigio medio
          targetColor = LOW_COLOR.clone().lerp(MID_COLOR, (freqValue - 0.33) * 3);
        } else {
          // Da grigio medio a bianco
          targetColor = MID_COLOR.clone().lerp(HIGH_COLOR, (freqValue - 0.66) * 3);
        }
      } else {
        targetColor = STATIC_COLOR;
      }
      
      // Applica il colore direttamente senza transizione
      square.material.color.copy(targetColor);
      
      // Imposta l'opacità in base all'attivazione con un gradiente
      square.material.opacity = isAudioPlaying 
        ? MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * intensity
        : MIN_OPACITY;
      
      // Imposta la posizione Z per un effetto 3D più pronunciato
      square.position.z = isAudioPlaying ? freqValue * 3 : 0;
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
          opacity: MIN_OPACITY
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
