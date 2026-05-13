"use client";

import type { RecordFormInput } from "@/lib/validations";
import { RECORD_LIMITS } from "@/lib/validations";
import { FieldError, FieldLabel, inputCls, inputErrCls } from "./Field";

export default function LivestockFields({
  form,
  setForm,
  errors,
  locked,
}: {
  form: RecordFormInput;
  setForm: React.Dispatch<React.SetStateAction<RecordFormInput>>;
  errors: Record<string, string | undefined>;
  locked: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <FieldLabel>Stocking (heads)</FieldLabel>
        <input
          type="number"
          min={0}
          max={RECORD_LIMITS.STOCKING_MAX}
          step="0.01"
          disabled={locked}
          className={errors.livestock_stocking_heads ? inputErrCls : inputCls}
          value={form.livestock_stocking_heads || ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, livestock_stocking_heads: parseFloat(e.target.value) || 0 }))
          }
        />
        <FieldError message={errors.livestock_stocking_heads} />
      </div>
      <div>
        <FieldLabel>Output (heads)</FieldLabel>
        <input
          type="number"
          min={0}
          max={RECORD_LIMITS.BAGS_MAX}
          step="0.01"
          disabled={locked}
          className={errors.livestock_output_heads ? inputErrCls : inputCls}
          value={form.livestock_output_heads || ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, livestock_output_heads: parseFloat(e.target.value) || 0 }))
          }
        />
        <FieldError message={errors.livestock_output_heads} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Dead (heads)</FieldLabel>
        <input
          type="number"
          min={0}
          max={RECORD_LIMITS.BAGS_MAX}
          step="0.01"
          disabled={locked}
          className={errors.livestock_dead_heads ? inputErrCls : inputCls}
          value={form.livestock_dead_heads || ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, livestock_dead_heads: parseFloat(e.target.value) || 0 }))
          }
        />
        <FieldError message={errors.livestock_dead_heads} />
      </div>
    </div>
  );
}

