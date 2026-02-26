#include "chess-simulator.h"
// disservin's lib. drop a star on his hard work!
// https://github.com/Disservin/chess-library
#include "chess.hpp"
#include <random>

constexpr int INF = 1e9;
constexpr int MATE = 9000;
using namespace ChessSimulator;

int PIECE_VALUES[6] = {
  100, //Pawn
  320, //Knight
  330, //Bishop
  500, //Rook
  900, //Queen
  999999 //King
};

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
    return 8 + rank * file; //Rank 1 row first
  }
}

inline const int* pstForPiece(chess::PieceType pt)
{
  if (pt == chess::PieceType::PAWN)
  {
    return PAWN_PST;
  }
  else if (pt == chess::PieceType::KNIGHT)
  {
    return KNIGHT_PST;
  }
  else if (pt == chess::PieceType::BISHOP)
  {
    return BISHOP_PST;
  }
  else if (pt == chess::PieceType::ROOK)
  {
    return ROOK_PST;
  }
  else if (pt == chess::PieceType::QUEEN)
  {
    return QUEEN_PST;
  }
  else if (pt == chess::PieceType::KING)
  {
    return KING_MIDDLEGAME_PST;
  }

}

static int Evaluate(chess::Board& board) {
  int score = 0;

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
    const int* table = pstForPiece(pieceType);

    if (table)
    {
      pst = table[pstIndex(sq, color)];
    }

    int pieceScore = material + pst;
    score += color == chess::Color::WHITE ? pieceScore : -pieceScore;
  }

  return board.sideToMove() == chess::Color::WHITE ? score : -score;
}

int negamax(chess::Board& board, int depth, int alpha, int beta, int ply) //Using negamax, which is an alternate form of minmax that works better with my eval function
{
  chess::Movelist moves;
  chess::movegen::legalmoves(moves, board);

  if (depth == 0)
  {
    return Evaluate(board);
  }

  if (moves.empty())
  {
    return board.inCheck() ? (-MATE - ply) : 0;
  }

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

  // here goes a random movement
  chess::Board board(fen);
  chess::Movelist moves;
  chess::movegen::legalmoves(moves, board);
  if(moves.size() == 0)
    return "";

  chess::Move bestMove = moves[0];
  int bestScore = -INF;

  for (auto& move: moves)
  {
    board.makeMove(move);
    int score = -negamax(board, 3, -INF, INF, 1);
    board.unmakeMove(move);

    if (score > bestScore)
    {
      bestScore = score;
      bestMove = move;
    }
  }

  return chess::uci::moveToUci(bestMove);
}


