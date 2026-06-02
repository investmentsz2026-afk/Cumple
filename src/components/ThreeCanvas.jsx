import React, { useEffect, useRef } from 'react';
import { ThreeSceneManager } from '../3d/ThreeSceneManager';

export default function ThreeCanvas({
  phase,
  micVolume,
  blowProgress,
  onBlowComplete,
  onTransitionComplete,
  onPhotoSelect,
  canvasRef
}) {
  const containerRef = useRef(null);
  const managerRef = useRef(null);

  // Initialize scene manager on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new ThreeSceneManager(containerRef.current, {
      onBlowComplete,
      onTransitionComplete,
      onPhotoSelect
    });
    
    managerRef.current = manager;
    if (canvasRef) {
      canvasRef.current = manager;
    }

    // Set initial phase
    manager.setPhase(phase);

    // Cleanup on unmount
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
      }
    };
  }, []);

  // Update phase when it changes
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setPhase(phase);
    }
  }, [phase]);

  // Pass microphone volume down to the 3D scene in real-time
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.updateVolume(micVolume);
    }
  }, [micVolume]);

  // Pass blow progress down to the 3D scene in real-time
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.updateBlowProgress(blowProgress);
    }
  }, [blowProgress]);

  return <div ref={containerRef} className="canvas-container" />;
}
