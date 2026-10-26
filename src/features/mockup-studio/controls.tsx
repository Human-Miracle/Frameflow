'use client';

import { useId, type ReactNode } from 'react';
import styles from './MockupStudio.module.css';

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <h2 id={id} className={styles.panelTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function RangeField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <div className={styles.fieldRow}>
        <label htmlFor={id}>{props.label}</label>
        <output htmlFor={id} className={styles.fieldValue}>
          {props.format(props.value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        aria-valuetext={props.format(props.value)}
        onChange={(event) => props.onChange(Number(event.target.value))}
        className={styles.range}
      />
    </div>
  );
}

export function OptionGroup<T extends string>(props: {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
  layout?: 'stack' | 'segmented';
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className="visually-hidden">{props.legend}</legend>
      <div className={props.layout === 'segmented' ? styles.segmented : styles.optionStack}>
        {props.options.map((option) => (
          <label key={option.value} className={styles.option} data-checked={option.value === props.value}>
            <input
              type="radio"
              name={props.name}
              value={option.value}
              checked={option.value === props.value}
              onChange={() => props.onChange(option.value)}
              className="visually-hidden"
            />
            <span className={styles.optionLabel}>{option.label}</span>
            {option.description && <span className={styles.optionDescription}>{option.description}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
