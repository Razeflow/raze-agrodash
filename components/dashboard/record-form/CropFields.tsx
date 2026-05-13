"use client";

import type { RecordFormInput } from "@/lib/validations";
import { RECORD_LIMITS } from "@/lib/validations";
import { FieldError, FieldLabel, inputCls, inputErrCls } from "./Field";
import { cropBagsToMetricTons } from "@/lib/domain/units";

export default function CropFields({
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
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Planting Area (hectares)</FieldLabel>
          <input
            type="number"
            min={0}
            max={RECORD_LIMITS.AREA_MAX}
            step="0.01"
            disabled={locked}
            className={errors.planting_area_hectares ? inputErrCls : inputCls}
            value={form.planting_area_hectares || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, planting_area_hectares: parseFloat(e.target.value) || 0 }))
            }
          />
          <FieldError message={errors.planting_area_hectares} />
        </div>
        <div>
          <FieldLabel>Harvest Output (bags @ 40kg)</FieldLabel>
          <input
            type="number"
            min={0}
            max={RECORD_LIMITS.BAGS_MAX}
            step="0.01"
            disabled={locked}
            className={errors.harvesting_output_bags ? inputErrCls : inputCls}
            value={form.harvesting_output_bags || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, harvesting_output_bags: parseFloat(e.target.value) || 0 }))
            }
          />
          <p className="mt-1 text-[10px] text-slate-400">
            ≈ {cropBagsToMetricTons(form.harvesting_output_bags || 0).toLocaleString()} MT
          </p>
          <FieldError message={errors.harvesting_output_bags} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Damage — Pests & Diseases (ha)</FieldLabel>
          <input
            type="number"
            min={0}
            max={RECORD_LIMITS.AREA_MAX}
            step="0.01"
            disabled={locked}
            className={errors.damage_pests_hectares ? inputErrCls : inputCls}
            value={form.damage_pests_hectares || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, damage_pests_hectares: parseFloat(e.target.value) || 0 }))
            }
          />
          <FieldError message={errors.damage_pests_hectares} />
        </div>
        <div>
          <FieldLabel>Damage — Calamity (ha)</FieldLabel>
          <input
            type="number"
            min={0}
            max={RECORD_LIMITS.AREA_MAX}
            step="0.01"
            disabled={locked}
            className={errors.damage_calamity_hectares ? inputErrCls : inputCls}
            value={form.damage_calamity_hectares || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, damage_calamity_hectares: parseFloat(e.target.value) || 0 }))
            }
          />
          <FieldError message={errors.damage_calamity_hectares} />
        </div>
      </div>
    </>
  );
}

