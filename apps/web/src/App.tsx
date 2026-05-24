import { Activity, BarChart3, Database, Users } from "lucide-react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import CreatorPage from "./pages/CreatorPage.js";
import CreatorsPage from "./pages/CreatorsPage.js";
import IslandPage from "./pages/IslandPage.js";
import RankingsPage from "./pages/RankingsPage.js";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Island Intel home">
          <span className="brand-mark">
            <BarChart3 size={19} />
          </span>
          <span>
            <strong>Island Intel</strong>
            <small>Fortnite ecosystem rankings</small>
          </span>
        </Link>
        <nav className="nav-tabs" aria-label="Primary">
          <NavLink to="/" end>
            <Activity size={16} />
            Rankings
          </NavLink>
          <NavLink to="/creators">
            <Users size={16} />
            Creators
          </NavLink>
          <a href="http://localhost:3201/api/health" target="_blank" rel="noreferrer">
            <Database size={16} />
            API
          </a>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<RankingsPage />} />
          <Route path="/islands/:code" element={<IslandPage />} />
          <Route path="/creators" element={<CreatorsPage />} />
          <Route path="/creators/:creatorCode" element={<CreatorPage />} />
        </Routes>
      </main>
    </div>
  );
}
