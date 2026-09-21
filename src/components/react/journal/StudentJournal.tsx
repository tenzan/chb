import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import {
  CalendarClock,
  Cake,
  GraduationCap,
  Pencil,
  Phone,
  Plus,
  Settings,
  Table2,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  journalApi,
  JournalApiError,
  type JournalLesson,
  type JournalStudent,
  type LessonPatch,
  type StudentGroup,
  type StudentInput,
  type TopicCategory,
} from "./api";
import { PROGRAMS, nowHHMM, todayISO, tooltipFor } from "./constants";
import { useDebouncedSave } from "./useDebouncedSave";
import { ConfirmModal } from "./Modal";
import { StudentFormModal } from "./StudentFormModal";
import { ScheduleModal } from "./ScheduleModal";
import { GroupsModal } from "./GroupsModal";
import { OverviewModal } from "./OverviewModal";
import { TopicPickerModal } from "./TopicPickerModal";
import { AttendanceCard } from "./AttendanceCard";
import { LessonEntry } from "./LessonEntry";
import "./journal.css";

type StudentForm = { id: string | null; initial: StudentInput };
type Confirm =
  | { kind: "student"; student: JournalStudent }
  | { kind: "lesson"; studentId: string; lesson: JournalLesson };
type HoverTip = { x: number; y: number; dateLabel: string; topic: string };

const byName = (a: JournalStudent, b: JournalStudent) => a.name.localeCompare(b.name, "ru");
const newestFirst = (a: JournalLesson, b: JournalLesson) =>
  a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date);
const hasContent = (l: JournalLesson) => Boolean(l.topic || l.essay);

export default function StudentJournal() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<JournalStudent[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [library, setLibrary] = useState<TopicCategory[]>([]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [studentForm, setStudentForm] = useState<StudentForm | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [topicPicker, setTopicPicker] = useState<{ studentId: string; lessonId: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null);

  const { schedule, flush } = useDebouncedSave();
  const pendingCreates = useRef(new Set<string>());

  const load = useCallback(async () => {
    const [s, g, t] = await Promise.all([
      journalApi.listStudents(),
      journalApi.listGroups(),
      journalApi.listTopics(),
    ]);
    setStudents(s);
    setGroups(g);
    setLibrary(t);
    setActiveId((id) => (id && s.some((x) => x.id === id) ? id : [...s].sort(byName)[0]?.id ?? null));
  }, []);

  useEffect(() => {
    load()
      .catch(() => setError("Не удалось загрузить журнал. Обновите страницу."))
      .finally(() => setLoading(false));
  }, [load]);

  // Any failed save: tell the user and re-sync with the server so the UI never lies.
  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof JournalApiError && e.status === 401) return;
      console.error("[journal]", e);
      setError("Не удалось сохранить изменения — данные обновлены с сервера.");
      load().catch(() => undefined);
    },
    [load]
  );

  // ---- local state helpers ----
  const updateStudentLocal = (id: string, fn: (s: JournalStudent) => JournalStudent) =>
    setStudents((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));

  const patchLessonLocal = (studentId: string, lessonId: string, patch: LessonPatch) =>
    updateStudentLocal(studentId, (s) => ({
      ...s,
      lessons: s.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
    }));

  const addLessonLocal = (studentId: string, lesson: JournalLesson) =>
    updateStudentLocal(studentId, (s) => ({ ...s, lessons: [lesson, ...s.lessons] }));

  const removeLessonLocal = (studentId: string, lessonId: string) =>
    updateStudentLocal(studentId, (s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) }));

  // ---- derived ----
  const sortedStudents = [...students].sort(byName);
  const filteredStudents =
    groupFilter === "all" ? sortedStudents : sortedStudents.filter((s) => s.groupId === groupFilter);
  const active = students.find((s) => s.id === activeId) ?? null;
  const groupLabel = (id: string | null) => groups.find((g) => g.id === id)?.label;
  const countInGroup = (id: string) => students.filter((s) => s.groupId === id).length;

  // ---- students ----
  function openAddStudent() {
    const groupId = groupFilter !== "all" ? groupFilter : groups[0]?.id ?? null;
    setStudentForm({
      id: null,
      initial: { name: "", schoolClass: "", birthDate: "", phone: "", parentPhone: "", program: "standard", groupId },
    });
  }

  function openEditStudent(s: JournalStudent) {
    const { id, lessons: _lessons, ...initial } = s;
    setStudentForm({ id, initial });
  }

  async function saveStudent(data: StudentInput) {
    try {
      if (studentForm?.id) {
        const updated = await journalApi.updateStudent(studentForm.id, data);
        updateStudentLocal(updated.id, () => updated);
      } else {
        const created = await journalApi.createStudent(data);
        setStudents((prev) => [...prev, created]);
        setActiveId(created.id);
      }
      setStudentForm(null);
    } catch (e) {
      fail(e);
    }
  }

  async function deleteStudent(student: JournalStudent) {
    setConfirmBusy(true);
    try {
      await journalApi.deleteStudent(student.id);
      const rest = students.filter((s) => s.id !== student.id);
      setStudents(rest);
      if (activeId === student.id) setActiveId([...rest].sort(byName)[0]?.id ?? null);
      setConfirm(null);
    } catch (e) {
      setConfirm(null);
      fail(e);
    } finally {
      setConfirmBusy(false);
    }
  }

  // ---- lessons ----
  async function addLesson() {
    if (!active) return;
    try {
      const lesson = await journalApi.createLesson(active.id, {
        date: todayISO(),
        time: nowHHMM(),
        status: "none",
      });
      addLessonLocal(active.id, lesson);
    } catch (e) {
      fail(e);
    }
  }

  function updateLesson(studentId: string, lessonId: string, patch: LessonPatch) {
    patchLessonLocal(studentId, lessonId, patch);
    journalApi.updateLesson(lessonId, patch).catch(fail);
  }

  function changeEssay(studentId: string, lessonId: string, essay: string) {
    patchLessonLocal(studentId, lessonId, { essay });
    schedule(`essay:${lessonId}`, () => journalApi.updateLesson(lessonId, { essay }).catch(fail));
  }

  async function deleteLesson(studentId: string, lessonId: string) {
    flush(`essay:${lessonId}`);
    removeLessonLocal(studentId, lessonId);
    try {
      await journalApi.deleteLesson(lessonId);
    } catch (e) {
      fail(e);
    }
  }

  function requestDeleteLesson(studentId: string, lesson: JournalLesson) {
    if (hasContent(lesson)) setConfirm({ kind: "lesson", studentId, lesson });
    else deleteLesson(studentId, lesson.id);
  }

  // Overview grid: "1" → present, "0" → absent, "" → clear
  async function setAttendanceValue(studentId: string, date: string, raw: string) {
    const v = raw.trim();
    if (v !== "" && v !== "0" && v !== "1") return;
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    const existing = student.lessons.find((l) => l.date === date);

    if (v === "") {
      if (!existing) return;
      // Never silently drop a lesson that has a topic or essay — just clear its mark
      if (hasContent(existing)) updateLesson(studentId, existing.id, { status: "none" });
      else deleteLesson(studentId, existing.id);
      return;
    }

    const status = v === "1" ? "present" : "absent";
    if (existing) {
      updateLesson(studentId, existing.id, { status });
      return;
    }

    const key = `${studentId}:${date}`;
    if (pendingCreates.current.has(key)) return;
    pendingCreates.current.add(key);
    try {
      const lesson = await journalApi.createLesson(studentId, { date, status });
      addLessonLocal(studentId, lesson);
    } catch (e) {
      fail(e);
    } finally {
      pendingCreates.current.delete(key);
    }
  }

  // ---- groups ----
  async function addGroup(label: string) {
    try {
      const group = await journalApi.createGroup(label);
      setGroups((prev) => [...prev, group]);
    } catch (e) {
      fail(e);
    }
  }

  function renameGroup(id: string, label: string) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, label } : g)));
    const trimmed = label.trim();
    if (trimmed) schedule(`group:${id}`, () => journalApi.renameGroup(id, trimmed).catch(fail));
  }

  function renameGroupBlur(id: string) {
    flush(`group:${id}`);
    // An emptied name is not saved; restore the stored one
    if (!groups.find((g) => g.id === id)?.label.trim()) {
      journalApi.listGroups().then(setGroups).catch(fail);
    }
  }

  async function deleteGroup(id: string, force: boolean) {
    try {
      await journalApi.deleteGroup(id, force);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setStudents((prev) => prev.map((s) => (s.groupId === id ? { ...s, groupId: null } : s)));
      if (groupFilter === id) setGroupFilter("all");
    } catch (e) {
      fail(e);
    }
  }

  function jumpToGroup(groupId: string) {
    setGroupFilter(groupId);
    setScheduleOpen(false);
    const first = sortedStudents.find((s) => s.groupId === groupId);
    if (first) setActiveId(first.id);
  }

  // ---- topics ----
  function selectTopic(text: string) {
    if (topicPicker) updateLesson(topicPicker.studentId, topicPicker.lessonId, { topic: text });
    setTopicPicker(null);
  }

  async function addTopic(categoryId: string, text: string) {
    try {
      const topic = await journalApi.createTopic(categoryId, text);
      setLibrary((prev) =>
        prev.map((c) =>
          c.id === categoryId ? { ...c, topics: [...c.topics, { id: topic.id, text: topic.text }] } : c
        )
      );
    } catch (e) {
      // Already in the library — selecting it is still what the user wants
      if (!(e instanceof JournalApiError && e.status === 409)) {
        fail(e);
        return;
      }
    }
    selectTopic(text);
  }

  function removeTopic(topicId: string) {
    setLibrary((prev) => prev.map((c) => ({ ...c, topics: c.topics.filter((t) => t.id !== topicId) })));
    journalApi.deleteTopic(topicId).catch(fail);
  }

  // ---- tooltip ----
  const showTip = useCallback((e: SyntheticEvent<HTMLElement>, lesson: JournalLesson) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverTip({ x: rect.left + rect.width / 2, y: rect.top, ...tooltipFor(lesson) });
  }, []);
  const hideTip = useCallback(() => setHoverTip(null), []);

  if (loading) {
    return (
      <div className="jr-root">
        <div className="jr-loading">Загрузка журнала…</div>
      </div>
    );
  }

  return (
    <div className="jr-root">
      <aside className="jr-sidebar">
        <div className="jr-spine">
          <div className="jr-title">Журнал занятий</div>
          <div className="jr-subtitle">Посещаемость · темы · эссе</div>
        </div>

        <div className="jr-tool-row">
          <button className="jr-tool-btn" onClick={() => setScheduleOpen(true)}>
            <CalendarClock size={13} /> Расписание
          </button>
          <button className="jr-tool-btn" onClick={() => setGroupsOpen(true)}>
            <Settings size={13} /> Группы
          </button>
        </div>
        <button className="jr-overview-btn" onClick={() => setOverviewOpen(true)}>
          <Table2 size={14} /> Общая таблица посещаемости
        </button>

        <div className="jr-group-filters">
          <button
            className={"jr-group-pill" + (groupFilter === "all" ? " active" : "")}
            onClick={() => setGroupFilter("all")}
          >
            Все
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className={"jr-group-pill" + (groupFilter === g.id ? " active" : "")}
              onClick={() => setGroupFilter(g.id)}
              title={g.label}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="jr-student-list">
          {filteredStudents.map((s) => (
            <button
              key={s.id}
              className={"jr-student-btn" + (s.id === activeId ? " active" : "")}
              onClick={() => setActiveId(s.id)}
            >
              <span>
                {s.name}
                <span className="jr-student-sub">
                  <span>{s.schoolClass || "класс не указан"}</span>
                  <span>· {groupLabel(s.groupId) || "без группы"}</span>
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="jr-student-count">{s.lessons.length}</span>
                <span
                  className="jr-del-btn"
                  role="button"
                  aria-label="Удалить ученика"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirm({ kind: "student", student: s });
                  }}
                >
                  <Trash2 size={13} />
                </span>
              </span>
            </button>
          ))}
          {filteredStudents.length === 0 && (
            <div className="jr-empty" style={{ padding: "10px 4px", fontSize: 18 }}>
              {groupFilter === "all" ? "Пока нет учеников" : "В этой группе пока никого нет"}
            </div>
          )}
        </div>
        <button className="jr-add-student-btn" onClick={openAddStudent}>
          <Plus size={15} /> Добавить ученика
        </button>
      </aside>

      <main className="jr-main">
        <div className="jr-holes">
          {Array.from({ length: 10 }).map((_, i) => (
            <div className="jr-hole" key={i} />
          ))}
        </div>
        <div className="jr-margin-line" />
        <div className="jr-main-inner">
          {error && (
            <div className="jr-error" role="alert">
              {error}
              <button onClick={() => setError(null)} aria-label="Скрыть">
                <X size={14} />
              </button>
            </div>
          )}

          {!active ? (
            <div className="jr-empty">Выберите или добавьте ученика слева ←</div>
          ) : (
            <>
              <div className="jr-main-header">
                <div className="jr-student-name-row">
                  <div className="jr-student-name">{active.name}</div>
                  <button
                    className="jr-edit-btn"
                    onClick={() => openEditStudent(active)}
                    aria-label="Редактировать данные"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <button className="jr-add-lesson" onClick={addLesson}>
                  <Plus size={15} /> Добавить занятие
                </button>
              </div>

              <div className="jr-profile-card">
                <span className="jr-chip"><GraduationCap size={13} /> {active.schoolClass || "класс не указан"}</span>
                <span className="jr-chip"><Cake size={13} /> {active.birthDate || "дата рождения не указана"}</span>
                <span className="jr-chip"><Phone size={13} /> {active.phone || "телефон не указан"}</span>
                <span className="jr-chip"><Phone size={13} /> Родитель: {active.parentPhone || "не указан"}</span>
                <span className={"jr-chip program-" + active.program}>
                  <Zap size={13} /> {PROGRAMS[active.program].label} · {PROGRAMS[active.program].detail}
                </span>
                <span className="jr-chip group-chip">
                  <CalendarClock size={13} /> {groupLabel(active.groupId) || "без группы"}
                </span>
              </div>

              <AttendanceCard lessons={active.lessons} showTip={showTip} hideTip={hideTip} />

              {active.lessons.length === 0 && (
                <div className="jr-empty">Ещё нет записей о занятиях. Нажмите «Добавить занятие».</div>
              )}

              {[...active.lessons].sort(newestFirst).map((l) => (
                <LessonEntry
                  key={l.id}
                  lesson={l}
                  onChange={(patch) => updateLesson(active.id, l.id, patch)}
                  onEssayChange={(essay) => changeEssay(active.id, l.id, essay)}
                  onEssayBlur={() => flush(`essay:${l.id}`)}
                  onPickTopic={() => setTopicPicker({ studentId: active.id, lessonId: l.id })}
                  onRemove={() => requestDeleteLesson(active.id, l)}
                />
              ))}
            </>
          )}
        </div>
      </main>

      {studentForm && (
        <StudentFormModal
          initial={studentForm.initial}
          isEdit={studentForm.id !== null}
          groups={groups}
          onSave={saveStudent}
          onClose={() => setStudentForm(null)}
        />
      )}

      {scheduleOpen && (
        <ScheduleModal
          groups={groups}
          countInGroup={countInGroup}
          onJumpToGroup={jumpToGroup}
          onClose={() => setScheduleOpen(false)}
        />
      )}

      {groupsOpen && (
        <GroupsModal
          groups={groups}
          countInGroup={countInGroup}
          onAdd={addGroup}
          onRename={renameGroup}
          onRenameBlur={renameGroupBlur}
          onDelete={deleteGroup}
          onClose={() => {
            flush();
            setGroupsOpen(false);
          }}
        />
      )}

      {overviewOpen && (
        <OverviewModal
          students={sortedStudents}
          extraDates={extraDates}
          onAddDate={(d) => setExtraDates((prev) => (prev.includes(d) ? prev : [...prev, d]))}
          onSetValue={setAttendanceValue}
          onOpenStudent={(id) => {
            setActiveId(id);
            setOverviewOpen(false);
          }}
          showTip={showTip}
          hideTip={hideTip}
          onClose={() => setOverviewOpen(false)}
        />
      )}

      {topicPicker && (
        <TopicPickerModal
          library={library}
          onSelect={selectTopic}
          onAddTopic={addTopic}
          onRemoveTopic={removeTopic}
          onClose={() => setTopicPicker(null)}
        />
      )}

      {confirm?.kind === "student" && (
        <ConfirmModal
          title="Удалить ученика?"
          message={
            <>
              <b>{confirm.student.name}</b> и все его занятия ({confirm.student.lessons.length}) будут удалены
              без возможности восстановления.
            </>
          }
          confirmLabel="Удалить"
          busy={confirmBusy}
          onConfirm={() => deleteStudent(confirm.student)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.kind === "lesson" && (
        <ConfirmModal
          title="Удалить занятие?"
          message={
            <>
              Занятие от <b>{confirm.lesson.date}</b> содержит тему или эссе. Удалить его?
            </>
          }
          confirmLabel="Удалить"
          onConfirm={() => {
            deleteLesson(confirm.studentId, confirm.lesson.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {hoverTip && (
        <div className="jr-fixed-tooltip" style={{ left: hoverTip.x, top: hoverTip.y }}>
          <span className="jr-att-tooltip-date">{hoverTip.dateLabel}</span>
          {hoverTip.topic}
        </div>
      )}
    </div>
  );
}
