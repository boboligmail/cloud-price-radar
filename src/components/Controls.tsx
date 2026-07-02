type Option = readonly [string, string];

export function BudgetRange({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  readonly label: string;
  readonly minValue: string;
  readonly maxValue: string;
  readonly onMinChange: (value: string) => void;
  readonly onMaxChange: (value: string) => void;
}) {
  return (
    <div className="control budgetControl" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="budgetInputs">
        <input value={minValue} inputMode="decimal" placeholder="最低价" aria-label={`${label}最低价`} onChange={(event) => onMinChange(event.target.value)} />
        <span>-</span>
        <input value={maxValue} inputMode="decimal" placeholder="最高价" aria-label={`${label}最高价`} onChange={(event) => onMaxChange(event.target.value)} />
      </div>
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="control selectControl">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
}) {
  const pages = getPageItems(page, pageCount);
  return (
    <nav className="pagination" aria-label="分页">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="上一页">
        ‹
      </button>
      {pages.map((item) =>
        item === "gap" ? (
          <span key={`${page}-${item}`} className="pageGap">
            ...
          </span>
        ) : (
          <button key={item} type="button" className={item === page ? "active" : ""} onClick={() => onPageChange(item)}>
            {item}
          </button>
        ),
      )}
      <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label="下一页">
        ›
      </button>
    </nav>
  );
}

function getPageItems(page: number, pageCount: number): readonly (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const items = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...items].filter((item) => item >= 1 && item <= pageCount).sort((left, right) => left - right);
  const output: (number | "gap")[] = [];
  for (const item of sorted) {
    const previous = output.at(-1);
    if (typeof previous === "number" && item - previous > 1) output.push("gap");
    output.push(item);
  }
  return output;
}
