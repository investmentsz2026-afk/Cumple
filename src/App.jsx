import React, { useState, useEffect, useRef } from 'react';
import ThreeCanvas from './components/ThreeCanvas';
import confetti from 'canvas-confetti';
import { Mic, X, Heart, Sparkles, Volume2, VolumeX } from 'lucide-react';

const LYRICS = [
  "Cumpleaños feliz,",
  "te deseo a ti,",
  "cumpleaños Mi AMOR,",
  "que los cumplas feliz."
];

export default function App() {
  const [phase, setPhase] = useState('welcome'); // welcome, lyrics, wish, mic_active, transition, saturn
  const [lyricsIndex, setLyricsIndex] = useState(-1);
  const [micVolume, setMicVolume] = useState(0);
  const [blowProgress, setBlowProgress] = useState(0);
  const [activePhoto, setActivePhoto] = useState(null);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [contadorToques, setContadorToques] = useState(0);
  const [indicadorMensaje, setIndicadorMensaje] = useState("Toca la pantalla mi amor ❤️");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);

  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const preloadedStreamRef = useRef(null);
  const phaseRef = useRef(phase);
  const consecutiveBlowsRef = useRef(0);
  const blowProgressRef = useRef(0);
  const lluviaCorazonesActivaRef = useRef(false);
  const recognitionRef = useRef(null);

  const bgMusicRef = useRef(null);
  const musicUnlockedRef = useRef(false);

  // Sync ref with phase state
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // No microphone preloading needed (simulated soplido)

  // Initialize background music
  useEffect(() => {
    const music = new Audio('/musica.mp3');
    music.loop = true;
    music.volume = 1.0;
    bgMusicRef.current = music;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    music.addEventListener('play', handlePlay);
    music.addEventListener('pause', handlePause);

    // Try playing immediately (works if browser autoplay is relaxed)
    music.play().then(() => {
      setIsPlaying(true);
      musicUnlockedRef.current = true;
    }).catch(err => {
      console.log("Music autoplay blocked, waiting for first user interaction.");
    });

    return () => {
      music.removeEventListener('play', handlePlay);
      music.removeEventListener('pause', handlePause);
      music.pause();
    };
  }, []);

  // Helper to play background music if not playing
  const playMusic = () => {
    if (bgMusicRef.current && bgMusicRef.current.paused) {
      bgMusicRef.current.play().then(() => {
        setIsPlaying(true);
        musicUnlockedRef.current = true;
      }).catch(err => {
        console.warn("Music play failed:", err);
      });
    }
  };

  // Listen to first touch/click interaction to unlock and play music
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (musicUnlockedRef.current) {
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
        return;
      }
      if (bgMusicRef.current) {
        bgMusicRef.current.play().then(() => {
          setIsPlaying(true);
          musicUnlockedRef.current = true;
          window.removeEventListener('click', handleFirstInteraction);
          window.removeEventListener('touchstart', handleFirstInteraction);
        }).catch(err => {
          console.warn("Play on interaction blocked:", err);
        });
      }
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    // No-op (microphone deactivated)
  };

  const handleStartExperience = () => {
    if (phase !== 'welcome') return;
    playMusic();
    setPhase('lyrics');
    setLyricsIndex(0);
  };

  // Synchronize Karaoke lyrics timing
  useEffect(() => {
    if (phase !== 'lyrics') return;

    const timer = setInterval(() => {
      setLyricsIndex(prev => {
        if (prev < LYRICS.length - 1) {
          return prev + 1;
        } else {
          clearInterval(timer);
          setTimeout(() => {
            setPhase('wish');
          }, 2000);
          return prev;
        }
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [phase]);

  const handleActivateMicrophone = () => {
    playMusic();
    setPhase('mic_active');
    phaseRef.current = 'mic_active';
    blowProgressRef.current = 0;
    setBlowProgress(0);

    const startTime = Date.now();

    const simulateBlow = () => {
      if (phaseRef.current !== 'mic_active') return;

      const elapsed = Date.now() - startTime;
      
      // Cooldown of 600ms to allow transition to start smoothly
      if (elapsed > 600) {
        // Increment progress: takes ~5 seconds (300 frames at 60fps)
        // Add random fluctuation to look organic
        const increment = 0.22 + Math.random() * 0.22;
        blowProgressRef.current = Math.min(100, blowProgressRef.current + increment);
        setBlowProgress(blowProgressRef.current);

        // Also simulate a little bit of sound input for the 3D flames scaling effect
        // Set volume to wobble between 0.15 and 0.45 during soplado
        const simulatedVol = 0.15 + Math.random() * 0.30;
        setMicVolume(simulatedVol);
      } else {
        setMicVolume(0);
      }

      if (blowProgressRef.current >= 100) {
        triggerExtinguishCandles();
        return;
      }

      requestAnimationFrame(simulateBlow);
    };

    requestAnimationFrame(simulateBlow);
  };

  const triggerExtinguishCandles = () => {
    cleanupAudio();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setMicVolume(0);
    setPhase('transition');
    if (canvasRef.current) {
      canvasRef.current.blowOutCandles();
    }
  };

  const handleTransitionComplete = () => {
    setPhase('saturn');
    
    // Initial entrance confetti shower
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#ff5e84', '#f5c665', '#4d94ff', '#ffffff']
    });

    // NOTE: We no longer auto-trigger the final message timeout!
    // The user can explore Saturn freely until they click the dedicate button.
  };

  // Handle Raycasted Photo Clicks
  const handlePhotoSelectIn3D = (orbitInfo) => {
    setActivePhoto(orbitInfo);
  };

  const handleClosePhotoDetail = () => {
    setActivePhoto(null);
    if (canvasRef.current) {
      canvasRef.current.resetPhotoZoom();
    }
  };

  const toggleMusic = (e) => {
    e.stopPropagation();
    if (bgMusicRef.current) {
      if (isPlaying) {
        bgMusicRef.current.pause();
      } else {
        bgMusicRef.current.play().catch(err => console.warn("Failed to play on toggle:", err));
      }
    }
  };

  const handleResetExperience = () => {
    setShowFinalMessage(false);
    setLyricsIndex(-1);
    setMicVolume(0);
    setBlowProgress(0);
    blowProgressRef.current = 0;
    setActivePhoto(null);
    setContadorToques(0);
    setIndicadorMensaje("Toca la pantalla mi amor ❤️");
    setPhase('welcome');
    setShowGiftModal(false);
  };

  // ==========================================
  // CLICK INTERACTIONS (PORTED FROM SATURNO FOLDER)
  // ==========================================

  const handleScreenInteraction = (e) => {
    if (phase !== 'saturn') return;

    // Check if clicked element is an interactive overlay/button/modal to prevent interfering with details view
    if (
      e.target.closest('.photo-detail-modal') ||
      e.target.closest('.final-card') ||
      e.target.closest('.interactive-element') ||
      e.target.closest('.btn-premium') ||
      e.target.closest('.btn-close')
    ) {
      return;
    }

    // 1. Increment touch counter and update text instructions
    const nuevosToques = contadorToques + 1;
    setContadorToques(nuevosToques);

    if (nuevosToques === 5) {
      setIndicadorMensaje("¡Eres increíble! Cada toque es un latido de mi corazón ❤️");
    } else if (nuevosToques === 10) {
      setIndicadorMensaje("Eres el amor de mi vida 💖");
    } else if (nuevosToques >= 15) {
      const mensajes = [
        "Mi corazón late por ti",
        "Eres mi sueño hecho realidad",
        "Eres mi todo",
        "Te amo más cada día",
        "Eres mi razón de ser"
      ];
      setIndicadorMensaje(mensajes[Math.floor(Math.random() * mensajes.length)]);
    }

    // 2. Trigger 3D Falling Hearts
    if (canvasRef.current && canvasRef.current.spawn3DHearts) {
      canvasRef.current.spawn3DHearts();
    }

    // 3. Trigger 2D Floating Text Explosion
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    crearExplosionTextoCSS(clientX, clientY);

    // 4. Trigger 2D Falling Hearts Shower
    crearLluviaCorazonesCSS();
  };

  const crearExplosionTextoCSS = (x, y) => {
    const textosAmor = ["TE AMO", "ERES MÍA", "MI AMOR", "PARA SIEMPRE", "MI VIDA", "MI TODO", "MI CORAZÓN", "MI ALMA", "TE QUIERO", "MI REINA"];
    const textoAleatorio = textosAmor[Math.floor(Math.random() * textosAmor.length)];

    const div = document.createElement('div');
    div.innerHTML = textoAleatorio;
    div.style.position = 'absolute';
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.style.fontSize = '24px';
    div.style.color = '#ff5e84';
    div.style.fontWeight = 'bold';
    div.style.textShadow = '0 0 10px #ff1493, 0 0 20px rgba(255, 94, 132, 0.4)';
    div.style.zIndex = '100';
    div.style.pointerEvents = 'none';
    div.style.transform = 'translate(-50%, -50%)';
    div.style.animation = 'animacionExplosionTexto 1.5s ease-out forwards';

    document.body.appendChild(div);

    setTimeout(() => {
      if (div.parentNode) {
        div.parentNode.removeChild(div);
      }
    }, 1500);
  };

  const crearLluviaCorazonesCSS = () => {
    if (lluviaCorazonesActivaRef.current) return;
    lluviaCorazonesActivaRef.current = true;

    const spawnCount = 20;
    for (let i = 0; i < spawnCount; i++) {
      setTimeout(() => {
        if (phaseRef.current !== 'saturn') return;

        const corazon = document.createElement('div');
        corazon.innerHTML = '❤️';
        corazon.style.position = 'absolute';
        corazon.style.top = '-50px';
        corazon.style.left = `${Math.random() * 100}vw`;
        corazon.style.fontSize = `${Math.random() * 20 + 18}px`;
        corazon.style.zIndex = '90';
        corazon.style.pointerEvents = 'none';
        corazon.style.textShadow = '0 0 8px #ff1493';
        
        const duration = Math.random() * 2 + 2;
        corazon.style.animation = `caer ${duration}s linear forwards`;

        document.body.appendChild(corazon);

        setTimeout(() => {
          if (corazon.parentNode) {
            corazon.parentNode.removeChild(corazon);
          }
        }, duration * 1000);
      }, i * 80);
    }

    setTimeout(() => {
      lluviaCorazonesActivaRef.current = false;
    }, 3000);
  };

  const handleShowFinalCard = () => {
    setShowFinalMessage(true);

    // Continuous celebration confetti bursts
    const duration = 3.5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ff5e84', '#f5c665']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ff5e84', '#f5c665']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  return (
    <div 
      className={`app-container phase-${phase}`}
      onClick={handleScreenInteraction}
      onTouchStart={handleScreenInteraction}
    >
      {/* 3D WebGL Canvas Component */}
      <ThreeCanvas
        phase={phase}
        micVolume={micVolume}
        blowProgress={blowProgress}
        onBlowComplete={() => console.log('Velas apagadas')}
        onTransitionComplete={handleTransitionComplete}
        onPhotoSelect={handlePhotoSelectIn3D}
        canvasRef={canvasRef}
      />

      {/* UI OVERLAYS */}
      <div className="ui-overlay">
        {/* Floating Play/Pause music button at top-left */}
        <button 
          className="music-toggle-btn interactive-element"
          onClick={toggleMusic}
          onTouchStart={toggleMusic}
          title={isPlaying ? "Pausar música" : "Reproducir música"}
        >
          {isPlaying ? <Volume2 size={20} className="music-pulse-icon" /> : <VolumeX size={20} />}
        </button>
        
        {/* TOP LAYER: Mic volume feedback or close button */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
          {/* Microphone indicator removed for simulated soplido */}
        </div>

        {/* MIDDLE / CENTER LAYER: Screen overlays */}
        {phase === 'welcome' && (
          <div className="welcome-container interactive-element" onClick={handleStartExperience}>
            <div className="glass-card" style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: '0.5rem', color: '#f5c665' }}>
                <Sparkles size={20} />
                <Heart size={20} style={{ fill: '#ff5e84', color: '#ff5e84' }} />
                <Sparkles size={20} />
              </div>
              <h1 className="welcome-title">Felicidades Mi Amor</h1>
              <p className="welcome-subtitle">Toca la pantalla para iniciar</p>
            </div>
          </div>
        )}

        {phase === 'lyrics' && (
          <div className="karaoke-container">
            {LYRICS.map((line, idx) => (
              <div
                key={idx}
                className={`karaoke-line ${idx === lyricsIndex ? 'active' : ''}`}
                style={{
                  opacity: idx === lyricsIndex ? 1 : (idx < lyricsIndex ? 0.3 : 0),
                  transform: idx === lyricsIndex ? 'scale(1.05)' : 'scale(1)',
                  margin: '0.4rem 0'
                }}
              >
                {line}
              </div>
            ))}
          </div>
        )}

        {phase === 'wish' && (
          <div className="wish-overlay">
            <div className="glass-card interactive-element">
              <h2 className="wish-title">✨ Pide un deseo y sopla las velas ✨</h2>
              <button className="btn-premium" onClick={handleActivateMicrophone}>
                Comenzar
              </button>
            </div>
          </div>
        )}

        {phase === 'mic_active' && (
          <div className="blow-instructions">
            <div className="blow-bubble">
              <Sparkles size={16} style={{ color: '#f5c665' }} />
              <span>¡Sopla hacia la pantalla para apagar las velas! 💨</span>
            </div>
            
            <div className="blow-bar-container">
              <div 
                className="blow-bar-fill" 
                style={{ width: `${blowProgress}%` }} 
              />
            </div>
            <div className="blow-progress-text" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', marginTop: '0.3rem', fontWeight: 'bold' }}>
              Soplando... {Math.round(blowProgress)}%
            </div>

            <button 
              className="btn-premium interactive-element" 
              style={{ 
                marginTop: '1rem', 
                fontSize: '0.75rem', 
                padding: '0.5rem 1.2rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: 'none'
              }}
              onClick={triggerExtinguishCandles}
            >
              Apagar velas al instante
            </button>
          </div>
        )}

        {/* Explore Saturn Button before final message */}
        {phase === 'saturn' && !showFinalMessage && !activePhoto && (
          <div 
            style={{ 
              position: 'absolute', 
              bottom: '90px', 
              width: '100%', 
              display: 'flex', 
              justifyContent: 'center', 
              zIndex: '30' 
            }}
          >
            <button 
              className="btn-premium interactive-element" 
              style={{ 
                boxShadow: '0 0 25px rgba(255, 94, 132, 0.5)',
                fontSize: '0.85rem',
                padding: '0.8rem 2.0rem',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              onClick={handleShowFinalCard}
            >
              ✨ Ver Dedicatoria Final ✨
            </button>
          </div>
        )}

        {/* instructions feedback bar at the bottom */}
        {phase === 'saturn' && (
          <div 
            id="instrucciones" 
            style={{ 
              position: 'absolute', 
              bottom: showFinalMessage ? 'auto' : '20px', 
              top: showFinalMessage ? '20px' : 'auto',
              left: '0', 
              width: '100%', 
              textAlign: 'center', 
              fontSize: '16px', 
              padding: '12px', 
              color: 'white',
              background: 'rgba(0, 0, 0, 0.45)', 
              backdropFilter: 'blur(5px)',
              pointerEvents: 'none',
              zIndex: '15'
            }}
          >
            {indicadorMensaje}
          </div>
        )}

        {/* FINAL ROMANTIC MESSAGE CARD */}
        {phase === 'saturn' && showFinalMessage && (
          <div className="final-message-container">
            <div className="glass-card final-card interactive-element">
              <Heart size={32} style={{ color: '#ff5e84', fill: '#ff5e84' }} />
              <h1 className="final-title">
                Gracias por compartir tantos momentos conmigo ❤️
              </h1>
              <p className="final-subtext">
                He creado este pequeño universo para celebrar tu día. Las fotos que orbitan Saturno representan los hermosos momentos que hemos vivido juntos. Gracias
              </p>

              {/* Gift box section with tooltip text */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', margin: '0.8rem 0' }}>
                <span style={{ fontSize: '0.85rem', color: '#f5c665', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                  🎁 Tu regalo te espera 🎁
                </span>
                <button 
                  className="gift-box-btn interactive-element"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGiftModal(true);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setShowGiftModal(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '2.5rem',
                    padding: '0.2rem',
                    outline: 'none'
                  }}
                >
                  🎁
                </button>
              </div>

              <button 
                className="btn-premium" 
                style={{ fontSize: '0.8rem', padding: '0.7rem 1.8rem' }}
                onClick={handleResetExperience}
              >
                Volver a empezar
              </button>
            </div>
          </div>
        )}

        {/* BOTTOM LAYER: Empty spacer */}
        <div style={{ height: '1px' }} />
      </div>

      {/* PHOTO DETAILED ZOOM MODAL */}
      {activePhoto && (
        <div className="photo-detail-modal">
          <div className="photo-detail-content">
            <button className="btn-close" onClick={handleClosePhotoDetail}>
              <X size={20} />
            </button>
            <img 
              src={activePhoto.textureUrl} 
              alt={activePhoto.title} 
              className="photo-detail-image"
            />
            <h3 className="photo-detail-caption">{activePhoto.title}</h3>
          </div>
        </div>
      )}

      {/* GIFT DETAIL MODAL */}
      {showGiftModal && (
        <div className="photo-detail-modal">
          <div className="photo-detail-content" style={{ maxWidth: '420px', gap: '1rem' }}>
            <h2 className="welcome-title" style={{ fontSize: '1.5rem', margin: '0.5rem 0 0 0', color: '#f5c665' }}>
              🎁 ¡Sorpresa! 🎁
            </h2>
            <img 
              src="/regalo.png" 
              alt="Tu regalo" 
              className="photo-detail-image"
              style={{ width: '100%', borderRadius: '12px', border: '3px solid #f5c665', aspectRatio: 'auto' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%', marginTop: '0.5rem' }}>
              <button 
                className="btn-premium interactive-element" 
                style={{ fontSize: '0.85rem', padding: '0.7rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGiftModal(false);
                }}
              >
                Cerrar regalo
              </button>
              <button 
                className="btn-premium interactive-element" 
                style={{ 
                  fontSize: '0.8rem', 
                  padding: '0.6rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: 'none'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGiftModal(false);
                  handleResetExperience();
                }}
              >
                Volver a empezar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
