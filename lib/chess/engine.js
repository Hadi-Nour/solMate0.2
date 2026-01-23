import { Chess } from 'chess.js';

// Piece values for evaluation
const PIECE_VALUES = {
  p: 100,   // pawn
  n: 320,   // knight
  b: 330,   // bishop
  r: 500,   // rook
  q: 900,   // queen
  k: 20000  // king
};

// Position bonus tables (simplified)
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
  0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MIDDLE_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20
];

function getPieceTable(piece) {
  switch (piece) {
    case 'p': return PAWN_TABLE;
    case 'n': return KNIGHT_TABLE;
    case 'b': return BISHOP_TABLE;
    case 'r': return ROOK_TABLE;
    case 'q': return QUEEN_TABLE;
    case 'k': return KING_MIDDLE_TABLE;
    default: return null;
  }
}

function evaluateBoard(chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -Infinity : Infinity;
  }
  if (chess.isDraw()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const pieceValue = PIECE_VALUES[piece.type];
        const table = getPieceTable(piece.type);
        let positionBonus = 0;
        
        if (table) {
          const index = piece.color === 'w' ? row * 8 + col : (7 - row) * 8 + col;
          positionBonus = table[index];
        }
        
        const totalValue = pieceValue + positionBonus;
        score += piece.color === 'w' ? totalValue : -totalValue;
      }
    }
  }

  return score;
}

function minimax(chess, depth, alpha, beta, maximizing) {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = chess.moves();
  
  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const evalScore = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const evalScore = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function orderMoves(chess, moves) {
  // Simple move ordering: captures first, then checks
  return moves.sort((a, b) => {
    const moveA = chess.move(a);
    chess.undo();
    const moveB = chess.move(b);
    chess.undo();
    
    let scoreA = 0, scoreB = 0;
    if (moveA.captured) scoreA += PIECE_VALUES[moveA.captured];
    if (moveB.captured) scoreB += PIECE_VALUES[moveB.captured];
    
    return scoreB - scoreA;
  });
}

export function getBotMove(fen, difficulty) {
  const chess = new Chess(fen);
  const moves = chess.moves();
  
  if (moves.length === 0) return null;

  // Difficulty settings
  const depthMap = {
    easy: 1,
    normal: 2,
    hard: 3,
    pro: 4
  };
  
  const depth = depthMap[difficulty] || 2;
  const isMaximizing = chess.turn() === 'w';
  
  // Add randomness for lower difficulties
  const randomFactor = {
    easy: 0.4,    // 40% chance of random move
    normal: 0.15,  // 15% chance of random move
    hard: 0.05,   // 5% chance of random move
    pro: 0        // Always best move
  }[difficulty] || 0.15;

  if (Math.random() < randomFactor) {
    // Pick a random move (but not a blunder if possible)
    const safeMoves = moves.filter(move => {
      chess.move(move);
      const isBad = chess.isCheck(); // Avoid moves that allow opponent check
      chess.undo();
      return !isBad;
    });
    const pool = safeMoves.length > 0 ? safeMoves : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Find best move using minimax
  let bestMove = moves[0];
  let bestEval = isMaximizing ? -Infinity : Infinity;
  
  const orderedMoves = orderMoves(chess, [...moves]);
  
  for (const move of orderedMoves) {
    chess.move(move);
    const evalScore = minimax(chess, depth - 1, -Infinity, Infinity, !isMaximizing);
    chess.undo();
    
    if (isMaximizing) {
      if (evalScore > bestEval) {
        bestEval = evalScore;
        bestMove = move;
      }
    } else {
      if (evalScore < bestEval) {
        bestEval = evalScore;
        bestMove = move;
      }
    }
  }
  
  return bestMove;
}

export function validateMove(fen, from, to, promotion) {
  const chess = new Chess(fen);
  try {
    const move = chess.move({ from, to, promotion });
    return {
      valid: true,
      move,
      newFen: chess.fen(),
      isGameOver: chess.isGameOver(),
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw(),
      isCheck: chess.isCheck(),
      turn: chess.turn()
    };
  } catch (e) {
    return { valid: false, error: 'Invalid move' };
  }
}

export function getGameStatus(fen) {
  const chess = new Chess(fen);
  return {
    isGameOver: chess.isGameOver(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
    isStalemate: chess.isStalemate(),
    isThreefoldRepetition: chess.isThreefoldRepetition(),
    isInsufficientMaterial: chess.isInsufficientMaterial(),
    isCheck: chess.isCheck(),
    turn: chess.turn(),
    moveNumber: chess.moveNumber()
  };
}
