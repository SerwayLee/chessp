import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginRegisterPage from "./components/LoginRegisterPage";
import Mainpage from "./components/Mainpage";
import ChessGame from "./components/ChessGame";
import PrivateRoute from "./components/PrivateRoute";
import Navbar from "./components/Navbar";

const App = () => {
  return (
    <Router>
      <Navbar />
      <div className="app-shell">
        <Routes>
          <Route path="/login" element={<LoginRegisterPage />} />
          <Route
            path="/main"
            element={
              <PrivateRoute>
                <Mainpage />
              </PrivateRoute>
            }
          />
          <Route
            path="/game"
            element={
              <PrivateRoute>
                <ChessGame />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
