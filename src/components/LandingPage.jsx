import React, { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, PerspectiveCamera, Text } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { FlatTerrain } from './FlatTerrain'

function FloatingTitle({ position, scale = 1 }) {
  const groupRef = useRef()
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    groupRef.current.position.y = position[1] + Math.sin(time + position[0]) * 0.1
    groupRef.current.rotation.y = Math.sin(time * 0.5) * 0.1
  })

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <group ref={groupRef} position={position} scale={scale}>
        {/* N */}
        <mesh position={[-0.4, 0, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[-0.4, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.1, 0.6, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[-0.2, 0, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>

        {/* O */}
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.2, 0.05, 16, 32]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>

        {/* I */}
        <mesh position={[0.2, 0, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>

        {/* Z */}
        <mesh position={[0.4, 0.1, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.4, -0.1, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>

        {/* E */}
        <mesh position={[0.6, 0, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.7, 0.15, 0]}>
          <boxGeometry args={[0.2, 0.1, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.7, 0, 0]}>
          <boxGeometry args={[0.2, 0.1, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.7, -0.15, 0]}>
          <boxGeometry args={[0.2, 0.1, 0.1]} />
          <meshPhongMaterial color="#00ff87" emissive="#00ff87" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </Float>
  )
}

function Particles() {
  const particlesRef = useRef()
  const count = 1000
  const positions = new Float32Array(count * 3)
  
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10
  }

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    particlesRef.current.rotation.y = time * 0.1
    particlesRef.current.rotation.x = Math.sin(time * 0.1) * 0.1
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#60efff"
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  )
}

// Costanti fisiche per il movimento
const GRAVITY = 0.015;
const JUMP_FORCE = 0.3;
const MAX_FALL_SPEED = 0.5;
const PLAYER_HEIGHT = 2;
const ACCELERATION = 0.01;
const MAX_SPEED = 0.15;
const FRICTION = 0.85;

// Funzione per ottenere l'altezza del terreno in un punto
// Per il terreno piatto al centro, l'altezza è sempre 0
function getTerrainHeight(x, z) {
  // Distanza dal centro
  const distanceFromCenter = Math.sqrt(x * x + z * z);
  
  // Zona piatta al centro (raggio 30)
  const flatRadius = 30;
  
  // Se siamo nella zona piatta, l'altezza è 0
  if (distanceFromCenter <= flatRadius) {
    return 0;
  }
  
  // Oltre la zona piatta, calcoliamo l'altezza delle montagne
  // Fattore di distanza normalizzato
  const distanceFactor = (distanceFromCenter - flatRadius) / (250 - flatRadius);
  
  // Creiamo montagne usando funzioni seno
  const frequency1 = 0.02;
  const frequency2 = 0.05;
  const amplitude = 30; // Altezza massima delle montagne
  
  // Calcoliamo l'altezza usando funzioni seno
  let y = Math.sin(x * frequency1) * Math.sin(z * frequency1) * amplitude * distanceFactor;
  y += Math.sin(x * frequency2 + 0.5) * Math.sin(z * frequency2 + 0.5) * amplitude/2 * distanceFactor;
  
  // Aggiungiamo alcune montagne più alte in punti casuali
  const seed = 12345; // Seed fisso per risultati consistenti
  const mountainNoise = Math.sin(x * 0.01 * seed) * Math.sin(z * 0.01 * seed);
  if (mountainNoise > 0.7) {
    y += amplitude * 2 * distanceFactor * (mountainNoise - 0.7) * 5;
  }
  
  // Aggiungiamo variazioni casuali per più realismo
  y += Math.sin(x * 0.1) * Math.sin(z * 0.1) * 2 * distanceFactor;
  
  return y;
}

function Scene({ onFileUpload }) {
  const { camera, gl } = useThree();
  const [keysPressed, setKeysPressed] = useState({});
  const velocity = useRef(new THREE.Vector3());
  const verticalVelocity = useRef(0);
  const direction = useRef(new THREE.Vector3());
  const rotation = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const mouse = useRef({ x: 0, y: 0, moved: false });
  const isGrounded = useRef(true);
  const terrainRef = useRef();
  const PI_2 = Math.PI / 2;
  
  // Sensibilità del mouse - più alto = più sensibile
  const mouseSensitivity = 0.002;

  useEffect(() => {
    const handleKeyDown = (event) => {
      setKeysPressed(prev => ({ ...prev, [event.key.toLowerCase()]: true }));
      if (event.code === 'Space') {
        setKeysPressed(prev => ({ ...prev, space: true }));
      }
    };

    const handleKeyUp = (event) => {
      setKeysPressed(prev => ({ ...prev, [event.key.toLowerCase()]: false }));
      if (event.code === 'Space') {
        setKeysPressed(prev => ({ ...prev, space: false }));
      }
    };

    const handleMouseMove = (event) => {
      if (document.pointerLockElement === gl.domElement) {
        mouse.current.x += event.movementX;
        mouse.current.y += event.movementY;
        mouse.current.moved = true;
      }
    };
    
    const handleClick = () => {
      // Richiedi il blocco del puntatore al click
      gl.domElement.requestPointerLock();
    };

    // Aggiungi event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('click', handleClick);

    // Posiziona la camera iniziale a Y=PLAYER_HEIGHT (esattamente sopra il terreno a Y=0)
    camera.position.set(0, PLAYER_HEIGHT, 20);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [gl]);

  useFrame(() => {
    // Rotazione della camera con il mouse (look around)
    if (mouse.current.moved && document.pointerLockElement === gl.domElement) {
      rotation.current.setFromQuaternion(camera.quaternion);
      
      // Rotazione orizzontale (yaw)
      rotation.current.y -= mouse.current.x * mouseSensitivity;
      
      // Rotazione verticale (pitch) con limiti per evitare capovolgimenti
      rotation.current.x -= mouse.current.y * mouseSensitivity;
      rotation.current.x = Math.max(-PI_2 + 0.1, Math.min(PI_2 - 0.1, rotation.current.x));
      
      // Manteniamo la camera sempre orizzontale (nessuna rotazione z)
      rotation.current.z = 0;
      
      camera.quaternion.setFromEuler(rotation.current);
      
      // Reset dei delta del mouse
      mouse.current.x = 0;
      mouse.current.y = 0;
    }

    // Movimento WASD con fisica
    const forward = keysPressed.w || false;
    const backward = keysPressed.s || false;
    const left = keysPressed.a || false;
    const right = keysPressed.d || false;
    const jump = keysPressed.space || false;

    // Calcola la direzione di movimento basata sull'input
    direction.current.set(0, 0, 0);
    if (forward) direction.current.z += 1;
    if (backward) direction.current.z -= 1;
    if (left) direction.current.x -= 1;
    if (right) direction.current.x += 1;
    
    // Normalizza la direzione se ci stiamo muovendo in diagonale
    if (direction.current.lengthSq() > 0) {
      direction.current.normalize();
    }

    // Ottieni i vettori di direzione dalla rotazione della camera
    const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    
    // Rimuovi la componente Y per movimento orizzontale
    forwardVector.y = 0;
    forwardVector.normalize();
    rightVector.y = 0;
    rightVector.normalize();

    // Applica accelerazione graduale invece di velocità istantanea
    if (direction.current.z !== 0) {
      velocity.current.add(forwardVector.clone().multiplyScalar(direction.current.z * ACCELERATION));
    }
    if (direction.current.x !== 0) {
      velocity.current.add(rightVector.clone().multiplyScalar(direction.current.x * ACCELERATION));
    }
    
    // Limita la velocità massima
    if (velocity.current.lengthSq() > MAX_SPEED * MAX_SPEED) {
      velocity.current.normalize().multiplyScalar(MAX_SPEED);
    }
    
    // Applica attrito quando non ci sono input o per rallentare gradualmente
    velocity.current.multiplyScalar(FRICTION);
    
    // Se la velocità è molto bassa, azzerala per evitare micro-movimenti
    if (velocity.current.lengthSq() < 0.0001) {
      velocity.current.set(0, 0, 0);
    }

    // Calcola la nuova posizione orizzontale
    const newPosition = camera.position.clone().add(velocity.current);
    
    // Ottieni l'altezza del terreno sotto la nuova posizione
    const terrainHeight = getTerrainHeight(newPosition.x, newPosition.z);
    
    // Calcola l'altezza del giocatore rispetto al terreno
    const heightAboveTerrain = camera.position.y - terrainHeight;
    
    // Verifica se il giocatore è a terra
    if (heightAboveTerrain <= PLAYER_HEIGHT) {
      isGrounded.current = true;
      verticalVelocity.current = 0;
      camera.position.y = terrainHeight + PLAYER_HEIGHT;
      
      // Gestione del salto
      if (jump) {
        verticalVelocity.current = JUMP_FORCE;
        isGrounded.current = false;
      }
    } else {
      isGrounded.current = false;
      
      // Applica gravità
      verticalVelocity.current -= GRAVITY;
      
      // Limita la velocità di caduta
      if (verticalVelocity.current < -MAX_FALL_SPEED) {
        verticalVelocity.current = -MAX_FALL_SPEED;
      }
    }
    
    // Aggiorna la posizione verticale
    camera.position.y += verticalVelocity.current;
    
    // Aggiorna la posizione orizzontale
    camera.position.add(velocity.current);
    
    // Assicurati che la camera non vada mai sotto il terreno
    const finalTerrainHeight = getTerrainHeight(camera.position.x, camera.position.z);
    if (camera.position.y < finalTerrainHeight + PLAYER_HEIGHT) {
      camera.position.y = finalTerrainHeight + PLAYER_HEIGHT;
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, PLAYER_HEIGHT, 20]} fov={75} />
      
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[50, 50, 25]} 
        intensity={1.0} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <hemisphereLight intensity={0.5} color="#87CEEB" groundColor="#8B4513" />
      
      <FloatingTitle position={[0, 5, 0]} scale={1.5} />
      
      {/* Terreno piatto a Y=0 con montagne in lontananza */}
      <FlatTerrain 
        ref={terrainRef}
        width={500} 
        height={500} 
        widthSegments={100}
        heightSegments={100}
        color="#4a7c59"
        position={[0, 0, 0]} // Esattamente a Y=0
      />
      
      {/* Piano d'acqua semplice */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.2, 0]} // Leggermente sotto il terreno
        receiveShadow
      >
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial 
          color="#0077be"
          transparent
          opacity={0.8}
          roughness={0.1}
          metalness={0.6}
        />
      </mesh>
      
      <Particles />
      
      {/* Interactive Mesh Button */}
      <mesh
        position={[0, 1, 0]} // Sopra il terreno a Y=0
        onClick={(e) => {
          e.stopPropagation()
          document.getElementById('fileInput').click()
        }}
      >
        <boxGeometry args={[2, 0.5, 0.1]} />
        <meshPhongMaterial
          color="#00ff87"
          transparent
          opacity={0.9}
          emissive="#00ff87"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Istruzioni di controllo */}
      <mesh position={[0, 0.3, 0]}> {/* Sopra il terreno a Y=0 */}
        <boxGeometry args={[4, 0.5, 0.1]} />
        <meshBasicMaterial color="#333333" transparent opacity={0.7} />
      </mesh>
      <Text 
        position={[0, 0.3, 0.06]} 
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        WASD: Movimento | Spazio: Salto | Mouse: Guarda
      </Text>
    </>
  )
}

const LandingPage = ({ onFileUpload }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    }}>
      <Canvas shadows>
        <Scene onFileUpload={onFileUpload} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.075} intensity={0.8} />
        </EffectComposer>
      </Canvas>
      <input
        id="fileInput"
        type="file"
        accept="audio/*"
        onChange={onFileUpload}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default LandingPage
