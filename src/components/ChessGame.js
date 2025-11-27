import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getSocket } from "../socket";

const ChessGame = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const mode = state.mode || "ai";
  const roomId = state.roomId;
  const roomPassword = state.password;
  const isOnline = mode === "multiplayer" || mode === "random";

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(() => gameRef.current.fen());
  const [playerColor, setPlayerColor] = useState(state.color || "white");
  const [status, setStatus] = useState("");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (isOnline && !roomId) {
      navigate("/main");
    }
  }, [isOnline, navigate, roomId]);

  useEffect(() => {
    if (!isOnline) return;

    const s = getSocket();
    if (!s) {
      navigate("/login");
      return;
    }
    setSocket(s);

    s.emit("join_room", { roomId, password: roomPassword }, (res) => {
      if (res?.error) {
        setStatus(res.error);
        return;
      }
      if (res?.color) {
        setPlayerColor(res.color);
      }
      if (res?.fen) {
        gameRef.current.load(res.fen);
        setFen(res.fen);
      }
      setStatus("Waiting for opponent to join...");
    });

    const handleMove = ({ fen: nextFen }) => {
      gameRef.current.load(nextFen);
      setFen(nextFen);
      setStatus("Your turn");
    };
    const handleOpponentLeft = () => setStatus("Opponent left. Return to lobby.");
    const handleOpponentJoined = ({ username: opponent }) => setStatus(`${opponent} joined the game.`);
    const handleDisconnect = () => setStatus("Disconnected from server.");

    s.on("move", handleMove);
    s.on("opponent_left", handleOpponentLeft);
    s.on("opponent_joined", handleOpponentJoined);
    s.on("disconnect", handleDisconnect);

    return () => {
      s.off("move", handleMove);
      s.off("opponent_left", handleOpponentLeft);
      s.off("opponent_joined", handleOpponentJoined);
      s.off("disconnect", handleDisconnect);
    };
  }, [isOnline, roomId, navigate, roomPassword]);

  const updateStatus = () => {
    const turn = gameRef.current.turn() === "w" ? "white" : "black";
    if (gameRef.current.isCheckmate()) {
      setStatus(`Checkmate! ${turn === "white" ? "Black" : "White"} wins.`);
    } else if (gameRef.current.isDraw()) {
      setStatus("Draw.");
    } else {
      setStatus(`${turn === "white" ? "White" : "Black"} to move.`);
    }
  };

  useEffect(() => {
    updateStatus();
  }, [fen]);

  const makeAiMove = () => {
    if (mode !== "ai") return;
    if (gameRef.current.isGameOver()) {
      updateStatus();
      return;
    }
    const possibleMoves = gameRef.current.moves();
    if (possibleMoves.length === 0) {
      updateStatus();
      return;
    }
    const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    gameRef.current.move(move);
    const newFen = gameRef.current.fen();
    setFen(newFen);
    updateStatus();
  };

  const onDrop = (sourceSquare, targetSquare) => {
    if (gameRef.current.isGameOver()) return false;

    if (isOnline) {
      const turn = gameRef.current.turn() === "w" ? "white" : "black";
      if (turn !== playerColor) {
        setStatus("Opponent's turn.");
        return false;
      }
    }

    const move = gameRef.current.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });

    if (move == null) return false;

    const newFen = gameRef.current.fen();
    setFen(newFen);

    if (mode === "ai") {
      setTimeout(() => makeAiMove(), 250);
    } else if (socket && roomId) {
      socket.emit("move", { roomId, move, fen: newFen });
    }

    updateStatus();
    return true;
  };

  const orientation = useMemo(() => playerColor, [playerColor]);

  const handleBackToLobby = () => {
    if (socket && isOnline && roomId) {
      socket.emit("leave_room");
    }
    navigate("/main");
  };

  return (
    <div className="game-layout">
      <div className="board-wrapper">
        <Chessboard position={fen} onPieceDrop={onDrop} boardOrientation={orientation} />
      </div>
      <div className="info-grid">
        <div className="mini-card">
          <div>Mode: {isOnline ? (mode === "random" ? "Random match" : "Private match") : "AI"}</div>
          {isOnline && (
            <>
              <div>Room: {roomId}</div>
              <div>My color: {playerColor === "white" ? "White" : "Black"}</div>
            </>
          )}
          <div style={{ marginTop: 8 }} className="status">
            {status}
          </div>
        </div>
        <div className="mini-card">
          <button className="btn secondary" onClick={handleBackToLobby}>
            Back to lobby
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChessGame;
