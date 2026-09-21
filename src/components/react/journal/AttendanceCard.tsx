import type { SyntheticEvent } from "react";
import { shortDate, statusClass } from "./constants";
import type { JournalLesson } from "./api";

interface Props {
  lessons: JournalLesson[];
  showTip: (e: SyntheticEvent<HTMLElement>, lesson: JournalLesson) => void;
  hideTip: () => void;
}

export function attendanceStats(lessons: JournalLesson[]) {
  const total = lessons.length;
  const count = (s: JournalLesson["status"]) => lessons.filter((l) => l.status === s).length;
  const present = count("present");
  const absent = count("absent");
  const excused = count("excused");
  const percent = total ? Math.round((present / total) * 100) : 0;
  return { total, present, absent, excused, percent };
}

function pieGradient({ total, present, absent, excused }: ReturnType<typeof attendanceStats>) {
  if (total === 0) return "var(--none-bg)";
  const p = (present / total) * 100;
  const a = ((present + absent) / total) * 100;
  const e = ((present + absent + excused) / total) * 100;
  return `conic-gradient(var(--present) 0% ${p}%, var(--absent) ${p}% ${a}%, var(--excused) ${a}% ${e}%, var(--none-bg) ${e}% 100%)`;
}

export function AttendanceCard({ lessons, showTip, hideTip }: Props) {
  const chrono = [...lessons].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  );
  const stats = attendanceStats(chrono);

  return (
    <div className="jr-att-card">
      <div className="jr-att-title">Посещаемость</div>

      {chrono.length === 0 ? (
        <div className="jr-empty" style={{ fontSize: 16, padding: "0 0 4px 0" }}>
          Пока нет занятий для статистики
        </div>
      ) : (
        <div className="jr-att-body">
          <div className="jr-att-table-wrap">
            <table className="jr-att-table">
              <tbody>
                <tr>
                  {chrono.map((l) => (
                    <td className="jr-att-date-cell" key={l.id}>{shortDate(l.date)}</td>
                  ))}
                </tr>
                <tr>
                  {chrono.map((l) => (
                    <td
                      className={"jr-att-num-cell " + statusClass(l.status)}
                      key={l.id}
                      onMouseEnter={(e) => showTip(e, l)}
                      onMouseLeave={hideTip}
                    >
                      {l.status === "present" ? "1" : l.status === "none" ? "·" : "0"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="jr-att-side">
            <div className="jr-att-pie" style={{ background: pieGradient(stats) }}>
              <div className="jr-att-pie-hole">{stats.percent}%</div>
            </div>

            <div className="jr-att-legend">
              <div className="jr-att-legend-row">
                <span className="jr-att-legend-dot present" />
                Пришёл <span className="jr-att-legend-num">{stats.present}</span>
              </div>
              <div className="jr-att-legend-row">
                <span className="jr-att-legend-dot absent" />
                Не был <span className="jr-att-legend-num">{stats.absent}</span>
              </div>
              <div className="jr-att-legend-row">
                <span className="jr-att-legend-dot excused" />
                Уваж. <span className="jr-att-legend-num">{stats.excused}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
