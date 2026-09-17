import { useEffect, useMemo, useRef, useState } from 'react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function DateTimeRangeField(props: {
  startDate: string;
  endDate: string;
  startHour?: number;
  endHour?: number;
  onChange(next: { startDate: string; endDate: string; startHour: number; endHour: number }): void;
}) {
  const startHour = props.startHour ?? 0;
  const endHour = props.endHour ?? 23;
  return (
    <div className="custom-date-range">
      <DateTimeField
        label="开始日期"
        date={props.startDate}
        hour={startHour}
        endBoundary={false}
        onChange={(date, hour) =>
          props.onChange({
            startDate: date,
            endDate: props.endDate,
            startHour: hour,
            endHour,
          })
        }
      />
      <DateTimeField
        label="结束日期"
        date={props.endDate}
        hour={endHour}
        endBoundary
        onChange={(date, hour) =>
          props.onChange({
            startDate: props.startDate,
            endDate: date,
            startHour,
            endHour: hour,
          })
        }
      />
    </div>
  );
}

function DateTimeField(props: {
  label: string;
  date: string;
  hour: number;
  endBoundary: boolean;
  onChange(date: string, hour: number): void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLLabelElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);
  return (
    <label className="datetime-field" ref={rootRef}>
      {props.label}
      <div className="datetime-field-controls">
        <button
          type="button"
          className="datetime-date-trigger"
          onClick={() => setOpen((value) => !value)}
        >
          {props.date ? formatChineseDate(props.date) : '选择日期'}
        </button>
        <select
          className="datetime-hour-select"
          aria-label={`${props.label}小时`}
          value={String(props.hour)}
          onChange={(event) => props.onChange(props.date, Number(event.target.value))}
        >
          {HOURS.map((hour) => (
            <option value={hour} key={hour}>
              {props.endBoundary && hour === 23
                ? '23:59:59'
                : `${String(hour).padStart(2, '0')}:00`}
            </option>
          ))}
        </select>
      </div>
      {open && (
        <ChineseCalendar
          value={props.date}
          onSelect={(date) => {
            props.onChange(date, props.hour);
            setOpen(false);
          }}
        />
      )}
    </label>
  );
}

function ChineseCalendar(props: { value: string; onSelect(date: string): void }) {
  const selected = parseIsoDate(props.value) ?? new Date();
  const [cursor, setCursor] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const cells = useMemo(() => monthCells(cursor), [cursor]);
  return (
    <div className="chinese-calendar" role="dialog" aria-label="选择日期">
      <header>
        <strong>
          {cursor.getFullYear()}年{cursor.getMonth() + 1}月
        </strong>
        <span>
          <button
            type="button"
            aria-label="上一月"
            onClick={() => setCursor(shiftMonth(cursor, -1))}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="下一月"
            onClick={() => setCursor(shiftMonth(cursor, 1))}
          >
            ↓
          </button>
        </span>
      </header>
      <div className="chinese-calendar-week">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="chinese-calendar-grid">
        {cells.map((cell) => (
          <button
            type="button"
            key={cell.iso}
            className={
              cell.iso === props.value ? 'is-selected' : cell.current ? undefined : 'is-muted'
            }
            onClick={() => props.onSelect(cell.iso)}
          >
            {cell.day}
          </button>
        ))}
      </div>
      <footer>
        <button type="button" onClick={() => props.onSelect('')}>
          清除
        </button>
        <button type="button" onClick={() => props.onSelect(toIsoDate(new Date()))}>
          今天
        </button>
      </footer>
    </div>
  );
}

function monthCells(cursor: Date) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const weekday = start.getDay();
  const first = new Date(start);
  first.setDate(1 - weekday);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return {
      iso: toIsoDate(date),
      day: date.getDate(),
      current: date.getMonth() === cursor.getMonth(),
    };
  });
}

function shiftMonth(value: Date, delta: number) {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1);
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatChineseDate(value: string) {
  const date = parseIsoDate(value);
  if (!date) return value;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
