import { useState } from "react";
import { Coffee } from "lucide-react";
import { Modal } from "./Modal";
import { SCHEDULES } from "./constants";
import type { StudentGroup } from "./api";

interface Props {
  groups: StudentGroup[];
  countInGroup: (groupId: string) => number;
  onJumpToGroup: (groupId: string) => void;
  onClose: () => void;
}

export function ScheduleModal({ groups, countInGroup, onJumpToGroup, onClose }: Props) {
  const [tab, setTab] = useState<keyof typeof SCHEDULES>("mwf");
  const groupBySlot = (slot: number) => groups.find((g) => g.scheduleSlot === slot);

  return (
    <Modal title="Расписание дня" onClose={onClose} maxWidth={420}>
      <div className="jr-schedule-tabs">
        {(Object.keys(SCHEDULES) as (keyof typeof SCHEDULES)[]).map((key) => (
          <button
            key={key}
            className={"jr-schedule-tab" + (tab === key ? " active" : "")}
            onClick={() => setTab(key)}
          >
            {SCHEDULES[key].label}
          </button>
        ))}
      </div>
      <table className="jr-schedule-table">
        <tbody>
          {SCHEDULES[tab].rows.map((row, i) => {
            const group = row.type === "group" ? groupBySlot(row.slot) : undefined;
            return (
              <tr key={i} className={"type-" + row.type}>
                <td className="jr-schedule-time">{row.time}</td>
                <td>
                  {row.type === "group" ? (
                    <button
                      className="jr-schedule-row-btn"
                      onClick={() => group && onJumpToGroup(group.id)}
                      disabled={!group}
                    >
                      {group?.label || "Группа удалена"}
                      {group && <span className="jr-schedule-count">{countInGroup(group.id)} уч.</span>}
                    </button>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px" }}>
                      <Coffee size={13} /> {row.label}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="jr-modal-actions">
        <button className="jr-btn-secondary" onClick={onClose}>Закрыть</button>
      </div>
    </Modal>
  );
}
