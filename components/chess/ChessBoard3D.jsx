'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 3D Piece SVG definitions for different skins
const PIECE_SVGS = {
  'classic': {
    K: `<svg viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5" stroke-linecap="butt"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#fff" stroke-linecap="butt"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="#fff"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`,
    Q: `<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z" stroke-linecap="butt"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/><path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none"/></g></svg>`,
    R: `<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5" stroke-linecap="butt"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23" fill="none" stroke-linejoin="miter"/></g></svg>`,
    B: `<svg viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#fff" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke-linejoin="miter"/></g></svg>`,
    N: `<svg viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#fff"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="#000"/></g></svg>`,
    P: `<svg viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    k: `<svg viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#000" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="#000"/><path d="M20 8h5" stroke-linejoin="miter"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" stroke="#fff"/></g></svg>`,
    q: `<svg viewBox="0 0 45 45"><g fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#000" stroke="none"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/></g><path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z" fill="#000" stroke-linecap="butt"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" fill="#000" stroke-linecap="butt"/><path d="M11 38.5a35 35 1 0 0 23 0" fill="none" stroke-linecap="butt"/><path d="M11 29a35 35 1 0 1 23 0m-21.5 2.5h20m-21 3a35 35 1 0 0 22 0m-23 3a35 35 1 0 0 24 0" fill="none" stroke="#fff"/></g></svg>`,
    r: `<svg viewBox="0 0 45 45"><g fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zm3.5-7l1.5-2.5h17l1.5 2.5h-20zm-.5 4v-4h21v4H12z" stroke-linecap="butt"/><path d="M14 29.5v-13h17v13H14z" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" stroke-linecap="butt"/><path d="M12 35.5h21m-20-4h19m-18-2h17m-17-13h17M11 14h23" fill="none" stroke="#fff" stroke-width="1" stroke-linejoin="miter"/></g></svg>`,
    b: `<svg viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#000" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke="#fff" stroke-linejoin="miter"/></g></svg>`,
    n: `<svg viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#000"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#000"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="#fff" stroke="#fff"/></g></svg>`,
    p: `<svg viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round"/></svg>`
  }
};

// Board theme colors
const BOARD_THEMES = {
  'classic': {
    light: 'linear-gradient(145deg, #f5deb3 0%, #deb887 100%)',
    dark: 'linear-gradient(145deg, #8b7355 0%, #6b5344 100%)',
    border: '#4a3728',
    shadow: 'rgba(74, 55, 40, 0.4)'
  },
  'dark-marble': {
    light: 'linear-gradient(145deg, #b8b8b8 0%, #909090 100%)',
    dark: 'linear-gradient(145deg, #404040 0%, #2a2a2a 100%)',
    border: '#1a1a1a',
    shadow: 'rgba(0, 0, 0, 0.5)'
  },
  'neon': {
    light: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
    dark: 'linear-gradient(145deg, #0f0f1a 0%, #0a0a14 100%)',
    border: '#14F195',
    shadow: 'rgba(20, 241, 149, 0.3)'
  },
  'solana': {
    light: 'linear-gradient(145deg, #1e3a5f 0%, #152a45 100%)',
    dark: 'linear-gradient(145deg, #0d1b2a 0%, #0a1420 100%)',
    border: '#9945FF',
    shadow: 'rgba(153, 69, 255, 0.3)'
  }
};

export default function ChessBoard3D({ 
  chess, 
  gameState, 
  selectedSquare, 
  validMoves, 
  onSquareClick, 
  isThinking,
  lastMove,
  boardTheme = 'classic',
  pieceTheme = 'classic',
  showLegalMoves = true
}) {
  const [animatingPiece, setAnimatingPiece] = useState(null);
  const boardRef = useRef(null);
  
  if (!chess) return null;
  
  const board = chess.board();
  const isFlipped = gameState?.playerColor === 'b';
  const files = isFlipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
  const ranks = isFlipped ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
  const theme = BOARD_THEMES[boardTheme] || BOARD_THEMES.classic;
  
  const isInCheck = chess.isCheck();
  const kingSquare = isInCheck ? findKingSquare(chess, chess.turn()) : null;
  
  function findKingSquare(chess, color) {
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === color) {
          const files = ['a','b','c','d','e','f','g','h'];
          const ranks = ['8','7','6','5','4','3','2','1'];
          return files[c] + ranks[r];
        }
      }
    }
    return null;
  }

  const renderPiece = (piece, square) => {
    if (!piece) return null;
    const pieceKey = piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
    const svg = PIECE_SVGS[pieceTheme]?.[pieceKey] || PIECE_SVGS.classic[pieceKey];
    
    return (
      <motion.div
        key={`${square}-${pieceKey}`}
        className="absolute inset-0 flex items-center justify-center p-1"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          filter: piece.color === 'w' 
            ? 'drop-shadow(2px 4px 3px rgba(0,0,0,0.4))' 
            : 'drop-shadow(2px 4px 3px rgba(0,0,0,0.5))',
        }}
      >
        <div 
          className="w-[85%] h-[85%]"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </motion.div>
    );
  };

  return (
    <div className="relative w-full max-w-[400px] mx-auto">
      {/* Board Container with 3D effect */}
      <div 
        ref={boardRef}
        className="relative rounded-xl overflow-hidden"
        style={{
          boxShadow: `
            0 20px 40px ${theme.shadow},
            0 10px 20px rgba(0,0,0,0.3),
            inset 0 1px 0 rgba(255,255,255,0.1)
          `,
          border: `3px solid ${theme.border}`,
          background: theme.dark
        }}
      >
        {/* Board edge bevel */}
        <div className="absolute inset-0 pointer-events-none rounded-lg" style={{
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.2)'
        }} />
        
        {/* Chess Grid */}
        <div className="grid grid-cols-8 aspect-square">
          {ranks.map((rank, ri) => 
            files.map((file, fi) => {
              const sq = `${file}${rank}`;
              const row = isFlipped ? 7 - ri : ri;
              const col = isFlipped ? 7 - fi : fi;
              const piece = board[row][col];
              const isLight = (row + col) % 2 === 0;
              const isSelected = selectedSquare === sq;
              const isValidMove = validMoves.includes(sq);
              const isLastMoveFrom = lastMove?.from === sq;
              const isLastMoveTo = lastMove?.to === sq;
              const isKingInCheck = kingSquare === sq;
              const hasPiece = piece !== null;
              
              return (
                <motion.button
                  key={sq}
                  onClick={() => onSquareClick(sq)}
                  disabled={isThinking || gameState?.status === 'finished'}
                  className="relative aspect-square transition-all duration-150"
                  style={{
                    background: isLight ? theme.light : theme.dark,
                    boxShadow: isLight 
                      ? 'inset 1px 1px 2px rgba(255,255,255,0.3), inset -1px -1px 2px rgba(0,0,0,0.1)'
                      : 'inset 1px 1px 2px rgba(255,255,255,0.1), inset -1px -1px 2px rgba(0,0,0,0.2)'
                  }}
                  whileHover={{ brightness: 1.1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Last move highlight */}
                  {(isLastMoveFrom || isLastMoveTo) && (
                    <div className="absolute inset-0 bg-yellow-400/30 pointer-events-none" />
                  )}
                  
                  {/* Selected square highlight */}
                  {isSelected && (
                    <motion.div 
                      className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        background: 'rgba(20, 241, 149, 0.4)',
                        boxShadow: 'inset 0 0 10px rgba(20, 241, 149, 0.6)'
                      }}
                    />
                  )}
                  
                  {/* King in check indicator */}
                  {isKingInCheck && (
                    <motion.div 
                      className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      style={{
                        background: 'radial-gradient(circle, rgba(255,0,0,0.6) 0%, rgba(255,0,0,0) 70%)'
                      }}
                    />
                  )}
                  
                  {/* Valid move indicator */}
                  {isValidMove && showLegalMoves && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {hasPiece ? (
                        <div className="w-full h-full border-4 border-primary/60 rounded-sm" />
                      ) : (
                        <motion.div 
                          className="w-1/3 h-1/3 rounded-full bg-primary/50"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500 }}
                        />
                      )}
                    </div>
                  )}
                  
                  {/* Piece */}
                  <AnimatePresence mode="wait">
                    {piece && renderPiece(piece, sq)}
                  </AnimatePresence>
                  
                  {/* Coordinate labels */}
                  {fi === 0 && (
                    <span className="absolute top-0.5 left-1 text-[10px] font-bold opacity-60" 
                      style={{ color: isLight ? '#6b5344' : '#d4c4b0' }}>
                      {rank}
                    </span>
                  )}
                  {ri === 7 && (
                    <span className="absolute bottom-0.5 right-1 text-[10px] font-bold opacity-60"
                      style={{ color: isLight ? '#6b5344' : '#d4c4b0' }}>
                      {file}
                    </span>
                  )}
                </motion.button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
