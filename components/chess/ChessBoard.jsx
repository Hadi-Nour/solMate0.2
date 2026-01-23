'use client';

import { Chess } from 'chess.js';

const PIECE_UNICODE = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

export default function ChessBoard({ chess, gameState, selectedSquare, validMoves, onSquareClick, isThinking }) {
  if (!chess) return null;
  
  const board = chess.board();
  const isFlipped = gameState?.playerColor === 'b';
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  
  if (isFlipped) {
    files.reverse();
    ranks.reverse();
  }
  
  return (
    <div className="aspect-square w-full max-w-[400px] mx-auto">
      <div className="grid grid-cols-8 h-full w-full rounded-lg overflow-hidden shadow-2xl border-2 border-primary/30">
        {ranks.map((rank, ri) => 
          files.map((file, fi) => {
            const square = `${file}${rank}`;
            const actualRow = isFlipped ? 7 - ri : ri;
            const actualCol = isFlipped ? 7 - fi : fi;
            const piece = board[actualRow][actualCol];
            const isLight = (actualRow + actualCol) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isValidMove = validMoves.includes(square);
            const hasPiece = piece !== null;
            
            return (
              <button
                key={square}
                onClick={() => onSquareClick(square)}
                className={`
                  aspect-square flex items-center justify-center text-3xl sm:text-4xl
                  transition-all duration-150
                  ${isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'}
                  ${isSelected ? 'ring-4 ring-primary ring-inset bg-primary/40' : ''}
                  ${isValidMove && !hasPiece ? 'relative' : ''}
                  ${isValidMove && hasPiece ? 'ring-4 ring-primary/60 ring-inset' : ''}
                  hover:brightness-110
                `}
                disabled={isThinking || gameState?.status === 'finished'}
              >
                {isValidMove && !hasPiece && (
                  <div className="absolute w-1/3 h-1/3 rounded-full bg-primary/50" />
                )}
                {piece && (
                  <span className={`${piece.color === 'w' ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900'}`}>
                    {PIECE_UNICODE[piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
