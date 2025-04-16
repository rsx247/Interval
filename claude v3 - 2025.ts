import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// You will need to replace these with your actual Supabase credentials
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

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

const saveHighScore = async (score, playerName) => {
  try {
    // Save locally
    localStorage.setItem('highScore', score.toString());
    
    // Save to Supabase if a player name is provided
    if (playerName) {
      const { data, error } = await supabase
        .from('leaderboard')
        .upsert([
          { player_name: playerName, score: score, timestamp: new Date() }
        ]);
      
      if (error) {
        console.error('Failed to save score to leaderboard:', error);
      }
    }
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
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);

  const containerRef = useRef(null);
  const requestRef = useRef(null);

  // Initialize sound manager
  useEffect(() => {
    SoundManager.init();
  }, []);

  // Load leaderboard on mount
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Update progress bar animation
  useEffect(() => {
    if (gameState.isPlaying && !gameState.firstClickAfterStart && !gameState.gameOver) {
      const updateProgress = () => {
        const elapsed = performance.now() - gameState.lastClickTime;
        const progressPercentage = Math.min(100, (elapsed / gameState.targetInterval) * 100);
        setProgressWidth(progressPercentage);
        
        requestRef.current = requestAnimationFrame(updateProgress);
      };
      
      requestRef.current = requestAnimationFrame(updateProgress);
      
      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
      };
    }
  }, [gameState.isPlaying, gameState.firstClickAfterStart, gameState.lastClickTime, gameState.targetInterval, gameState.gameOver]);
  
  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Error fetching leaderboard:', error);
      } else {
        setLeaderboard(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
    }
  };
  
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
    // More forgiving ranges
    if (deviation <= 5) return { text: "PERFECT!", color: "bg-gradient-to-r from-purple-500 to-pink-500", points: 1000 };
    if (deviation <= 10) return { text: "AMAZING!", color: "bg-gradient-to-r from-blue-500 to-teal-500", points: 500 };
    if (deviation <= 20) return { text: "GOOD!", color: "bg-gradient-to-r from-green-500 to-emerald-500", points: 100 };
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

  // Modified to handle mouse/touch down instead of click
  const handleInteraction = useCallback((event) => {
    event.preventDefault(); // Prevent default behavior
    if (gameState.gameOver) return;

    // Get coordinates from either mouse or touch event
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = x - rect.left;
    const relativeY = y - rect.top;
    
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
      createParticles(relativeX, relativeY);
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
      createParticles(relativeX, relativeY);
      return;
    }
    
    // Check if click is too early (less than 50% of target interval)
    const isTooEarly = interval < gameState.targetInterval * 0.5;
    
    // Check if click is too late
    if (interval > gameState.targetInterval && !isTooEarly) {
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
    const points = addFeedback(interval, deviation, relativeX, relativeY);
    
    if (points > 0) {
      SoundManager.play('perfect');
      createParticles(relativeX, relativeY);
    } else {
      SoundManager.play('click');
    }
    
    // Update game state with new target interval
    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      score: prev.score + points + prev.round,
      combo: points > 0 ? prev.combo + 1 : 0,
      lastClickTime: currentTime,
      targetInterval: interval // Set new target interval for next click
    }));
  }, [gameState]);

  // Add event listeners for both mouse and touch events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleInteraction);
    container.addEventListener('touchstart', handleInteraction);

    return () => {
      container.removeEventListener('mousedown', handleInteraction);
      container.removeEventListener('touchstart', handleInteraction);
    };
  }, [handleInteraction]);

  const submitScore = async () => {
    if (playerName.trim() && gameState.score > 0) {
      await saveHighScore(gameState.score, playerName.trim());
      await fetchLeaderboard();
      setShowLeaderboard(true);
    }
  };

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
    setShowLeaderboard(false);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-gradient-to-b from-indigo-900 to-purple-900 overflow-hidden cursor-pointer"
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
          
          {!showLeaderboard ? (
            <motion.div
              className="bg-indigo-900/80 p-6 rounded-xl w-full max-w-md"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className="text-3xl text-white mb-4 text-center">Final Score: {gameState.score}</div>
              <input 
                type="text" 
                placeholder="Enter your name" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full p-3 bg-indigo-800 text-white rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex space-x-4">
                <motion.button
                  className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 text-white text-xl font-bold py-3 px-6 rounded-lg shadow-lg transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    submitScore();
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Submit Score
                </motion.button>
                <motion.button
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl font-bold py-3 px-6 rounded-lg shadow-lg transition-all"
                  onClick={restartGame}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Play Again
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="bg-indigo-900/80 p-6 rounded-xl w-full max-w-md max-h-96 overflow-y-auto"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className="text-3xl text-white mb-4 text-center">Leaderboard</div>
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <div 
                    key={index} 
                    className={`flex justify-between p-3 rounded-lg ${
                      entry.player_name === playerName && entry.score === gameState.score 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                        : 'bg-indigo-800'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="font-bold mr-3">{index + 1}.</span>
                      <span>{entry.player_name}</span>
                    </div>
                    <div className="font-bold">{entry.score}</div>
                  </div>
                ))}
              </div>
              <motion.button
                className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl font-bold py-3 px-6 rounded-lg shadow-lg transition-all"
                onClick={restartGame}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Play Again
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/20">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
};

export default TimingGame;
