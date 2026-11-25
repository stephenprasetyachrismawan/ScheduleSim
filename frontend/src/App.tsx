import { Navigate, Route, Routes } from "react-router-dom";
import Shell from "./components/Shell";
import GlossaryPage from "./pages/GlossaryPage";
import LearnPage from "./pages/LearnPage";
import LessonPage from "./pages/LessonPage";
import { DeveloperForm, JobForm } from "./pages/master/DeveloperForm";
import ProjectForm from "./pages/master/ProjectForm";
import TaskForm from "./pages/master/TaskForm";
import MethodPage from "./pages/MethodPage";
import ProjectEditor from "./pages/ProjectEditor";
import ProjectsPage from "./pages/ProjectsPage";
import ResultsPage from "./pages/ResultsPage";
import EndForm from "./pages/sim/EndForm";
import EventForm from "./pages/sim/EventForm";
import MethodForm from "./pages/sim/MethodForm";
import RunForm from "./pages/sim/RunForm";
import RunList from "./pages/sim/RunList";
import RunNew from "./pages/sim/RunNew";

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<ProjectsPage />} />
        <Route path="proyek/baru" element={<ProjectEditor />} />
        <Route path="proyek/:key" element={<ProjectForm />} />
        <Route path="proyek/:key/ubah" element={<ProjectEditor />} />
        <Route path="proyek/:key/tugas/:id" element={<TaskForm />} />
        <Route path="proyek/:key/pengembang/:id" element={<DeveloperForm />} />
        <Route path="proyek/:key/job/:id" element={<JobForm />} />
        <Route path="simulasi" element={<RunList />} />
        <Route path="simulasi/baru" element={<RunNew />} />
        <Route path="simulasi/run" element={<RunForm />} />
        <Route path="simulasi/run/:mk" element={<MethodForm />} />
        <Route path="simulasi/run/:mk/kejadian/:k" element={<EventForm />} />
        <Route path="simulasi/run/:mk/akhir" element={<EndForm />} />
        <Route path="simulasi/*" element={<Navigate replace to="/simulasi" />} />
        <Route path="hasil-uji" element={<ResultsPage />} />
        <Route path="metode" element={<MethodPage />} />
        <Route path="istilah" element={<GlossaryPage />} />
        <Route path="belajar" element={<LearnPage />} />
        <Route path="belajar/:id" element={<LessonPage />} />
        <Route path="*" element={<div className="o-page"><div className="o-empty">Halaman tidak ditemukan. Pilih menu di bilah atas.</div></div>} />
      </Route>
    </Routes>
  );
}
