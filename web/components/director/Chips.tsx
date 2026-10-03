import s from "./director.module.css";

type ChipsProps<T extends string> = {
  options: readonly T[];
  isOn: (option: T) => boolean;
  onToggle: (option: T) => void;
  label?: string;
};

export function Chips<T extends string>({ options, isOn, onToggle, label }: ChipsProps<T>) {
  return (
    <div className={s.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={isOn(o)}
          className={`${s.chip} ${isOn(o) ? s.chipOn : ""}`}
          onClick={() => onToggle(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
