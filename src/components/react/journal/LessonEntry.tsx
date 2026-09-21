import { Check, Search, X } from "lucide-react";
import { STATUS } from "./constants";
import type { JournalLesson, LessonPatch } from "./api";

interface Props {
  lesson: JournalLesson;
  onChange: (patch: LessonPatch) => void;
  onEssayChange: (essay: string) => void;
  onEssayBlur: () => void;
  onPickTopic: () => void;
  onRemove: () => void;
}

const STAMP_KEYS = ["present", "absent", "excused"] as const;

export function LessonEntry({ lesson, onChange, onEssayChange, onEssayBlur, onPickTopic, onRemove }: Props) {
  return (
    <div className="jr-entry">
      <div className="jr-entry-top">
        <input
          type="date"
          className="jr-date-input"
          value={lesson.date}
          required
          onChange={(e) => e.target.value && onChange({ date: e.target.value })}
        />
        <input
          type="time"
          className="jr-time-input"
          value={lesson.time}
          onChange={(e) => onChange({ time: e.target.value })}
        />
        <div className="jr-stamps">
          {STAMP_KEYS.map((key) => (
            <button
              key={key}
              className={"jr-stamp " + (lesson.status === key ? key : "inactive")}
              onClick={() => onChange({ status: key })}
            >
              {lesson.status === key && key === "present" && (
                <Check size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
              )}
              {STATUS[key].label}
            </button>
          ))}
        </div>
        <button className="jr-trash" onClick={onRemove} aria-label="Удалить запись">
          <X size={16} />
        </button>
      </div>

      <span className="jr-field-label">Пройденная тема</span>
      <button className="jr-topic-picker-btn" onClick={onPickTopic}>
        <span className={lesson.topic ? "" : "placeholder"}>
          {lesson.topic || "Выбрать тему из списка…"}
        </span>
        <Search size={14} />
      </button>

      <span className="jr-field-label">Эссе ученика — что понял(а)</span>
      <textarea
        className="jr-essay-input"
        placeholder="Что ученик написал о пройденном материале…"
        value={lesson.essay}
        onChange={(e) => onEssayChange(e.target.value)}
        onBlur={onEssayBlur}
      />
    </div>
  );
}
