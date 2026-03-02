#include "chess-simulator.h"
// disservin's lib. drop a star on his hard work!
// https://github.com/Disservin/chess-library
#include "chess.hpp"
#include <random>
#include <chrono>
#include <fstream>

//std::vector<std::string> gameMoves;

constexpr int INF = 1e9;
constexpr int MATE = 9000;

auto searchDeadline = std::chrono::steady_clock::now();
static int nodeCount = 0;
static bool timeUp = false;

using namespace ChessSimulator;

int PIECE_VALUES[6] = {
  100, //Pawn
  320, //Knight
  330, //Bishop
  500, //Rook
  900, //Queen
  999999 //King
};

const int ATTACK_WEIGHT[] = {0, 0, 50, 75, 88, 94, 97, 99, 99};

//Piece Square Tables

int PAWN_PST[64] = {
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
};

int KNIGHT_PST[64] = {
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
};

int BISHOP_PST[64] = {
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
};

int ROOK_PST[64] = {
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
};

int QUEEN_PST[64] = {
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
  0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
};

int KING_MIDDLEGAME_PST[64] = {
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
};

int KING_ENDGAME_PST[64] = {
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50
};

inline int pstIndex(chess::Square sq, chess::Color color)
{
  int file = sq.file();
  int rank = sq.rank();

  if (color == chess::Color::WHITE)
  {
    return (7 - rank) * 8 + file; // Flip
  }
  else
  {
    return rank * 8 + file; //Rank 1 row first
  }
}

inline const int* pstForPiece(chess::PieceType pt, bool endGame)
{
  switch (pt.internal())
  {
  case chess::PieceType::underlying::PAWN:
    return PAWN_PST;

  case chess::PieceType::underlying::KNIGHT:
    return KNIGHT_PST;

  case chess::PieceType::underlying::BISHOP:
    return BISHOP_PST;

  case chess::PieceType::underlying::ROOK:
    return ROOK_PST;

  case chess::PieceType::underlying::QUEEN:
    return QUEEN_PST;

    case chess::PieceType::underlying::KING:
    return endGame ? KING_ENDGAME_PST : KING_MIDDLEGAME_PST;
  }

}

int moveScore(chess::Board& board, const chess::Move& move) { //MVV / LVA
  if (board.at(move.to()) == chess::Piece::NONE) {
    return 0; //No Capture
  }

  int victim = PIECE_VALUES[(int)board.at(move.to()).type().internal()];
  int attacker = PIECE_VALUES[(int)board.at(move.from()).type().internal()];

  return victim - attacker;
}

int totalPieces(const chess::Board& board) {
  int total = 0;

  for (int sq = 0; sq < 64; sq++) {
    chess::Piece piece = board.at(chess::Square(sq));
    if (piece == chess::Piece::NONE || piece.type() == chess::PieceType::KING) {
      continue;
    }
    total += PIECE_VALUES[(int)piece.type().internal()];
  }
  return total;
}

constexpr int ENDGAME_THRESHOLD = 2000;

int evaluatePawnShield(const chess::Board& board, chess::Color side) {
  chess::Square kingSq = board.kingSq(side);
  int kingFile = kingSq.file();
  int score = 0;

  for (int f = std::max(0, kingFile -1); f <= std::min(7, kingFile + 1); f++) {
    int shieldRank =  (side == chess::Color::WHITE) ? kingSq.rank() + 1: kingSq.rank() - 1;
    chess::Rank trueRank = shieldRank;
    chess::File trueFile = f;

    chess::Square sq = chess::Square(trueRank, trueFile);

    if (board.at(sq).type() == chess::PieceType::PAWN && board.at(sq).color() == side) {
      score += 10;
    }
    else {
      score -= 15;
    }
  }
  return score;
}

int openFilesNearKing(const chess::Board& board, chess::Color side)
{
  chess::Square kingSquare = board.kingSq(side);
  int kingFile = kingSquare.file();
  int penalty = 0;

  for (int f = std::max(0, kingFile - 1); f <= std::min(7, kingFile + 1); f++)
  {
    bool hasGoodPawn = false;
    bool hasBadPawn = false;

    for (int r = 0; r < 8; r++)
    {
      chess::Piece piece = board.at(chess::Square(r * 8 + f));
      if (piece == chess::Piece::NONE)
      {
        continue;
      }
      if (piece.type() != chess::PieceType::PAWN)
      {
        continue;
      }
      if (piece.color() == side)
      {
        hasGoodPawn = true;
      }
      else
      {
        hasBadPawn = true;
      }
    }
    if (!hasGoodPawn && !hasBadPawn)
    {
      penalty -= 25;
    }
    else if (!hasGoodPawn)
    {
      penalty -= 10;
    }
  }
  return penalty;
}

int enemySquaresNearKing(const chess::Board& board, chess::Color side)
{
  chess::Square kingSquare = board.kingSq(side);
  int kingFile = kingSquare.file();
  int kingRank = kingSquare.rank();

  chess::Color enemy = (side == chess::Color::WHITE) ? chess::Color::BLACK : chess::Color::WHITE;
  int penalty = 0;

  for (int df = -2; df <= 2; df++)
  {
    for (int dr = -2; dr <= 2; dr++)
    {
      int f = kingFile + df;
      int r = kingRank + dr;

      if (f < 0 || f > 7 || r < 0 || r > 7)
      {
        continue;
      }

      chess::Piece piece = board.at(chess::Square(r * 8 + f));
      if (piece == chess::Piece::NONE)
      {
        continue;
      }
      if (piece.color() != enemy)
      {
        continue;
      }

      int distance = std::max(std::abs(df), std::abs(dr));
      switch (piece.type().internal())
      {
      case chess::PieceType::underlying::QUEEN: penalty -= (distance == 1) ? 40 : 20; break;
      case chess::PieceType::underlying::ROOK: penalty -= (distance == 1) ? 25 : 10; break;
      case chess::PieceType::underlying::BISHOP: penalty -= (distance == 1) ? 15 : 5; break;
      case chess::PieceType::underlying::KNIGHT: penalty -= (distance == 1) ? 15 : 5; break;
      default: break;
      }
    }
  }
  return penalty;
}

int kingPositionSafety(const chess::Board& board, chess::Color side)
{
  chess::Square kingSquare = board.kingSq(side);
  int kingFile = kingSquare.file();

  if (kingFile <= 2 || kingFile >= 5)
  {
    return 20;
  }

  if (kingFile == 3 || kingFile == 4)
  {
    return -30;
  }

  return 0;
}

int evaluateMobility(const chess::Board& board) {
  int score = 0;
  
}

static int Evaluate(chess::Board& board) {
  int score = 0;
  bool endgame = totalPieces(board) < ENDGAME_THRESHOLD;
  for (int sq = 0; sq < 64; sq++)
  {
    chess::Square square(sq);
    chess::Piece piece = board.at(square);

    if (piece == chess::Piece::NONE)
    {
      continue;
    }

    chess::PieceType pieceType = piece.type();
    chess::Color color = piece.color();

    int material = PIECE_VALUES[static_cast<int>(pieceType)];
    int pst = 0;
    const int* table = pstForPiece(pieceType, endgame);

    if (table)
    {
      pst = table[pstIndex(square, color)];
    }

    int pieceScore = material + pst;
    score += color == chess::Color::WHITE ? pieceScore : -pieceScore;
  }

  if (!endgame) {
    score += evaluatePawnShield(board, chess::Color::WHITE);
    score -= evaluatePawnShield(board, chess::Color::BLACK);

    score += openFilesNearKing(board, chess::Color::WHITE);
    score -= openFilesNearKing(board, chess::Color::BLACK);

    score += enemySquaresNearKing(board, chess::Color::WHITE);
    score -= enemySquaresNearKing(board, chess::Color::BLACK);

    score += kingPositionSafety(board, chess::Color::WHITE);
    score -= kingPositionSafety(board, chess::Color::BLACK);
  }

  return board.sideToMove() == chess::Color::WHITE ? score : -score;
}

int quiescence(chess::Board& board, int alpha, int beta) {
  if (timeUp) return 0;

  int stand_pat = Evaluate(board);
  if (stand_pat >= beta) {
    return beta;
  }
  if (stand_pat > alpha) {
    alpha = stand_pat;
  }

  chess::Movelist captures;
  chess::movegen::legalmoves<chess::movegen::MoveGenType::CAPTURE>(captures, board);

  std::sort(captures.begin(), captures.end(), [&](const chess::Move& a, const chess::Move& b) {
    return moveScore(board, a) > moveScore(board, b);
  });

  for (auto& move : captures) {
    board.makeMove(move);
    int score = -quiescence(board, -beta, -alpha);
    board.unmakeMove(move);

    if (score >= beta) {
      return beta;
    }

    if (score > alpha) {
      alpha = score;
    }
  }

  return alpha;
}

int negamax(chess::Board& board, int depth, int alpha, int beta, int ply) //Using negamax, which is an alternate form of minmax that works better with my eval function
{
  if ((nodeCount++ & 1023) == 0) {
    if (std::chrono::steady_clock::now() >= searchDeadline) {
      timeUp = true;
      return 0; //Abort, checked every 1024 nodes to prevent expensive calls
    }
  }

  if (timeUp) return 0;

  chess::Movelist moves;
  chess::movegen::legalmoves(moves, board);

  if (depth == 0)
  {
    return quiescence(board, alpha, beta);
  }

  if (moves.empty())
  {
    return board.inCheck() ? -(MATE - ply) : 0;
  }

  //Move Ordering
  std::sort(moves.begin(), moves.end(), [&](const chess::Move a, const chess::Move& b) {
    return moveScore(board, a) > moveScore(board, b);
  });

  for (auto move : moves)
  {
    board.makeMove(move);
    int score = -negamax(board, depth - 1, -beta, -alpha, ply + 1);
    board.unmakeMove(move);

    if (score >= beta)
    {
      return beta;
    }

    if (score > alpha)
    {
      alpha = score;
    }
  }
  return alpha;
}


std::string ChessSimulator::Move(std::string fen, int timeLimitMs) {
  // create your board based on the board string following the FEN notation
  // search for the best move using minimax / monte carlo tree search /
  // alpha-beta pruning / ... try to use nice heuristics to speed up the search
  // and have better results return the best move in UCI notation you will gain
  // extra points if you create your own board/move representation instead of
  // using the one provided by the library

  chess::Board board(fen);
  chess::Movelist moves;
  chess::movegen::legalmoves(moves, board);

  if(moves.size() == 0)
    return "";

  auto start = std::chrono::steady_clock::now();
  searchDeadline = start + std::chrono::milliseconds( (long long) (timeLimitMs * 0.1));
  nodeCount = 0;
  timeUp = false;

  auto elapsed = [&]() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now() - start).count();
  };

  chess::Move bestMove = moves[0];
  for (int depth = 1; depth <= 64; depth++) {
    chess::Move depthBest = moves[0];
    int bestScore = -INF;

    for (auto& move: moves)
    {
      board.makeMove(move);
      int score = -negamax(board, depth - 1, -INF, INF, 1);
      board.unmakeMove(move);

      if (score > bestScore)
      {
        bestScore = score;
        depthBest = move;
      }

      if (timeUp || elapsed() > timeLimitMs * 0.8) goto done;
    }
    bestMove = depthBest;
  }
  done:
  std::string result = chess::uci::moveToUci(bestMove);
 //gameMoves.push_back(result);

  //Write PGN
  //std::ofstream pgn("game.pgn");
  //for (int i = 0; i < gameMoves.size(); i++) {
   // if (i % 2 == 0) pgn << (i/2 + 1) << ". ";
   //pgn << gameMoves[i] << " ";
  //}
  //pgn.close();
  return result;
}


