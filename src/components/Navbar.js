import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { disconnectSocket } from "../socket";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem("username");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    disconnectSocket();
    navigate("/login");
  };

  const showActions = location.pathname !== "/login";

  return (
    <header className="navbar">
      <div className="brand">Live Chess</div>
      {showActions && (
        <div className="nav-right">
          {username && <span className="pill">User: {username}</span>}
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
};

export default Navbar;
