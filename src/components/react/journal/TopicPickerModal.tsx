import { useState } from "react";
import { BookOpen, Plus, Search, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import type { TopicCategory } from "./api";

interface Props {
  library: TopicCategory[];
  onSelect: (text: string) => void;
  onAddTopic: (categoryId: string, text: string) => Promise<void>;
  onRemoveTopic: (topicId: string) => void;
  onClose: () => void;
}

export function TopicPickerModal({ library, onSelect, onAddTopic, onRemoveTopic, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [newText, setNewText] = useState("");
  const [categoryId, setCategoryId] = useState(library[0]?.id ?? "");
  const [adding, setAdding] = useState(false);

  const needle = search.trim().toLowerCase();
  const visible = library
    .map((c) => ({
      ...c,
      filtered: needle ? c.topics.filter((t) => t.text.toLowerCase().includes(needle)) : c.topics,
    }))
    .filter((c) => c.filtered.length > 0 || !needle);

  async function add() {
    const text = newText.trim();
    if (!text || !categoryId || adding) return;
    setAdding(true);
    try {
      await onAddTopic(categoryId, text);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal
      title={
        <>
          <BookOpen size={22} style={{ verticalAlign: -3, marginRight: 6 }} />
          Выбор темы
        </>
      }
      onClose={onClose}
      maxWidth={440}
    >
      <div className="jr-topic-search">
        <Search size={15} />
        <input
          autoFocus
          placeholder="Поиск темы…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="jr-topic-list">
        {visible.length === 0 && (
          <div className="jr-topic-empty">Ничего не найдено — можно добавить новую тему ниже.</div>
        )}
        {visible.map((c) => (
          <div key={c.id}>
            <div className="jr-topic-cat-header">{c.name}</div>
            {c.filtered.map((t) => (
              <div className="jr-topic-row" key={t.id} onClick={() => onSelect(t.text)}>
                <span>{t.text}</span>
                <span
                  className="jr-trash"
                  role="button"
                  aria-label="Удалить тему из списка"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTopic(t.id);
                  }}
                >
                  <Trash2 size={13} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="jr-topic-add-row">
        <span className="jr-field-label">Добавить новую тему в список</span>
        <div className="jr-topic-add-inputs">
          <input
            className="jr-form-input"
            placeholder="Название темы"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <select
            className="jr-form-select"
            style={{ maxWidth: 160 }}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {library.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          className="jr-btn-primary"
          style={{ alignSelf: "flex-end" }}
          disabled={!newText.trim() || !categoryId || adding}
          onClick={add}
        >
          <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
          Добавить и выбрать
        </button>
      </div>

      <div className="jr-modal-actions">
        <button className="jr-btn-secondary" onClick={onClose}>Закрыть</button>
      </div>
    </Modal>
  );
}
