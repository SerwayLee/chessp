import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_SERVER_URL || "http://localhost:3000";

const LoginRegisterPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);
    if (!form.username || !form.password) {
      setMessage("Enter username and password.");
      setIsError(true);
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/login" : "/api/register";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Request failed.");
        setIsError(true);
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      navigate("/main");
    } catch (err) {
      setMessage("Network error.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setMessage("");
    setIsError(false);
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2 className="section-title">{mode === "login" ? "Login" : "Register"}</h2>
      <form onSubmit={handleSubmit}>
        <input
          className="input"
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Working..." : mode === "login" ? "Login" : "Register"}
        </button>
      </form>
      {message && <div className={isError ? "error" : "success"}>{message}</div>}
      <div style={{ marginTop: 12, textAlign: "center" }}>
        {mode === "login" ? "Need an account?" : "Already have an account?"} {" "}
        <span className="link" onClick={toggleMode}>
          {mode === "login" ? "Register" : "Back to login"}
        </span>
      </div>
    </div>
  );
};

export default LoginRegisterPage;
