import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../socket";

const Mainpage = () => {
  const navigate = useNavigate();
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [matching, setMatching] = useState(false);
  const [randomStatus, setRandomStatus] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    if (!token || !username) {
      navigate("/login");
      return;
    }

    const s = getSocket();
    if (!s) return;
    setSocket(s);

    const handleConnect = () => setStatus("Socket connected");
    const handleConnectError = (err) => setError(err.message);
    const handleUserList = (users) => setConnectedUsers(users);
    const handleDisconnect = () => setStatus("Socket disconnected");

    s.on("connect", handleConnect);
    s.on("connect_error", handleConnectError);
    s.on("update_user_list", handleUserList);
    s.on("disconnect", handleDisconnect);

    return () => {
      s.emit("cancel_random");
      s.off("connect", handleConnect);
      s.off("connect_error", handleConnectError);
      s.off("update_user_list", handleUserList);
      s.off("disconnect", handleDisconnect);
    };
  }, [navigate]);

  useEffect(() => {
    if (!socket) return;
    const handleMatchFound = (payload) => {
      setMatching(false);
      setRandomStatus("Opponent found! Redirecting...");
      navigate("/game", { state: { mode: "random", roomId: payload.roomId, color: payload.color || "white" } });
    };
    const handleMatchFailed = (payload) => {
      setMatching(false);
      setRandomStatus("");
      setError(payload?.error || "Random match failed.");
    };
    socket.on("random_match_found", handleMatchFound);
    socket.on("random_match_failed", handleMatchFailed);
    return () => {
      socket.off("random_match_found", handleMatchFound);
      socket.off("random_match_failed", handleMatchFailed);
    };
  }, [socket, navigate]);

  const goToGame = (payload) => {
    navigate("/game", { state: payload });
  };

  const cancelRandomQueue = () => {
    if (socket) {
      socket.emit("cancel_random");
    }
    setMatching(false);
    setRandomStatus("");
  };

  const handleCreateRoom = () => {
    if (!socket) return;
    if (!roomId.trim()) {
      setError("Enter a room title.");
      return;
    }
    cancelRandomQueue();
    setError("");
    socket.emit("create_room", { roomId, password: roomPassword }, (res) => {
      if (res?.error) {
        setError(res.error);
        return;
      }
      setStatus("Room created.");
      goToGame({ mode: "multiplayer", roomId, color: res?.color || "white", password: roomPassword });
    });
  };

  const handleJoinRoom = () => {
    if (!socket) return;
    if (!joinRoomId.trim()) {
      setError("Enter the room title to join.");
      return;
    }
    cancelRandomQueue();
    setError("");
    socket.emit("join_room", { roomId: joinRoomId, password: joinPassword }, (res) => {
      if (res?.error) {
        setError(res.error);
        return;
      }
      setStatus("Joined room.");
      goToGame({ mode: "multiplayer", roomId: joinRoomId, color: res?.color || "white", password: joinPassword });
    });
  };

  const handleRandomMatch = () => {
    if (!socket) return;
    setError("");
    setMatching(true);
    setRandomStatus("Queueing for random match...");
    socket.emit("random_join", (res) => {
      if (res?.error) {
        setError(res.error);
        setMatching(false);
        setRandomStatus("");
        return;
      }
      if (res?.queued) {
        setRandomStatus(res.message || "Waiting for opponent...");
        return;
      }
      setMatching(false);
      goToGame({ mode: "random", roomId: res.roomId, color: res.color || "white" });
    });
  };

  const startAIGame = () => {
    cancelRandomQueue();
    goToGame({ mode: "ai" });
  };

  return (
    <div className="layout">
      <div className="card">
        <h3 className="section-title">Private Match</h3>
        <div className="inline-actions">
          <div style={{ flex: 1 }}>
            <label>Room Title</label>
            <input
              className="input"
              placeholder="e.g. friday-fight"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <label>Password (optional)</label>
            <input
              className="input"
              placeholder="Password"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
            />
            <button className="btn" onClick={handleCreateRoom}>
              Create Room
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <label>Room Title to Join</label>
            <input
              className="input"
              placeholder="Room to join"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
            />
            <label>Room Password</label>
            <input
              className="input"
              placeholder="Password"
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
            />
            <button className="btn secondary" onClick={handleJoinRoom}>
              Join Room
            </button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="status">
            {status || "Create or join a private room with a friend."}
          </div>
          {error && <div className="error">{error}</div>}
        </div>
      </div>
      <div className="card">
        <h3 className="section-title">Lobby</h3>
        <div className="list" style={{ minHeight: 60 }}>
          {connectedUsers.length === 0 && <span className="muted">No one is online yet.</span>}
          {connectedUsers.map((u) => (
            <span key={u} className="chip">
              {u}
            </span>
          ))}
        </div>
        <hr style={{ borderColor: "#111827", margin: "18px 0" }} />
        <h3 className="section-title">Random Match</h3>
        <p style={{ color: "var(--muted)" }}>Instantly pair with another player looking for a game. No password needed.</p>
        <button className="btn" onClick={handleRandomMatch} disabled={matching}>
          {matching ? "Searching..." : "Start Random Match"}
        </button>
        {randomStatus && <div className="status" style={{ marginTop: 10 }}>{randomStatus}</div>}
        <hr style={{ borderColor: "#111827", margin: "18px 0" }} />
        <h3 className="section-title">Play vs AI</h3>
        <p style={{ color: "var(--muted)" }}>Start a quick match against a simple random AI.</p>
        <button className="btn secondary" onClick={startAIGame}>
          Start AI Game
        </button>
      </div>
    </div>
  );
};

export default Mainpage;
