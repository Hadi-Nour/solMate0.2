import { Server } from 'socket.io';
import { Chess } from 'chess.js';
import { v4 as uuidv4 } from 'uuid';
import { MongoClient } from 'mongodb';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
);

// MongoDB connection
let db = null;
async function getDb() {
  if (!db) {
    const client = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017');
    await client.connect();
    db = client.db(process.env.DB_NAME || 'solmate');
  }
  return db;
}

// Matchmaking queues: { timeControl: { free: [], vip: [] } }
const matchQueues = {
  3: { free: [], vip: [] },
  5: { free: [], vip: [] },
  10: { free: [], vip: [] },
  0: { free: [], vip: [] } // 0 = unlimited/no timer
};

// Active matches: { matchId: MatchState }
const activeMatches = new Map();

// Player to match mapping
const playerMatches = new Map();

// Disconnection timers
const disconnectTimers = new Map();

// Quick chat cooldowns (wallet -> timestamp)
const quickChatCooldowns = new Map();

const RECONNECT_GRACE_PERIOD = 20000; // 20 seconds
const MOVE_RATE_LIMIT = 500; // 500ms between moves
const QUICKCHAT_COOLDOWN = 3000; // 3 seconds between quick chats

// Valid quick chat presets
const VALID_PRESETS = ['goodLuck', 'niceMove', 'wow', 'oops', 'gg', 'thanks', 'rematch', 'wellPlayed'];
const VALID_EMOTES = ['smile', 'think', 'fire', 'clap', 'trophy', 'chess'];

// Track last move time for rate limiting
const lastMoveTime = new Map();

class MatchState {
  constructor(matchId, player1, player2, timeControl, isVipArena) {
    this.id = matchId;
    this.chess = new Chess();
    this.timeControl = timeControl; // minutes (0 = unlimited)
    this.isVipArena = isVipArena;
    this.isUnlimited = timeControl === 0;
    
    // Randomly assign colors
    const isPlayer1White = Math.random() > 0.5;
    this.players = {
      white: isPlayer1White ? player1 : player2,
      black: isPlayer1White ? player2 : player1
    };
    
    // Time in milliseconds (0 = unlimited means no time tracking)
    this.timeLeft = {
      white: this.isUnlimited ? Infinity : timeControl * 60 * 1000,
      black: this.isUnlimited ? Infinity : timeControl * 60 * 1000
    };
    
    this.status = 'waiting'; // waiting, active, finished
    this.result = null; // white_wins, black_wins, draw
    this.winner = null;
    this.moves = [];
    this.lastMoveTime = null;
    this.startedAt = null;
    this.finishedAt = null;
    this.timerInterval = null;
    this.gameStarted = false; // Timer only starts on first move
  }

  getPlayerColor(wallet) {
    if (this.players.white.wallet === wallet) return 'white';
    if (this.players.black.wallet === wallet) return 'black';
    return null;
  }

  getOpponent(wallet) {
    if (this.players.white.wallet === wallet) return this.players.black;
    return this.players.white;
  }

  getCurrentTurnColor() {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  isPlayerTurn(wallet) {
    const color = this.getPlayerColor(wallet);
    return color === this.getCurrentTurnColor();
  }

  startGame() {
    this.status = 'active';
    this.startedAt = Date.now();
    // Don't start the clock until first move
    this.lastMoveTime = null;
    this.gameStarted = false;
  }

  makeMove(from, to, promotion) {
    try {
      const move = this.chess.move({ from, to, promotion });
      if (!move) return { valid: false, error: 'Invalid move' };
      
      const now = Date.now();
      
      // Start timer on first move
      if (!this.gameStarted) {
        this.gameStarted = true;
        this.lastMoveTime = now;
      }
      
      // Only deduct time if not unlimited
      if (!this.isUnlimited && this.lastMoveTime) {
        const elapsed = now - this.lastMoveTime;
        
        // Deduct time from the player who just moved
        const movedColor = move.color === 'w' ? 'white' : 'black';
        this.timeLeft[movedColor] -= elapsed;
        
        if (this.timeLeft[movedColor] <= 0) {
          this.timeLeft[movedColor] = 0;
          return { valid: true, move, timeout: movedColor };
        }
      }
      
      this.lastMoveTime = now;
      this.moves.push({
        san: move.san,
        from: move.from,
        to: move.to,
        color: move.color,
        timestamp: now
      });
      
      return {
        valid: true,
        move,
        fen: this.chess.fen(),
        isGameOver: this.chess.isGameOver(),
        isCheckmate: this.chess.isCheckmate(),
        isDraw: this.chess.isDraw(),
        isCheck: this.chess.isCheck()
      };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  endGame(result, winner) {
    this.status = 'finished';
    this.result = result;
    this.winner = winner;
    this.finishedAt = Date.now();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  toJSON() {
    return {
      id: this.id,
      fen: this.chess.fen(),
      timeControl: this.timeControl,
      isVipArena: this.isVipArena,
      isUnlimited: this.isUnlimited,
      players: {
        white: { wallet: this.players.white.wallet, socketId: this.players.white.socketId },
        black: { wallet: this.players.black.wallet, socketId: this.players.black.socketId }
      },
      timeLeft: {
        white: this.isUnlimited ? null : this.timeLeft.white,
        black: this.isUnlimited ? null : this.timeLeft.black
      },
      status: this.status,
      result: this.result,
      winner: this.winner,
      moves: this.moves,
      currentTurn: this.getCurrentTurnColor(),
      gameStarted: this.gameStarted
    };
  }
}

// Verify JWT token
async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

// Get user from database
async function getUser(wallet) {
  const database = await getDb();
  return await database.collection('users').findOne({ wallet });
}

// Update user stats after match
async function updateUserStats(wallet, isWin, isVipArena) {
  const database = await getDb();
  const user = await database.collection('users').findOne({ wallet });
  if (!user) return null;

  const updates = {
    $inc: {
      'stats.wins': isWin ? 1 : 0,
      'stats.losses': isWin ? 0 : 1,
    },
    $set: {}
  };

  let rewards = null;

  if (isVipArena) {
    if (isWin) {
      const newStreak = (user.stats?.vipCurrentStreak || 0) + 1;
      updates.$inc['stats.vipWins'] = 1;
      updates.$inc['chests.bronze'] = 1;
      updates.$set['stats.vipCurrentStreak'] = newStreak;
      updates.$set['stats.vipBestStreak'] = Math.max(newStreak, user.stats?.vipBestStreak || 0);
      
      rewards = { bronzeChest: 1, silverChest: 0, goldPoints: 0, newStreak };
      
      // Check for 5-win streak bonus
      if (newStreak >= 5 && newStreak % 5 === 0) {
        updates.$inc['chests.silver'] = 1;
        updates.$inc['goldPoints'] = 1;
        rewards.silverChest = 1;
        rewards.goldPoints = 1;
      }
    } else {
      updates.$inc['stats.vipLosses'] = 1;
      updates.$set['stats.vipCurrentStreak'] = 0;
      rewards = { bronzeChest: 0, silverChest: 0, goldPoints: 0, newStreak: 0, streakReset: true };
    }
  }

  await database.collection('users').updateOne({ wallet }, updates);
  return rewards;
}

// Save match to database
async function saveMatch(match) {
  const database = await getDb();
  await database.collection('online_matches').insertOne({
    id: match.id,
    type: 'online',
    isVipArena: match.isVipArena,
    timeControl: match.timeControl,
    players: {
      white: match.players.white.wallet,
      black: match.players.black.wallet
    },
    fen: match.chess.fen(),
    moves: match.moves,
    status: match.status,
    result: match.result,
    winner: match.winner,
    startedAt: match.startedAt ? new Date(match.startedAt) : null,
    finishedAt: match.finishedAt ? new Date(match.finishedAt) : null
  });
}

export function initializeSocket(server) {
  const io = new Server(server, {
    path: '/api/socket',
    cors: {
      origin: process.env.CORS_ORIGINS || '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const payload = await verifyToken(token);
    if (!payload || !payload.wallet) {
      return next(new Error('Invalid token'));
    }
    
    const user = await getUser(payload.wallet);
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.user = {
      wallet: payload.wallet,
      isVip: user.isVip || false,
      friendCode: user.friendCode
    };
    
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.user.wallet}`);

    // Check if player was in a match (reconnection)
    const existingMatchId = playerMatches.get(socket.user.wallet);
    if (existingMatchId) {
      const match = activeMatches.get(existingMatchId);
      if (match && match.status !== 'finished') {
        // Clear disconnect timer
        const timer = disconnectTimers.get(socket.user.wallet);
        if (timer) {
          clearTimeout(timer);
          disconnectTimers.delete(socket.user.wallet);
        }
        
        // Update socket ID and rejoin room
        const color = match.getPlayerColor(socket.user.wallet);
        if (color) {
          match.players[color].socketId = socket.id;
          socket.join(existingMatchId);
          
          // Send current game state
          socket.emit('match:reconnected', {
            match: match.toJSON(),
            yourColor: color
          });
          
          // Notify opponent
          socket.to(existingMatchId).emit('opponent:reconnected');
        }
      }
    }

    // Join matchmaking queue
    socket.on('queue:join', ({ timeControl, isVipArena }) => {
      // Validate (0 = unlimited, 3 = bullet, 5 = blitz, 10 = rapid)
      if (![0, 3, 5, 10].includes(timeControl)) {
        return socket.emit('error', { message: 'Invalid time control' });
      }
      
      if (isVipArena && !socket.user.isVip) {
        return socket.emit('error', { message: 'VIP membership required' });
      }
      
      // Check if already in queue or match
      if (playerMatches.has(socket.user.wallet)) {
        return socket.emit('error', { message: 'Already in a match' });
      }
      
      // Remove from any existing queue
      removeFromAllQueues(socket.user.wallet);
      
      const queueType = isVipArena ? 'vip' : 'free';
      const queue = matchQueues[timeControl][queueType];
      
      // Check for a match
      if (queue.length > 0) {
        const opponent = queue.shift();
        
        // Create match
        const matchId = uuidv4();
        const match = new MatchState(
          matchId,
          { wallet: socket.user.wallet, socketId: socket.id },
          { wallet: opponent.wallet, socketId: opponent.socketId },
          timeControl,
          isVipArena
        );
        
        activeMatches.set(matchId, match);
        playerMatches.set(socket.user.wallet, matchId);
        playerMatches.set(opponent.wallet, matchId);
        
        // Join both players to room
        socket.join(matchId);
        const opponentSocket = io.sockets.sockets.get(opponent.socketId);
        if (opponentSocket) {
          opponentSocket.join(matchId);
        }
        
        // Start the game
        match.startGame();
        
        // Notify both players
        const whitePlayer = match.players.white;
        const blackPlayer = match.players.black;
        
        io.to(whitePlayer.socketId).emit('match:found', {
          matchId,
          yourColor: 'white',
          opponent: { wallet: blackPlayer.wallet },
          match: match.toJSON()
        });
        
        io.to(blackPlayer.socketId).emit('match:found', {
          matchId,
          yourColor: 'black',
          opponent: { wallet: whitePlayer.wallet },
          match: match.toJSON()
        });
        
        // Start timer checking (only for timed games)
        if (!match.isUnlimited) {
          startTimerCheck(io, matchId);
        }
        
      } else {
        // Add to queue
        queue.push({
          wallet: socket.user.wallet,
          socketId: socket.id,
          joinedAt: Date.now()
        });
        
        socket.emit('queue:joined', { timeControl, isVipArena, position: queue.length });
      }
    });

    // Leave queue
    socket.on('queue:leave', () => {
      removeFromAllQueues(socket.user.wallet);
      socket.emit('queue:left');
    });

    // Make a move
    socket.on('match:move', ({ matchId, from, to, promotion }) => {
      const match = activeMatches.get(matchId);
      if (!match) {
        return socket.emit('error', { message: 'Match not found' });
      }
      
      if (match.status !== 'active') {
        return socket.emit('error', { message: 'Match is not active' });
      }
      
      // Verify it's this player's turn
      if (!match.isPlayerTurn(socket.user.wallet)) {
        return socket.emit('error', { message: 'Not your turn' });
      }
      
      // Rate limiting
      const lastMove = lastMoveTime.get(socket.user.wallet) || 0;
      if (Date.now() - lastMove < MOVE_RATE_LIMIT) {
        return socket.emit('error', { message: 'Too fast, slow down' });
      }
      lastMoveTime.set(socket.user.wallet, Date.now());
      
      // Make the move
      const result = match.makeMove(from, to, promotion);
      
      if (!result.valid) {
        return socket.emit('error', { message: result.error });
      }
      
      // Check for timeout during move
      if (result.timeout) {
        const loser = result.timeout;
        const winner = loser === 'white' ? 'black' : 'white';
        endMatch(io, match, `${winner}_wins`, match.players[winner].wallet, 'timeout');
        return;
      }
      
      // Broadcast move to both players
      io.to(matchId).emit('match:moved', {
        move: result.move,
        fen: result.fen,
        timeLeft: match.timeLeft,
        currentTurn: match.getCurrentTurnColor(),
        isCheck: result.isCheck
      });
      
      // Check for game end
      if (result.isGameOver) {
        let gameResult, winner;
        
        if (result.isCheckmate) {
          // The player who just moved won
          const winnerColor = result.move.color === 'w' ? 'white' : 'black';
          gameResult = `${winnerColor}_wins`;
          winner = match.players[winnerColor].wallet;
        } else {
          gameResult = 'draw';
          winner = null;
        }
        
        endMatch(io, match, gameResult, winner, 'checkmate');
      }
    });

    // Resign
    socket.on('match:resign', ({ matchId }) => {
      const match = activeMatches.get(matchId);
      if (!match || match.status === 'finished') return;
      
      const loserColor = match.getPlayerColor(socket.user.wallet);
      if (!loserColor) return;
      
      const winnerColor = loserColor === 'white' ? 'black' : 'white';
      endMatch(io, match, `${winnerColor}_wins`, match.players[winnerColor].wallet, 'resignation');
    });

    // Offer draw
    socket.on('match:offer_draw', ({ matchId }) => {
      const match = activeMatches.get(matchId);
      if (!match || match.status !== 'active') return;
      
      const opponent = match.getOpponent(socket.user.wallet);
      io.to(opponent.socketId).emit('match:draw_offered', {
        from: socket.user.wallet
      });
    });

    // Accept draw
    socket.on('match:accept_draw', ({ matchId }) => {
      const match = activeMatches.get(matchId);
      if (!match || match.status !== 'active') return;
      
      endMatch(io, match, 'draw', null, 'agreement');
    });

    // Decline draw
    socket.on('match:decline_draw', ({ matchId }) => {
      const match = activeMatches.get(matchId);
      if (!match) return;
      
      const opponent = match.getOpponent(socket.user.wallet);
      io.to(opponent.socketId).emit('match:draw_declined');
    });

    // Quick Chat - send preset message or emote
    socket.on('match:quickchat', ({ matchId, presetId, type }) => {
      const match = activeMatches.get(matchId);
      if (!match || match.status !== 'active') return;
      
      // Verify player is in this match
      const playerColor = match.getPlayerColor(socket.user.wallet);
      if (!playerColor) return;
      
      // Validate preset/emote
      const chatType = type || 'message';
      if (chatType === 'message' && !VALID_PRESETS.includes(presetId)) {
        return socket.emit('error', { message: 'Invalid quick chat preset' });
      }
      if (chatType === 'emote' && !VALID_EMOTES.includes(presetId)) {
        return socket.emit('error', { message: 'Invalid emote' });
      }
      
      // Rate limiting - 3 second cooldown
      const lastChat = quickChatCooldowns.get(socket.user.wallet) || 0;
      const now = Date.now();
      if (now - lastChat < QUICKCHAT_COOLDOWN) {
        return socket.emit('quickchat:cooldown', { 
          remaining: QUICKCHAT_COOLDOWN - (now - lastChat) 
        });
      }
      quickChatCooldowns.set(socket.user.wallet, now);
      
      // Broadcast to both players in the match
      io.to(matchId).emit('match:quickchat', {
        from: playerColor,
        wallet: socket.user.wallet,
        presetId,
        type: chatType,
        timestamp: now
      });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.user.wallet}`);
      
      // Remove from queues
      removeFromAllQueues(socket.user.wallet);
      
      // Check if in active match
      const matchId = playerMatches.get(socket.user.wallet);
      if (matchId) {
        const match = activeMatches.get(matchId);
        if (match && match.status === 'active') {
          // Notify opponent
          socket.to(matchId).emit('opponent:disconnected');
          
          // Start reconnection timer
          const timer = setTimeout(() => {
            // Player didn't reconnect, they forfeit
            const loserColor = match.getPlayerColor(socket.user.wallet);
            const winnerColor = loserColor === 'white' ? 'black' : 'white';
            endMatch(io, match, `${winnerColor}_wins`, match.players[winnerColor].wallet, 'abandonment');
          }, RECONNECT_GRACE_PERIOD);
          
          disconnectTimers.set(socket.user.wallet, timer);
        }
      }
    });
  });

  function removeFromAllQueues(wallet) {
    for (const tc of [0, 3, 5, 10]) {
      for (const type of ['free', 'vip']) {
        const queue = matchQueues[tc][type];
        const idx = queue.findIndex(p => p.wallet === wallet);
        if (idx !== -1) queue.splice(idx, 1);
      }
    }
  }

  function startTimerCheck(io, matchId) {
    const interval = setInterval(() => {
      const match = activeMatches.get(matchId);
      if (!match || match.status !== 'active') {
        clearInterval(interval);
        return;
      }
      
      // Calculate current time
      const now = Date.now();
      const elapsed = now - match.lastMoveTime;
      const currentTurn = match.getCurrentTurnColor();
      const currentTimeLeft = match.timeLeft[currentTurn] - elapsed;
      
      // Check for timeout
      if (currentTimeLeft <= 0) {
        const winner = currentTurn === 'white' ? 'black' : 'white';
        endMatch(io, match, `${winner}_wins`, match.players[winner].wallet, 'timeout');
        clearInterval(interval);
        return;
      }
      
      // Broadcast time update
      io.to(matchId).emit('match:time_update', {
        timeLeft: {
          white: currentTurn === 'white' ? currentTimeLeft : match.timeLeft.white,
          black: currentTurn === 'black' ? currentTimeLeft : match.timeLeft.black
        },
        currentTurn
      });
    }, 1000);
    
    const match = activeMatches.get(matchId);
    if (match) match.timerInterval = interval;
  }

  async function endMatch(io, match, result, winnerWallet, reason) {
    match.endGame(result, winnerWallet);
    
    // Clear disconnect timers
    disconnectTimers.delete(match.players.white.wallet);
    disconnectTimers.delete(match.players.black.wallet);
    
    // Update stats and get rewards
    let whiteRewards = null;
    let blackRewards = null;
    
    const whiteWon = result === 'white_wins';
    const blackWon = result === 'black_wins';
    
    if (match.isVipArena) {
      whiteRewards = await updateUserStats(match.players.white.wallet, whiteWon, true);
      blackRewards = await updateUserStats(match.players.black.wallet, blackWon, true);
    } else {
      // Free mode - just update win/loss counts, no rewards
      await updateUserStats(match.players.white.wallet, whiteWon, false);
      await updateUserStats(match.players.black.wallet, blackWon, false);
    }
    
    // Save match to database
    await saveMatch(match);
    
    // Notify players
    io.to(match.players.white.socketId).emit('match:ended', {
      result,
      reason,
      winner: winnerWallet,
      youWon: whiteWon,
      rewards: whiteRewards,
      finalState: match.toJSON()
    });
    
    io.to(match.players.black.socketId).emit('match:ended', {
      result,
      reason,
      winner: winnerWallet,
      youWon: blackWon,
      rewards: blackRewards,
      finalState: match.toJSON()
    });
    
    // Cleanup
    playerMatches.delete(match.players.white.wallet);
    playerMatches.delete(match.players.black.wallet);
    
    // Keep match in memory briefly for reconnection edge cases, then remove
    setTimeout(() => {
      activeMatches.delete(match.id);
    }, 60000);
  }

  return io;
}

// Export for API route status check
export function getQueueStatus() {
  return {
    queues: {
      0: { free: matchQueues[0].free.length, vip: matchQueues[0].vip.length },
      3: { free: matchQueues[3].free.length, vip: matchQueues[3].vip.length },
      5: { free: matchQueues[5].free.length, vip: matchQueues[5].vip.length },
      10: { free: matchQueues[10].free.length, vip: matchQueues[10].vip.length }
    },
    activeMatches: activeMatches.size
  };
}
