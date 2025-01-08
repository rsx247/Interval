import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Simple sound manager using Web Audio API
const SoundManager = {
  audioContext: null,
  sounds: {},

  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create basic sounds using oscillators
      this.sounds.click = () => {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.1);
      };

      this.sounds.perfect = () => {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
      };

      this.sounds.gameover = () => {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.frequency.setValueAtTime(400, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.5);
      };
    } catch (e) {
      console.warn('Web Audio API not supported');
      this.sounds = {
        click: () => {},
        perfect: () => {},
        gameover: () => {}
      };
    }
  },

  play(sound) {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
    this.sounds[sound]?.();
  }
};

// Persistent high score management
const getHighScore = () => {
  try {
    return parseInt(localStorage.getItem('highScore')) || 0;
  } catch {
    return 0;
  }
};

const saveHighScore = (score) => {
  try {
    localStorage.setItem('highScore', score.toString());
  } catch (e) {
    console.error('Failed to save high score:', e);
  }
};

// Main game component
const TimingGame = () => {
  const [gameState, setGameState] = useState({
    isPlaying: false,
    round: 0,
    score: 0,
    lastClickTime: 0,
    targetInterval: 0,
    gameOver: false,
    firstClickAfterStart: true,
    highScore: getHighScore(),
    combo: 0
  });
  
  const [feedbacks, setFeedbacks] = useState([]);
  const [particles, setParticles] = useState([]);
  const containerRef = useRef(null);

  // Initialize sound manager
  useEffect(() => {
    SoundManager.init();
  }, []);
  
  // Particle effect on successful clicks
  const createParticles = (x, y) => {
    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x,
      y,
      angle: (i * Math.PI * 2) / 8,
      speed: Math.random() * 2 + 2
    }));
    setParticles(prev => [...prev, ...newParticles]);
    
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.includes(p)));
    }, 1000);
  };

  const getFeedbackType = (deviation) => {
    if (deviation <= 0.01) return { text: "PERFECT!", color: "bg-gradient-to-r from-purple-500 to-pink-500", points: 1000 };
    if (deviation <= 0.1) return { text: "AMAZING!", color: "bg-gradient-to-r from-blue-500 to-teal-500", points: 500 };
    if (deviation <= 1) return { text: "GOOD!", color: "bg-gradient-to-r from-green-500 to-emerald-500", points: 100 };
    return { text: "TOO EARLY!", color: "bg-gradient-to-r from-red-500 to-orange-500", points: 0 };
  };

  const addFeedback = (interval, deviation, x, y) => {
    const feedback = getFeedbackType(deviation);
    const id = Date.now();
    
    setFeedbacks(prev => [...prev, {
      id,
      text: feedback.text,
      color: feedback.color,
      points: feedback.points,
      x,
      y
    }]);
    
    setTimeout(() => {
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    }, 1000);
    
    return feedback.points;
  };

  const handleClick = useCallback((event) => {
    if (gameState.gameOver) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const currentTime = performance.now();
    const interval = gameState.lastClickTime ? currentTime - gameState.lastClickTime : 0;
    
    if (!gameState.isPlaying) {
      SoundManager.play('click');
      setGameState(prev => ({
        ...prev,
        isPlaying: true,
        round: 1,
        score: 0,
        lastClickTime: currentTime,
        targetInterval: interval,
        firstClickAfterStart: true
      }));
      createParticles(x, y);
      return;
    }
    
    if (gameState.firstClickAfterStart) {
      SoundManager.play('click');
      setGameState(prev => ({
        ...prev,
        lastClickTime: currentTime,
        targetInterval: interval,
        firstClickAfterStart: false,
        round: prev.round + 1
      }));
      createParticles(x, y);
      return;
    }
    
    if (interval > gameState.targetInterval) {
      SoundManager.play('gameover');
      const finalScore = gameState.score;
      if (finalScore > gameState.highScore) {
        saveHighScore(finalScore);
      }
      setGameState(prev => ({ 
        ...prev, 
        gameOver: true,
        highScore: Math.max(prev.highScore, finalScore)
      }));
      return;
    }
    
    const deviation = Math.abs((interval - gameState.targetInterval) / gameState.targetInterval * 100);
    const points = addFeedback(interval, deviation, x, y);
    
    if (points > 0) {
      SoundManager.play('perfect');
      createParticles(x, y);
    } else {
      SoundManager.play('click');
    }
    
    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      score: prev.score + points + prev.round,
      combo: points > 0 ? prev.combo + 1 : 0,
      lastClickTime: currentTime,
      targetInterval: interval
    }));
  }, [gameState]);

  const restartGame = (e) => {
    e.stopPropagation();
    setGameState({
      isPlaying: false,
      round: 0,
      score: 0,
      lastClickTime: 0,
      targetInterval: 0,
      gameOver: false,
      firstClickAfterStart: true,
      highScore: getHighScore(),
      combo: 0
    });
    setFeedbacks([]);
    setParticles([]);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-gradient-to-b from-indigo-900 to-purple-900 overflow-hidden cursor-pointer"
      onClick={handleClick}
    >
      {/* Particles */}
      {particles.map(particle => (
        <motion.div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full bg-white"
          initial={{ x: particle.x, y: particle.y, opacity: 1 }}
          animate={{
            x: particle.x + Math.cos(particle.angle) * 100 * particle.speed,
            y: particle.y + Math.sin(particle.angle) * 100 * particle.speed,
            opacity: 0,
            scale: 0
          }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      ))}

      {/* Score Display */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
        <motion.div 
          className="text-6xl font-bold text-white mb-2"
          animate={{ scale: gameState.score > 0 ? [1, 1.1, 1] : 1 }}
        >
          {gameState.score}
        </motion.div>
        <div className="text-2xl text-purple-200">High Score: {gameState.highScore}</div>
        {gameState.combo > 1 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-xl text-yellow-300 mt-2"
          >
            {gameState.combo}x Combo!
          </motion.div>
        )}
      </div>

      {/* Feedback Animations */}
      <AnimatePresence>
        {feedbacks.map(feedback => (
          <motion.div
            key={feedback.id}
            className={`absolute text-white font-bold text-2xl ${feedback.color} px-4 py-2 rounded-lg`}
            style={{ left: feedback.x, top: feedback.y }}
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -50 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.5 }}
          >
            {feedback.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Game Instructions */}
      {!gameState.isPlaying && !gameState.gameOver && (
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl text-white font-bold text-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          TAP TO START!
        </motion.div>
      )}

      {/* Game Over Screen */}
      {gameState.gameOver && (
        <motion.div
          className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="text-6xl font-bold text-white mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            GAME OVER!
          </motion.div>
          
          <motion.button
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-2xl font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
            onClick={restartGame}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            PLAY AGAIN
          </motion.button>
        </motion.div>
      )}

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/20">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
          style={{
            width: gameState.targetInterval 
              ? `${(gameState.lastClickTime % gameState.targetInterval) / gameState.targetInterval * 100}%`
              : '0%'
          }}
        />
      </div>
    </div>
  );
};

export default TimingGame;
