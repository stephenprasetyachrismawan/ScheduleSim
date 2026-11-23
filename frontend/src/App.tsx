import { Route, Routes } from "react-router-dom";
import Shell from "./components/Shell";
import MethodPage from "./pages/MethodPage";
import ProjectEditor from "./pages/ProjectEditor";
import ProjectPage from "./pages/ProjectPage";
import ProjectsPage from "./pages/ProjectsPage";
import ResultsPage from "./pages/ResultsPage";
import SimulationPage from "./pages/SimulationPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<ProjectsPage />} />
        <Route path="proyek/baru" element={<ProjectEditor />} />
        <Route path="proyek/:key" element={<ProjectPage />} />
        <Route path="proyek/:key/ubah" element={<ProjectEditor />} />
        <Route path="simulasi" element={<SimulationPage />} />
        <Route path="hasil-uji" element={<ResultsPage />} />
        <Route path="metode" element={<MethodPage />} />
        <Route path="*" element={<div className="page"><h1 className="page__title">Halaman tidak ditemukan</h1></div>} />
      </Route>
    </Routes>
  );
}
