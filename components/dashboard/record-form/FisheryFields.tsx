"use client";

import type { RecordFormInput } from "@/lib/validations";
import { RECORD_LIMITS } from "@/lib/validations";
import { FieldError, FieldLabel, inputCls, inputErrCls } from "./Field";

export default function FisheryFields({
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
        <FieldLabel>Fish stocked (count)</FieldLabel>
        <input
          type="number"
          min={0}
          max={RECORD_LIMITS.STOCKING_MAX}
          step="0.01"
          disabled={locked}
          className={errors.stocking ? inputErrCls : inputCls}
          value={form.stocking || ""}
          onChange={(e) => setForm((f) => ({ ...f, stocking: parseFloat(e.target.value) || 0 }))}
        />
        <FieldError message={errors.stocking} />
      </div>
      <div>
        <FieldLabel>Harvest (fish)</FieldLabel>
        <input
          type="number"
          min={0}
          max={RECORD_LIMITS.FISHERY_HARVEST_MAX}
          step="0.01"
          disabled={locked}
          className={errors.harvesting_fishery ? inputErrCls : inputCls}
          value={form.harvesting_fishery || ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, harvesting_fishery: parseFloat(e.target.value) || 0 }))
          }
        />
        <FieldError message={errors.harvesting_fishery} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Loss (fish)</FieldLabel>
        <input
          type="number"
          min={0}
          max={RECORD_LIMITS.FISHERY_HARVEST_MAX}
          step="0.01"
          disabled={locked}
          className={errors.fishery_loss_pieces ? inputErrCls : inputCls}
          value={form.fishery_loss_pieces || ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, fishery_loss_pieces: parseFloat(e.target.value) || 0 }))
          }
        />
        <FieldError message={errors.fishery_loss_pieces} />
      </div>
    </div>
  );
}

