"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, X } from "lucide-react";

import { Card, CardHeader, ErrorBox, Field, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import type { Equipment } from "@/lib/types";

interface FormState {
  rev_no: string;
  old_tag: string;
  client_tag: string;
  description: string;
  vendor: string;
  equipment_type: string;
  module: string;
  design_code: string;
  orientation: string;
  material: string;
  configuration: string;
  location: string;
  operating_press: string;
  operating_temp: string;
  design_press: string;
  design_temp: string;
  design_flow: string;
  pump_capacity: string;
  heat_exchanger_duty_kw: string;
  liquid_fill: string;
  absorbed_power_kw: string;
  rated_power_kw: string;
  length_m: string;
  width_id_m: string;
  height_tt_m: string;
  dry_weight_mt: string;
  operating_weight_mt: string;
  hydrotest_weight_mt: string;
  pid: string;
  remarks: string;
  total_dry_weight_mt: string;
  total_operating_weight_mt: string;
}

const EMPTY: FormState = {
  rev_no: "", old_tag: "", client_tag: "", description: "", vendor: "",
  equipment_type: "", module: "", design_code: "", orientation: "",
  material: "", configuration: "", location: "",
  operating_press: "", operating_temp: "", design_press: "", design_temp: "",
  design_flow: "", pump_capacity: "", heat_exchanger_duty_kw: "", liquid_fill: "",
  absorbed_power_kw: "", rated_power_kw: "",
  length_m: "", width_id_m: "", height_tt_m: "",
  dry_weight_mt: "", operating_weight_mt: "", hydrotest_weight_mt: "",
  pid: "", remarks: "", total_dry_weight_mt: "", total_operating_weight_mt: "",
};

export default function NewEquipmentPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const router = useRouter();
  const params = useParams();
  const projectId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function input<K extends keyof FormState>(k: K) {
    return {
      value: form[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setField(k, e.target.value as FormState[K]),
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Convert blank strings to null so backend stores them as NULL.
      const payload: Record<string, unknown> = { data: {} };
      for (const [k, v] of Object.entries(form)) {
        const s = (v ?? "").trim();
        payload[k] = s === "" ? null : s;
      }
      // client_tag is required by the schema
      if (!payload.client_tag) {
        throw new Error("Client tag is required");
      }
      const created = await api.post<Equipment>(
        `/projects/${projectId}/equipment`,
        payload,
      );
      router.replace(`/projects/${projectId}/equipment/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <Link className="btn-ghost px-2" href={`/projects/${projectId}/equipment`}>
          <ArrowLeft className="h-4 w-4" /> Back to equipment
        </Link>
      </div>

      <header>
        <h1 className="text-xl font-semibold text-ink-900">Add Equipment</h1>
        <p className="text-sm text-ink-500">
          Manually create a new equipment row in this project&apos;s MEL.
          Only the client tag is required; everything else is optional and can
          be updated later via PFD / Vendor Data sync.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardHeader title="Identification" />
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
            <Field label="Client equipment tag *" hint="e.g. V-S68105">
              <input className="input font-mono" required {...input("client_tag")} />
            </Field>
            <Field label="Old tag">
              <input className="input font-mono" {...input("old_tag")} />
            </Field>
            <Field label="Rev No.">
              <input className="input" {...input("rev_no")} />
            </Field>
            <div className="md:col-span-3">
              <Field label="Description">
                <input className="input" {...input("description")} placeholder="e.g. LP Flare Knock Out Drum" />
              </Field>
            </div>
            <Field label="Vendor">
              <input className="input" {...input("vendor")} placeholder="HEATEC JIETONG, VULCANIC…" />
            </Field>
            <Field label="Equipment type">
              <input className="input" {...input("equipment_type")} placeholder="Pressure Vessel, Pump, Heater…" />
            </Field>
            <Field label="Module">
              <input className="input" {...input("module")} placeholder="MAIN DECK" />
            </Field>
            <Field label="Design code / class">
              <input className="input" {...input("design_code")} placeholder="ASME VIII Div I" />
            </Field>
            <Field label="Orientation">
              <select className="input" {...input("orientation")}>
                <option value="">—</option>
                <option value="Horizontal">Horizontal</option>
                <option value="Vertical">Vertical</option>
              </select>
            </Field>
            <Field label="Configuration" hint="e.g. 1 x 100%, 2 x 100%">
              <input className="input" {...input("configuration")} />
            </Field>
            <div className="md:col-span-3">
              <Field label="Material of construction">
                <input className="input" {...input("material")} placeholder="CS + SS316L Cladding" />
              </Field>
            </div>
            <Field label="Location" hint="Comes from FPSO GA.">
              <input className="input" {...input("location")} placeholder="MAIN DECK" />
            </Field>
            <Field label="P&ID / PFD ref">
              <input className="input font-mono text-xs" {...input("pid")} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Process conditions" subtitle="Operating / Design pressure, temperature, flow & duty." />
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
            <Field label="Operating press (barg)">
              <input className="input" {...input("operating_press")} placeholder="0.1 / 0.5" />
            </Field>
            <Field label="Operating temp (°C)">
              <input className="input" {...input("operating_temp")} placeholder="40" />
            </Field>
            <Field label="Design flow (m³/hr)">
              <input className="input" {...input("design_flow")} />
            </Field>
            <Field label="Design press (barg)">
              <input className="input" {...input("design_press")} placeholder="FV / 7" />
            </Field>
            <Field label="Design temp (°C)">
              <input className="input" {...input("design_temp")} placeholder="-29 / 120" />
            </Field>
            <Field label="Pump / Compressor / Tank capacity">
              <input className="input" {...input("pump_capacity")} placeholder="22 m³/hr" />
            </Field>
            <Field label="Heat exchanger duty (kW)">
              <input className="input" {...input("heat_exchanger_duty_kw")} />
            </Field>
            <Field label="Liquid fill">
              <input className="input" {...input("liquid_fill")} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Vendor-updatable fields"
            subtitle="These are typically updated by Vendor Data sync — fill if known."
          />
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
            <Field label="Absorbed power per unit (kW)">
              <input className="input" {...input("absorbed_power_kw")} />
            </Field>
            <Field label="Rated power per unit (kW)">
              <input className="input" {...input("rated_power_kw")} />
            </Field>
            <div />
            <Field label="L or T/T (m)">
              <input className="input" {...input("length_m")} />
            </Field>
            <Field label="W or I.D (m)">
              <input className="input" {...input("width_id_m")} />
            </Field>
            <Field label="H or T/T (m)">
              <input className="input" {...input("height_tt_m")} />
            </Field>
            <Field label="Dry weight per unit (MT)">
              <input className="input" {...input("dry_weight_mt")} />
            </Field>
            <Field label="Operating weight per unit (MT)">
              <input className="input" {...input("operating_weight_mt")} />
            </Field>
            <Field label="Hydrotest weight per unit (MT)">
              <input className="input" {...input("hydrotest_weight_mt")} />
            </Field>
            <Field label="Total dry weight (MT)">
              <input className="input" {...input("total_dry_weight_mt")} />
            </Field>
            <Field label="Total operating weight (MT)">
              <input className="input" {...input("total_operating_weight_mt")} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Remarks" />
          <div className="p-5">
            <Field label="Remarks">
              <textarea
                className="input min-h-[80px]"
                value={form.remarks}
                onChange={(e) => setField("remarks", e.target.value)}
              />
            </Field>
          </div>
        </Card>

        {error && <ErrorBox error={{ message: error }} />}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.replace(`/projects/${projectId}/equipment`)}
          >
            <X className="h-4 w-4" /> Cancel
          </button>
          <button
            className="btn-primary"
            type="submit"
            disabled={submitting || !form.client_tag.trim()}
          >
            {submitting && <Spinner className="text-white" />}
            <Save className="h-4 w-4" /> Save equipment
          </button>
        </div>
      </form>
    </main>
  );
}
