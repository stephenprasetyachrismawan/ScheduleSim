// Shared parts of the master-data records: the project, its tasks, developers and jobs, read
// from the raw file (or the typed spec) through the loader of the thesis.
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api";
import { Spinner } from "../../components/atoms";
import type { Master, ProjectBoard } from "../../types";

export function useMaster(key: string, capacity = 1.5) {
  const master = useQuery({ queryKey: ["master", key], queryFn: () => api.master(key), staleTime: Infinity, retry: false });
  const board = useQuery({ queryKey: ["project", key, capacity], queryFn: () => api.project(key, capacity),
                           staleTime: Infinity, retry: false });
  return { master: master.data, board: board.data, error: (master.error ?? board.error) as ApiError | null,
           loading: master.isLoading || board.isLoading };
}

export function MasterGate({ m, children }: { m: ReturnType<typeof useMaster>;
                                              children: (master: Master, board: ProjectBoard) => ReactNode }) {
  if (m.error) {
    return (
      <div className="o-page">
        <div className={`notice ${m.error.status === 403 ? "notice--warn" : "notice--error"}`}>
          {m.error.status === 403 && <Lock size={16} />}<span>{m.error.message}</span></div>
        {m.error.status === 403 && <Link to="/hasil-uji" className="btn">Buka Hasil uji tesis</Link>}
      </div>
    );
  }
  if (!m.master || !m.board) return <div className="o-page"><div className="o-empty o-empty--wait"><Spinner /> Membaca data master…</div></div>;
  return <>{children(m.master, m.board)}</>;
}

export const projectHref = (key: string, tab?: string) => `/proyek/${key}${tab ? `?tab=${tab}` : ""}`;
export const devHref = (key: string, id: number) => `/proyek/${key}/pengembang/${id}`;
export const jobHref = (key: string, id: number) => `/proyek/${key}/job/${id}`;

export function devName(board: ProjectBoard, id: number): string {
  return board.assignees.find((a) => a.id === id)?.name ?? `Pengembang ${id + 1}`;
}

export function jobName(board: ProjectBoard, id: number): string {
  return board.epics.find((e) => e.id === id)?.name ?? `Job ${id + 1}`;
}

/** Where a task came from in the file, as a short sentence. */
export function whereWritten(m: Master): string {
  return m.source.kind === "file"
    ? `berkas ${m.source.path?.split("/").pop()}`
    : "issue yang diketik di proyek ini";
}
