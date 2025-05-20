import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useTexture, Instances, Instance } from '@react-three/drei';

// Import BufferGeometryUtils as a namespace
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Utility function to create random variations
const random = (min, max) => Math.random() * (max - min) + min;

// Custom hook for creating noise (using a simpler approach without SimplexNoise)
function useNoise() {
  return useMemo(() => {
    // Simple noise function using sine waves
    return (x, y, z) => {
      const scale = 0.1;
      return (
        Math.sin(x * scale) * Math.cos(y * scale) * 0.5 +
        Math.sin(y * scale + 100) * Math.cos(z * scale + 100) * 0.5 +
        Math.sin(z * scale + 200) * Math.cos(x * scale + 200) * 0.5
      );
    };
  }, []);
}

// Leaf component for autumn leaves on ground
function Leaf({ position, rotation, scale, color }) {
  return (
    <Instance 
      position={position} 
      rotation={rotation} 
      scale={scale} 
      color={color} 
    />
  );
}

// Leaves instances for ground
function AutumnLeaves({ count = 1000, radius = 15 }) {
  const colors = useMemo(() => [
    '#e6794b', // Orange
    '#c46d3b', // Dark orange
    '#9a4e1c', // Brown
    '#d9a566', // Light brown
    '#eec170', // Yellow
    '#bf2a0d', // Red
  ], []);

  const leaves = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const theta = random(0, Math.PI * 2);
      const r = Math.sqrt(random(0, 1)) * radius;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      
      // More leaves near the house and path
      const distanceFromPath = Math.abs(x);
      const density = distanceFromPath < 2 ? 0.3 : 1;
      
      if (Math.random() > density) return null;
      
      // Avoid leaves directly on the path
      if (Math.abs(x) < 1.2 && z > 0 && z < 10) return null;
      
      return {
        position: [x, 0.05 + random(0, 0.1), z],
        rotation: [random(0, Math.PI * 2), random(0, Math.PI * 2), random(0, Math.PI * 2)],
        scale: [random(0.2, 0.4), random(0.2, 0.4), 0.02],
        color: colors[Math.floor(random(0, colors.length))],
      };
    }).filter(Boolean);
  }, [count, radius, colors]);

  return (
    <Instances limit={count}>
      <planeGeometry />
      <meshStandardMaterial 
        vertexColors 
        side={THREE.DoubleSide} 
        roughness={0.8}
      />
      {leaves.map((props, i) => (
        <Leaf key={i} {...props} />
      ))}
    </Instances>
  );
}

// Stone for the path
function Stone({ position, scale, rotation }) {
  const stoneColor = useMemo(() => {
    const colors = ['#7d7d7d', '#8a8a8a', '#686868', '#909090'];
    return colors[Math.floor(random(0, colors.length))];
  }, []);

  return (
    <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial 
        color={stoneColor} 
        roughness={0.9} 
        metalness={0.1}
      />
    </mesh>
  );
}

// Path of stones leading to the house
function StonePath() {
  const stones = useMemo(() => {
    const result = [];
    // Main path
    for (let z = 1; z < 9; z += 0.6) {
      const xOffset = Math.sin(z * 0.8) * 0.3;
      result.push({
        position: [xOffset, 0.05, z],
        scale: [random(0.2, 0.3), random(0.05, 0.1), random(0.2, 0.3)],
        rotation: [0, random(0, Math.PI * 2), 0],
      });
      
      // Add some stones to the sides for natural look
      if (Math.random() > 0.7) {
        result.push({
          position: [xOffset + random(0.3, 0.5) * (Math.random() > 0.5 ? 1 : -1), 0.03, z + random(-0.2, 0.2)],
          scale: [random(0.1, 0.2), random(0.03, 0.07), random(0.1, 0.2)],
          rotation: [0, random(0, Math.PI * 2), 0],
        });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {stones.map((props, i) => (
        <Stone key={i} {...props} />
      ))}
    </group>
  );
}

// Tree trunk with complex geometry
function TreeTrunk({ position, scale, rotation, trunkColor }) {
  const noise = useNoise();
  
  // Create complex trunk geometry
  const trunkGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(1.5, 1.8, 10, 12, 10, true);
    const pos = geometry.attributes.position;
    
    // Deform the cylinder to make it look more natural
    for (let i = 0; i < pos.count; i++) {
      const vertex = new THREE.Vector3();
      vertex.fromBufferAttribute(pos, i);
      
      // Skip top and bottom caps
      if (vertex.y !== 5 && vertex.y !== -5) {
        const noise1 = noise(vertex.x * 0.2, vertex.y * 0.1, vertex.z * 0.2) * 0.5;
        const noise2 = noise(vertex.x * 0.4 + 100, vertex.y * 0.2 + 100, vertex.z * 0.4 + 100) * 0.3;
        
        // More deformation at the bottom for roots
        const rootEffect = Math.max(0, 1 - (vertex.y + 5) / 3);
        const rootNoise = noise(vertex.x * 0.5 + 200, vertex.y * 0.1 + 200, vertex.z * 0.5 + 200) * rootEffect;
        
        vertex.x += (noise1 + rootNoise) * 1.5;
        vertex.z += (noise2 + rootNoise) * 1.5;
      }
      
      pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    geometry.computeVertexNormals();
    return geometry;
  }, [noise]);

  return (
    <mesh 
      geometry={trunkGeometry}
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial 
        color={trunkColor || "#5d4037"} 
        roughness={0.9}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Foliage for trees
function TreeFoliage({ position, scale, foliageColors }) {
  const colors = useMemo(() => foliageColors || [
    '#ffb74d', // Orange
    '#ff9800', // Darker orange
    '#ffc107', // Amber
    '#ff7043', // Deep orange
    '#e65100', // Dark orange
    '#ffeb3b', // Yellow
  ], [foliageColors]);

  const foliageGroups = useMemo(() => {
    const groups = [];
    const groupCount = Math.floor(random(4, 7));
    
    for (let i = 0; i < groupCount; i++) {
      const x = random(-3, 3);
      const y = random(3, 7);
      const z = random(-3, 3);
      
      const color = colors[Math.floor(random(0, colors.length))];
      const size = random(1.5, 2.5);
      
      groups.push({ position: [x, y, z], color, size });
    }
    
    return groups;
  }, [colors]);

  return (
    <group position={position} scale={scale}>
      {foliageGroups.map((group, i) => (
        <mesh key={i} position={group.position} castShadow>
          <sphereGeometry args={[group.size, 8, 8]} />
          <meshStandardMaterial 
            color={group.color} 
            roughness={0.8}
            metalness={0.1}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

// Complete tree component
function Tree({ position, scale = 1, rotation = [0, 0, 0], trunkColor, foliageColors }) {
  const actualScale = Array.isArray(scale) ? scale : [scale, scale, scale];
  
  return (
    <group position={position} rotation={rotation}>
      <TreeTrunk 
        position={[0, 0, 0]} 
        scale={actualScale} 
        trunkColor={trunkColor}
      />
      <TreeFoliage 
        position={[0, 0, 0]} 
        scale={actualScale} 
        foliageColors={foliageColors}
      />
    </group>
  );
}

// Ivy leaf for the rampant vegetation
function IvyLeaf({ position, rotation, scale }) {
  return (
    <mesh position={position} rotation={rotation} scale={scale} castShadow>
      <planeGeometry />
      <meshStandardMaterial 
        color="#4caf50" 
        side={THREE.DoubleSide}
        roughness={0.7}
        metalness={0.1}
      />
    </mesh>
  );
}

// Ivy vine system
function IvySystem({ startPosition, length, direction, branchCount = 5 }) {
  const leaves = useMemo(() => {
    const result = [];
    const mainDirection = new THREE.Vector3(...direction).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(mainDirection, up).normalize();
    
    // Create main vine
    for (let i = 0; i < length; i += 0.2) {
      const position = new THREE.Vector3(...startPosition).add(
        mainDirection.clone().multiplyScalar(i)
      );
      
      // Add some natural variation
      position.add(
        right.clone().multiplyScalar(Math.sin(i * 2) * 0.1)
      );
      
      // Add leaves along the vine
      if (Math.random() > 0.7) {
        const leafPosition = position.clone();
        const leafRotation = [
          random(-0.3, 0.3),
          random(0, Math.PI * 2),
          random(-0.3, 0.3)
        ];
        const leafScale = [random(0.1, 0.2), random(0.1, 0.2), 1];
        
        result.push({
          position: [leafPosition.x, leafPosition.y, leafPosition.z],
          rotation: leafRotation,
          scale: leafScale
        });
      }
    }
    
    // Create branches
    for (let b = 0; b < branchCount; b++) {
      const branchStart = random(0.3, 0.8) * length;
      const branchPosition = new THREE.Vector3(...startPosition).add(
        mainDirection.clone().multiplyScalar(branchStart)
      );
      
      const branchDirection = [
        mainDirection.x + random(-0.5, 0.5),
        mainDirection.y + random(-0.3, 0.3),
        mainDirection.z + random(-0.5, 0.5)
      ];
      
      const branchLength = random(1, 3);
      
      // Normalize branch direction
      const branchDir = new THREE.Vector3(...branchDirection).normalize();
      
      // Create leaves along the branch
      for (let i = 0; i < branchLength; i += 0.2) {
        const position = branchPosition.clone().add(
          branchDir.clone().multiplyScalar(i)
        );
        
        if (Math.random() > 0.6) {
          const leafRotation = [
            random(-0.3, 0.3),
            random(0, Math.PI * 2),
            random(-0.3, 0.3)
          ];
          const leafScale = [random(0.1, 0.2), random(0.1, 0.2), 1];
          
          result.push({
            position: [position.x, position.y, position.z],
            rotation: leafRotation,
            scale: leafScale
          });
        }
      }
    }
    
    return result;
  }, [startPosition, length, direction, branchCount]);

  return (
    <group>
      {leaves.map((props, i) => (
        <IvyLeaf key={i} {...props} />
      ))}
    </group>
  );
}

// Lantern component
function Lantern({ position }) {
  return (
    <group position={position}>
      {/* Lantern body */}
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.4, 0.3]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>
      
      {/* Lantern top */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 0.2, 8]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>
      
      {/* Glass panels */}
      <mesh position={[0, 0, 0.16]} castShadow>
        <planeGeometry args={[0.28, 0.38]} />
        <meshStandardMaterial 
          color="#fffde7" 
          transparent 
          opacity={0.7} 
          emissive="#fffde7"
          emissiveIntensity={0.5}
        />
      </mesh>
      
      <mesh position={[0, 0, -0.16]} castShadow>
        <planeGeometry args={[0.28, 0.38]} />
        <meshStandardMaterial 
          color="#fffde7" 
          transparent 
          opacity={0.7} 
          emissive="#fffde7"
          emissiveIntensity={0.5}
        />
      </mesh>
      
      <mesh position={[0.16, 0, 0]} rotation={[0, Math.PI/2, 0]} castShadow>
        <planeGeometry args={[0.28, 0.38]} />
        <meshStandardMaterial 
          color="#fffde7" 
          transparent 
          opacity={0.7} 
          emissive="#fffde7"
          emissiveIntensity={0.5}
        />
      </mesh>
      
      <mesh position={[-0.16, 0, 0]} rotation={[0, Math.PI/2, 0]} castShadow>
        <planeGeometry args={[0.28, 0.38]} />
        <meshStandardMaterial 
          color="#fffde7" 
          transparent 
          opacity={0.7} 
          emissive="#fffde7"
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Light source */}
      <pointLight 
        position={[0, 0, 0]} 
        intensity={0.8} 
        color="#fffde7" 
        distance={3} 
        decay={2}
      />
      
      {/* Hook */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <torusGeometry args={[0.05, 0.02, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// Light rays effect
function GodRays({ position, intensity = 1 }) {
  const { scene } = useThree();
  const rayCount = 5;
  
  useEffect(() => {
    // Create a light for the god rays effect
    const light = new THREE.DirectionalLight('#ffb74d', intensity);
    light.position.set(...position);
    light.castShadow = true;
    
    // Configure shadow properties
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 50;
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;
    light.shadow.bias = -0.0001;
    
    scene.add(light);
    
    return () => {
      scene.remove(light);
    };
  }, [scene, position, intensity]);
  
  return (
    <group>
      {Array.from({ length: rayCount }).map((_, i) => {
        const angle = (i / rayCount) * Math.PI * 2;
        const rayPosition = [
          position[0] + Math.cos(angle) * 0.5,
          position[1],
          position[2] + Math.sin(angle) * 0.5
        ];
        
        return (
          <mesh 
            key={i} 
            position={rayPosition}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.05, 0.2, 20, 8, 1, true]} />
            <meshBasicMaterial 
              color="#ffb74d" 
              transparent 
              opacity={0.2} 
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// Main component
export default function FlatTerrain({
  width = 500,
  height = 500,
  position = [0, 0, 0]
}) {
  const meshRef = useRef();

  return (
    <>
      {/* Ambient light for overall scene */}
      <ambientLight intensity={0.3} color="#fffbe6" />
      
      {/* Main directional light (sun) */}
      <directionalLight 
        position={[15, 12, 10]} 
        intensity={1.5} 
        color="#ffb74d" 
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      {/* God rays effect */}
      <GodRays position={[15, 12, 10]} intensity={1.2} />
      
      {/* Forest floor */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
      >
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial 
          color={'#654321'} 
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
      
      {/* Autumn leaves on ground */}
      <AutumnLeaves count={2000} radius={20} />
      
      {/* Stone path to cabin */}
      <StonePath />
      
      {/* Trees */}
      <Tree 
        position={[-8, 0, -3]} 
        scale={1.2} 
        rotation={[0, random(0, Math.PI * 2), 0]} 
      />
      <Tree 
        position={[10, 0, -5]} 
        scale={1.5} 
        rotation={[0, random(0, Math.PI * 2), 0]} 
      />
      <Tree 
        position={[-12, 0, 8]} 
        scale={1.3} 
        rotation={[0, random(0, Math.PI * 2), 0]} 
      />
      <Tree 
        position={[12, 0, 12]} 
        scale={1.4} 
        rotation={[0, random(0, Math.PI * 2), 0]} 
      />
      
      {/* Cabin structure - improved, large, with real triangular roof and open door */}
      <group position={[0, 0.5, 0]}>
        {/* Foundation */}
        <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
          <boxGeometry args={[8, 0.2, 6]} />
          <meshStandardMaterial color="#6e4b1f" roughness={0.9} />
        </mesh>
        {/* Log cabin walls - continuous logs, no buchi */}
        {[...Array(12)].map((_, i) => (
          <group key={`logs-row-${i}`}>
            {/* Front wall logs, with door opening */}
            <mesh position={[-1.1, 0.35 + i * 0.4, 3]} castShadow receiveShadow>
              <boxGeometry args={[2.2, 0.35, 0.35]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#a67c52' : '#8b5c2a'} roughness={0.9} metalness={0.1} />
            </mesh>
            <mesh position={[1.6, 0.35 + i * 0.4, 3]} castShadow receiveShadow>
              <boxGeometry args={[2.8, 0.35, 0.35]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#a67c52' : '#8b5c2a'} roughness={0.9} metalness={0.1} />
            </mesh>
            {/* Back wall logs */}
            <mesh position={[0, 0.35 + i * 0.4, -3]} castShadow receiveShadow>
              <boxGeometry args={[6, 0.35, 0.35]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#a67c52' : '#8b5c2a'} roughness={0.9} metalness={0.1} />
            </mesh>
            {/* Left wall logs */}
            <mesh position={[-4, 0.35 + i * 0.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.35, 0.35, 6]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#a67c52' : '#8b5c2a'} roughness={0.9} metalness={0.1} />
            </mesh>
            {/* Right wall logs */}
            <mesh position={[4, 0.35 + i * 0.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.35, 0.35, 6]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#a67c52' : '#8b5c2a'} roughness={0.9} metalness={0.1} />
            </mesh>
          </group>
        ))}
        {/* Door frame (open) */}
        <mesh position={[0.25, 1.7, 3.18]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 3.4, 0.2]} />
          <meshStandardMaterial color="#5d4037" roughness={0.9} />
        </mesh>
        {/* Window */}
        <mesh position={[2.2, 2.2, 3.18]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 1.5, 0.1]} />
          <meshStandardMaterial color="#fffbe6" transparent opacity={0.7} metalness={0.2} roughness={0.2} emissive="#fffbe6" emissiveIntensity={0.5} />
        </mesh>
        {/* Window frame */}
        <mesh position={[2.2, 2.2, 3.23]} castShadow>
          <boxGeometry args={[1.6, 1.6, 0.15]} />
          <meshStandardMaterial color="#5d4037" roughness={0.9} />
        </mesh>
        {/* Window cross */}
        <mesh position={[2.2, 2.2, 3.29]} castShadow>
          <boxGeometry args={[0.1, 1.5, 0.05]} />
          <meshStandardMaterial color="#5d4037" roughness={0.9} />
        </mesh>
        <mesh position={[2.2, 2.2, 3.29]} rotation={[0, 0, Math.PI/2]} castShadow>
          <boxGeometry args={[0.1, 1.5, 0.05]} />
          <meshStandardMaterial color="#5d4037" roughness={0.9} />
        </mesh>
        {/* Triangular roof (two planes) */}
        <mesh position={[0, 5.2, 0]} rotation={[Math.PI/4, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[8.5, 0.3, 5.5]} />
          <meshStandardMaterial color="#5d4037" roughness={0.9} />
        </mesh>
        <mesh position={[0, 5.2, 0]} rotation={[-Math.PI/4, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[8.5, 0.3, 5.5]} />
          <meshStandardMaterial color="#5d4037" roughness={0.9} />
        </mesh>
        {/* Roof ridge */}
        <mesh position={[0, 6.1, 0]} castShadow>
          <boxGeometry args={[8.5, 0.18, 0.4]} />
          <meshStandardMaterial color="#3e1c00" />
        </mesh>
        {/* Chimney */}
        <mesh position={[2.5, 6.5, 0]} castShadow>
          <boxGeometry args={[0.6, 1.5, 0.6]} />
          <meshStandardMaterial color="#757575" roughness={0.9} />
        </mesh>
        {/* Lantern */}
        <Lantern position={[1.2, 2.5, 3.3]} />
        {/* Ivy system on right side of cabin */}
        <IvySystem startPosition={[4.2, 0.2, 2.5]} length={5} direction={[0, 1, 0]} branchCount={8} />
        <IvySystem startPosition={[4.2, 0.2, 1.5]} length={4} direction={[0, 1, 0.2]} branchCount={6} />
        <IvySystem startPosition={[4.2, 0.2, 0.5]} length={3.5} direction={[0, 1, 0.1]} branchCount={5} />
        {/* Steps to door */}
        {[...Array(3)].map((_, i) => (
          <mesh key={`step-${i}`} position={[0, 0.1 + i * 0.15, 2.5 + 0.3 + i * 0.3]} castShadow receiveShadow>
            <boxGeometry args={[1.4 - i * 0.1, 0.12, 0.3]} />
            <meshStandardMaterial color="#757575" roughness={0.9} />
          </mesh>
        ))}
      </group>
      
      {/* Reference plane (invisible in final render) */}
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={position}
        receiveShadow
        visible={false}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={'#000'} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
