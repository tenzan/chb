import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import type { StudentGroup } from "./api";

interface Props {
  groups: StudentGroup[];
  countInGroup: (groupId: string) => number;
  onAdd: (label: string) => Promise<void>;
  onRename: (id: string, label: string) => void;
  onRenameBlur: (id: string) => void;
  onDelete: (id: string, force: boolean) => Promise<void>;
  onClose: () => void;
}

export function GroupsModal({ groups, countInGroup, onAdd, onRename, onRenameBlur, onDelete, onClose }: Props) {
  const [newName, setNewName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function add() {
    const label = newName.trim();
    if (!label) return;
    await onAdd(label);
    setNewName("");
  }

  async function remove(id: string) {
    // Groups with students need an explicit second click
    if (countInGroup(id) > 0 && confirmId !== id) {
      setConfirmId(id);
      return;
    }
    await onDelete(id, confirmId === id);
    setConfirmId(null);
  }

  return (
    <Modal title="Группы" onClose={onClose}>
      <div className="jr-groups-list">
        {groups.map((g) => (
          <div key={g.id}>
            <div className="jr-groups-row">
              <input
                value={g.label}
                onChange={(e) => onRename(g.id, e.target.value)}
                onBlur={() => onRenameBlur(g.id)}
              />
              <span className="jr-groups-count">{countInGroup(g.id)} уч.</span>
              <button className="jr-trash" onClick={() => remove(g.id)} aria-label="Удалить группу">
                <Trash2 size={15} />
              </button>
            </div>
            {confirmId === g.id && (
              <div className="jr-groups-warning">
                В группе {countInGroup(g.id)} уч. — они останутся без группы.
                <button onClick={() => remove(g.id)}>Удалить</button>
                <button className="secondary" onClick={() => setConfirmId(null)}>Отмена</button>
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && (
          <div className="jr-empty" style={{ fontSize: 18, padding: "10px 0" }}>Групп пока нет</div>
        )}
      </div>

      <div className="jr-groups-add-row">
        <input
          className="jr-form-input"
          placeholder="Название новой группы"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="jr-btn-primary" onClick={add} disabled={!newName.trim()}>Добавить</button>
      </div>

      <div className="jr-groups-hint">
        Группы 1–6 привязаны ко времени в расписании (Пн/Ср/Пт и Вт/Чт). Новые группы сверх этих
        шести появятся в списке и фильтрах, но для них нужно будет отдельно задать время в расписании.
      </div>

      <div className="jr-modal-actions">
        <button className="jr-btn-secondary" onClick={onClose}>Готово</button>
      </div>
    </Modal>
  );
}
