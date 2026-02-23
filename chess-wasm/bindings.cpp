#include <emscripten/bind.h>
#include "chess-simulator.h"
#include <string>
#include <type_traits>

// SFINAE: detect if ChessSimulator::Move accepts (string, int) — new signature
template <typename = void>
auto call_move(const std::string& fen, int timeLimitMs, int)
    -> decltype(ChessSimulator::Move(fen, timeLimitMs)) {
    return ChessSimulator::Move(fen, timeLimitMs);
}

// Fallback: old signature Move(string) — ignores timeLimitMs
template <typename = void>
auto call_move(const std::string& fen, int /*timeLimitMs*/, long)
    -> decltype(ChessSimulator::Move(fen)) {
    return ChessSimulator::Move(fen);
}

std::string safe_move(const std::string& fen, int timeLimitMs) {
    return call_move(fen, timeLimitMs, 0);
}

EMSCRIPTEN_BINDINGS(chess_module) {
    emscripten::function("move", &safe_move);
}
