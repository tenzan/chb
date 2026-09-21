-- Student journal: groups, student profiles, lessons, topic library.
-- Journal students are regular users with the Student role. Journal-specific
-- fields live in student_profiles (1:1 with users).

CREATE TABLE student_groups (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  schedule_slot INTEGER UNIQUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE student_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  school_class TEXT,
  parent_phone TEXT,
  program TEXT NOT NULL DEFAULT 'standard' CHECK(program IN ('standard', 'intensive')),
  group_id TEXT REFERENCES student_groups(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_student_profiles_group_id ON student_profiles(group_id);

CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'none' CHECK(status IN ('present', 'absent', 'excused', 'none')),
  topic TEXT NOT NULL DEFAULT '',
  essay TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_lessons_student_date ON lessons(student_id, date);

CREATE TABLE topic_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES topic_categories(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(category_id, text)
);

CREATE INDEX idx_topics_category_id ON topics(category_id);

-- Seed: the six groups bound to the fixed timetable (slots 1-6)
INSERT INTO student_groups (id, label, schedule_slot, position)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       v.column1, v.column2, v.column2
FROM (VALUES
  ('1-я группа', 1),
  ('2-я группа', 2),
  ('3-я группа', 3),
  ('4-я группа', 4),
  ('5-я группа', 5),
  ('6-я группа', 6)
) v;

-- Seed: topic library
INSERT INTO topic_categories (id, name, position)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       v.column1, v.column2
FROM (VALUES
  ('Основы математики', 1),
  ('Геометрия и повторение', 2),
  ('Отрицательные числа (6 класс)', 3)
) v;

INSERT INTO topics (id, category_id, text, position)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       c.id, v.column1, v.column2
FROM (VALUES
  ('Что такое математика. Натуральные числа, простые числа.', 1),
  ('Чтение и запись чисел. Разряды и классы', 2),
  ('Сравнение чисел', 3),
  ('Сложение и вычитание чисел', 4),
  ('Свойства сложения и вычитания', 5),
  ('Умножение натуральных чисел в столбик (2 на 2, 3 на 3)', 6),
  ('Свойства умножения', 7),
  ('Деление натуральных чисел', 8),
  ('Понятие дроби и их виды', 9),
  ('Сложение и вычитание дробей с одинаковыми знаменателями', 10),
  ('Сложение и вычитание дробей с разными знаменателями', 11),
  ('Умножение и деление дробей', 12),
  ('Смешанные дроби (превращать в обыкновенную и обратно)', 13),
  ('Сложение и вычитание смешанных дробей', 14),
  ('Умножение и деление смешанных дробей', 15),
  ('Сокращение дробей', 16),
  ('Десятичные дроби', 17),
  ('Сложение и вычитание десятичных дробей', 18),
  ('Умножение десятичных дробей', 19),
  ('Деление десятичных дробей', 20),
  ('Сравнение дробей', 21),
  ('Задачи в несколько действий', 22),
  ('Скобки, раскрывать скобки с знаком минус', 23),
  ('Скобки раскрывать скобки с умножением', 24),
  ('Порядок выполнения действий', 25),
  ('Уравнение 5 кл', 26),
  ('Уравнение 6кл', 27),
  ('Уравнение 7 кл', 28),
  ('величины', 29),
  ('Величины: длина, масса, время', 30),
  ('Единицы измерения и преобразования', 31)
) v
JOIN topic_categories c ON c.name = 'Основы математики';

INSERT INTO topics (id, category_id, text, position)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       c.id, v.column1, v.column2
FROM (VALUES
  ('Точка, прямая, луч, отрезок', 1),
  ('Углы: виды, измерение', 2),
  ('Треугольник и их виды', 3),
  ('Периметр треугольника', 4),
  ('Площадь треугольника', 5),
  ('Четырёхугольник и их виды', 6),
  ('Периметр четырёхугольника', 7),
  ('Площадь четырёхугольника', 8),
  ('Многоугольники', 9),
  ('Периметр фигур', 10),
  ('Итоговое повторение', 11)
) v
JOIN topic_categories c ON c.name = 'Геометрия и повторение';

INSERT INTO topics (id, category_id, text, position)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       c.id, v.column1, v.column2
FROM (VALUES
  ('Положительные и отрицательные числа', 1),
  ('Координатная прямая', 2),
  ('Сравнение целых чисел', 3),
  ('Сложение целых чисел', 4),
  ('Вычитание целых чисел', 5),
  ('Модуль числа', 6),
  ('Алгебраические элементы', 7),
  ('Выражения и числовые значения', 8),
  ('Буквенные выражения', 9),
  ('Формулы', 10),
  ('Уравнения', 11),
  ('Решение уравнений', 12),
  ('Текстовые задачи с уравнениями', 13),
  ('Геометрия и проценты', 14),
  ('Треугольники и их виды', 15),
  ('Многоугольники', 16),
  ('Площадь фигур', 17),
  ('Окружность и круг', 18),
  ('Проценты (нахождение процента от числа)', 19),
  ('Итоговое повторение', 20)
) v
JOIN topic_categories c ON c.name = 'Отрицательные числа (6 класс)';
