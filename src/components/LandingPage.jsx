import React, { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, PerspectiveCamera, Text } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import FlatTerrain from './FlatTerrain'

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

function Scene({ onFileUpload }) {
  const { camera, gl } = useThree();
  const [keysPressed, setKeysPressed] = useState({});
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const rotation = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const mouse = useRef({ x: 0, y: 0, moved: false });
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
      mouse.current.x += event.movementX;
      mouse.current.y += event.movementY;
      mouse.current.moved = true;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    camera.position.set(0, 2, 10);
    camera.lookAt(0, 2, 20);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gl]);

  useFrame(() => {
    if (mouse.current.moved) {
      rotation.current.setFromQuaternion(camera.quaternion);
      rotation.current.y -= mouse.current.x * mouseSensitivity;
      rotation.current.x -= mouse.current.y * mouseSensitivity;
      rotation.current.x = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, rotation.current.x));
      rotation.current.z = 0;
      camera.quaternion.setFromEuler(rotation.current);
      mouse.current.x = 0;
      mouse.current.y = 0;
    }
    let moveX = 0;
    let moveZ = 0;
    const speed = 0.7;
    if (keysPressed.w) moveZ -= speed;
    if (keysPressed.s) moveZ += speed;
    if (keysPressed.a) moveX -= speed;
    if (keysPressed.d) moveX += speed;
    const angle = camera.rotation.y;
    const dx = moveX * Math.cos(angle) - moveZ * Math.sin(angle);
    const dz = moveZ * Math.cos(angle) + moveX * Math.sin(angle);
    camera.position.x += dx;
    camera.position.z += dz;
    camera.position.y = 2;
    direction.current.set(0, 0, 0);
    if (keysPressed.w) direction.current.z += 1;
    if (keysPressed.s) direction.current.z -= 1;
    if (keysPressed.a) direction.current.x -= 1;
    if (keysPressed.d) direction.current.x += 1;
    if (direction.current.lengthSq() > 0) direction.current.normalize();
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2, 10]} fov={60} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[100, 200, 100]} intensity={1.5} castShadow />
      <hemisphereLight intensity={0.7} color="#b1e1ff" groundColor="#222" />
      <FloatingTitle position={[0, 5, 0]} scale={1.5} />
      <FlatTerrain width={500} height={500} position={[0, 0, 0]} />
      <Particles />
      {/* Bottone per upload file audio */}
      <mesh position={[0, 1, 0]} onClick={(e) => { e.stopPropagation(); document.getElementById('fileInput').click(); }}>
        <boxGeometry args={[2, 0.5, 0.1]} />
        <meshPhongMaterial color="#00ff87" transparent opacity={0.9} emissive="#00ff87" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[4, 0.5, 0.1]} />
        <meshBasicMaterial color="#333" transparent opacity={0.7} />
      </mesh>
      <Text position={[0, 0.3, 0.06]} fontSize={0.15} color="white" anchorX="center" anchorY="middle">
        WASD: Movimento | Mouse: Guarda
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
      background: 'black',
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
