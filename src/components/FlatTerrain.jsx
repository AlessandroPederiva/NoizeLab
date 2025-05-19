import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Componente per un terreno con montagne più pronunciate
export function FlatTerrain({
  width = 500,
  height = 500,
  widthSegments = 100,
  heightSegments = 100,
  color = '#4a7c59',
  position = [0, 0, 0] // Posizione esattamente a Y=0
}) {
  const meshRef = useRef();
  
  // Creiamo un terreno con montagne più pronunciate
  useEffect(() => {
    if (!meshRef.current) return;
    
    const geometry = meshRef.current.geometry;
    const positions = geometry.attributes.position.array;
    
    // Aggiungiamo montagne più pronunciate
    for (let i = 0; i <= widthSegments; i++) {
      for (let j = 0; j <= heightSegments; j++) {
        const index = (i * (heightSegments + 1) + j) * 3;
        
        // Coordinate normalizzate tra -0.5 e 0.5
        const x = (i / widthSegments - 0.5) * width;
        const z = (j / heightSegments - 0.5) * height;
        
        // Distanza dal centro
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        
        // Zona piatta al centro (raggio 30)
        const flatRadius = 30;
        let y = 0;
        
        // Solo oltre il raggio piatto aggiungiamo montagne
        if (distanceFromCenter > flatRadius) {
          // Fattore di distanza normalizzato (0 al bordo del raggio piatto, 1 al bordo esterno)
          const distanceFactor = (distanceFromCenter - flatRadius) / (width/2 - flatRadius);
          
          // Creiamo montagne più pronunciate usando funzioni seno con frequenze diverse
          const frequency1 = 0.02;
          const frequency2 = 0.05;
          const amplitude = 30; // Altezza massima delle montagne aumentata
          
          // Calcoliamo l'altezza usando funzioni seno
          y = Math.sin(x * frequency1) * Math.sin(z * frequency1) * amplitude * distanceFactor;
          y += Math.sin(x * frequency2 + 0.5) * Math.sin(z * frequency2 + 0.5) * amplitude/2 * distanceFactor;
          
          // Aggiungiamo alcune montagne più alte in punti casuali
          const seed = 12345; // Seed fisso per risultati consistenti
          const mountainNoise = Math.sin(x * 0.01 * seed) * Math.sin(z * 0.01 * seed);
          if (mountainNoise > 0.7) { // Ridotto la soglia per più montagne
            y += amplitude * 2 * distanceFactor * (mountainNoise - 0.7) * 5;
          }
          
          // Aggiungiamo variazioni casuali per più realismo
          y += Math.sin(x * 0.1) * Math.sin(z * 0.1) * 2 * distanceFactor;
        }
        
        // Aggiorniamo la posizione Y
        positions[index + 1] = y;
      }
    }
    
    // Aggiorniamo la geometria
    geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate = true;
    
    // Creiamo un array di colori per ogni vertice
    const colors = new Float32Array(positions.length);
    
    // Assegnazione dei colori in base all'altezza
    for (let i = 0; i <= widthSegments; i++) {
      for (let j = 0; j <= heightSegments; j++) {
        const index = (i * (heightSegments + 1) + j) * 3;
        const height = positions[index + 1];
        
        // Colori base per diversi tipi di terreno
        const grassColor = new THREE.Color(0x567d46);
        const rockColor = new THREE.Color(0x8b8989);
        const snowColor = new THREE.Color(0xfffafa);
        
        let vertexColor;
        
        // Assegnazione del colore in base all'altezza
        if (height < 5) {
          // Erba per le zone basse
          vertexColor = grassColor;
        } else if (height < 15) {
          // Transizione tra erba e roccia
          const t = (height - 5) / 10;
          vertexColor = grassColor.clone().lerp(rockColor, t);
        } else {
          // Transizione tra roccia e neve per le cime
          const t = Math.min(1, (height - 15) / 10);
          vertexColor = rockColor.clone().lerp(snowColor, t);
        }
        
        // Aggiungiamo variazioni casuali per più realismo
        const x = (i / widthSegments - 0.5) * width;
        const z = (j / heightSegments - 0.5) * height;
        const noise = Math.sin(x * 0.1) * Math.sin(z * 0.1) * 0.1;
        vertexColor.r += noise;
        vertexColor.g += noise;
        vertexColor.b += noise;
        
        // Salviamo il colore nell'array
        colors[index] = vertexColor.r;
        colors[index + 1] = vertexColor.g;
        colors[index + 2] = vertexColor.b;
      }
    }
    
    // Aggiungiamo l'attributo colore alla geometria
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
  }, [width, height, widthSegments, heightSegments]);
  
  return (
    <mesh 
      ref={meshRef} 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={position}
      receiveShadow
      castShadow
    >
      <planeGeometry args={[width, height, widthSegments, heightSegments]} />
      <meshStandardMaterial 
        vertexColors 
        side={THREE.DoubleSide}
        roughness={0.8}
        metalness={0.2}
      />
    </mesh>
  );
}

export default FlatTerrain;