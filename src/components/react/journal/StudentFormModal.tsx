import { useState } from "react";
import { Modal } from "./Modal";
import { PROGRAMS } from "./constants";
import type { Program, StudentGroup, StudentInput } from "./api";

interface Props {
  initial: StudentInput;
  isEdit: boolean;
  groups: StudentGroup[];
  onSave: (data: StudentInput) => Promise<void>;
  onClose: () => void;
}

export function StudentFormModal({ initial, isEdit, groups, onSave, onClose }: Props) {
  const [form, setForm] = useState<StudentInput>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof StudentInput>(key: K, value: StudentInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ ...form, name: form.name.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "Данные ученика" : "Новый ученик"} onClose={onClose}>
      <div className="jr-form-row">
        <label>Имя и фамилия</label>
        <input
          className="jr-form-input"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Например: Аружан Касымова"
          autoFocus
        />
      </div>

      <div className="jr-form-two">
        <div className="jr-form-row">
          <label>Класс школы</label>
          <input
            className="jr-form-input"
            value={form.schoolClass}
            onChange={(e) => set("schoolClass", e.target.value)}
            placeholder="Например: 9 класс"
          />
        </div>
        <div className="jr-form-row">
          <label>Дата рождения</label>
          <input
            type="date"
            className="jr-form-input"
            value={form.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
          />
        </div>
      </div>

      <div className="jr-form-row">
        <label>Телефон ученика</label>
        <input
          className="jr-form-input"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="+996 ___ __ __ __"
        />
      </div>

      <div className="jr-form-row">
        <label>Телефон родителя</label>
        <input
          className="jr-form-input"
          value={form.parentPhone}
          onChange={(e) => set("parentPhone", e.target.value)}
          placeholder="+996 ___ __ __ __"
        />
      </div>

      <div className="jr-form-row">
        <label>Тип обучения</label>
        <div className="jr-program-options">
          {(Object.entries(PROGRAMS) as [Program, (typeof PROGRAMS)[Program]][]).map(([key, p]) => (
            <div
              key={key}
              className={"jr-program-opt" + (form.program === key ? " selected" : "")}
              onClick={() => set("program", key)}
            >
              <span className="jr-program-opt-title">{p.label}</span>
              <span className="jr-program-opt-detail">{p.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="jr-form-row">
        <label>Группа</label>
        <div className="jr-group-options">
          {groups.map((g) => (
            <div
              key={g.id}
              className={"jr-group-opt" + (form.groupId === g.id ? " selected" : "")}
              onClick={() => set("groupId", g.id)}
            >
              <span className="jr-group-opt-title">{g.label}</span>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="jr-groups-hint">Групп пока нет — добавьте их через «Группы» в сайдбаре.</div>
          )}
        </div>
      </div>

      <div className="jr-modal-actions">
        <button className="jr-btn-secondary" onClick={onClose}>Отмена</button>
        <button className="jr-btn-primary" onClick={submit} disabled={!form.name.trim() || saving}>
          {isEdit ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </Modal>
  );
}
