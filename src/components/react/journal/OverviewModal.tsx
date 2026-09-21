import { useState, type SyntheticEvent } from "react";
import { Plus } from "lucide-react";
import { Modal } from "./Modal";
import { shortDate, statusClass } from "./constants";
import type { JournalLesson, JournalStudent } from "./api";

interface Props {
  students: JournalStudent[];
  extraDates: string[];
  onAddDate: (date: string) => void;
  onSetValue: (studentId: string, date: string, value: string) => void;
  onOpenStudent: (studentId: string) => void;
  showTip: (e: SyntheticEvent<HTMLElement>, lesson: JournalLesson) => void;
  hideTip: () => void;
  onClose: () => void;
}

export function OverviewModal({
  students,
  extraDates,
  onAddDate,
  onSetValue,
  onOpenStudent,
  showTip,
  hideTip,
  onClose,
}: Props) {
  const [newDate, setNewDate] = useState("");

  const dates = Array.from(
    new Set([...students.flatMap((s) => s.lessons.map((l) => l.date)), ...extraDates])
  ).sort();

  function addDate() {
    if (!newDate) return;
    onAddDate(newDate);
    setNewDate("");
  }

  return (
    <Modal title="Общая таблица посещаемости" onClose={onClose} maxWidth={720}>
      <div className="jr-overview-hint">
        Кликните в ячейку и введите с клавиатуры: <b>1</b> — пришёл, <b>0</b> — не был. Пусто — занятия не было.
      </div>

      <div className="jr-overview-add-date">
        <input
          type="date"
          className="jr-form-input"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
        />
        <button className="jr-btn-primary" onClick={addDate}>
          <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
          Добавить дату
        </button>
      </div>

      {students.length === 0 ? (
        <div className="jr-empty" style={{ fontSize: 18, padding: "10px 0 16px 0" }}>
          Пока нет учеников.
        </div>
      ) : dates.length === 0 ? (
        <div className="jr-empty" style={{ fontSize: 18, padding: "10px 0 16px 0" }}>
          Пока нет дат — добавьте дату выше.
        </div>
      ) : (
        <div className="jr-overview-table-wrap">
          <table className="jr-overview-table">
            <thead>
              <tr>
                <th className="jr-overview-name-col">Ученик</th>
                {dates.map((d) => (
                  <th key={d}>{shortDate(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="jr-overview-name-col" onClick={() => onOpenStudent(s.id)}>
                    {s.name}
                  </td>
                  {dates.map((d) => {
                    const lesson = s.lessons.find((l) => l.date === d);
                    const displayValue =
                      !lesson || lesson.status === "none" ? "" : lesson.status === "present" ? "1" : "0";
                    return (
                      <td
                        className={"jr-overview-cell " + (lesson ? statusClass(lesson.status) : "none")}
                        key={d}
                        onMouseEnter={(e) => lesson && showTip(e, lesson)}
                        onMouseLeave={hideTip}
                      >
                        <input
                          className="jr-overview-input"
                          value={displayValue}
                          inputMode="numeric"
                          maxLength={1}
                          aria-label={`${s.name}, ${d}`}
                          onChange={(e) => onSetValue(s.id, d, e.target.value)}
                          onFocus={(e) => lesson && showTip(e, lesson)}
                          onBlur={hideTip}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="jr-modal-actions">
        <button className="jr-btn-secondary" onClick={onClose}>Закрыть</button>
      </div>
    </Modal>
  );
}
