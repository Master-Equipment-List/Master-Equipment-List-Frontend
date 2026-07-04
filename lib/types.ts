// Types mirror the FastAPI Pydantic schemas exposed at /api/v1.

export type ProjectType = "topside" | "marine";
export type ProjectRole = "viewer" | "editor" | "admin";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  code: string | null;
  project_type: ProjectType;
  description: string | null;
  client: string | null;
  facility: string | null;
  location: string | null;
  /** Legacy single-root OneDrive (kept for backward compatibility). The
   *  per-workspace columns below are what the new flow reads. */
  onedrive_drive_id: string | null;
  onedrive_root_item_id: string | null;
  onedrive_root_path: string | null;
  /** Per-workspace OneDrive roots. Topsides and Marine each point at their
   *  own folder so the two workspaces sync independently. */
  topside_onedrive_drive_id?: string | null;
  topside_onedrive_root_item_id?: string | null;
  topside_onedrive_root_path?: string | null;
  marine_onedrive_drive_id?: string | null;
  marine_onedrive_root_item_id?: string | null;
  marine_onedrive_root_path?: string | null;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: ProjectRole;
}

export interface Equipment {
  id: number;
  project_id: number;
  /** "topside" | "marine" — partitions a project's MEL between workspaces. */
  workspace?: "topside" | "marine";
  rev_no: string | null;
  old_tag: string | null;
  client_tag: string;
  description: string | null;
  vendor: string | null;
  equipment_type: string | null;
  module: string | null;
  design_code: string | null;
  orientation: string | null;
  material: string | null;
  configuration: string | null;
  location: string | null;
  operating_press: string | null;
  operating_temp: string | null;
  design_press: string | null;
  design_temp: string | null;
  design_flow: string | null;
  pump_capacity: string | null;
  heat_exchanger_duty_kw: string | null;
  liquid_fill: string | null;
  absorbed_power_kw: string | null;
  rated_power_kw: string | null;
  length_m: string | null;
  width_id_m: string | null;
  height_tt_m: string | null;
  dry_weight_mt: string | null;
  operating_weight_mt: string | null;
  hydrotest_weight_mt: string | null;
  pid: string | null;
  remarks: string | null;
  total_dry_weight_mt: string | null;
  total_operating_weight_mt: string | null;
  /** Marine-MEL lifecycle flag — combination of "NEW", "REFURBISHED",
   *  "SCRAPPED" (or " / "-joined when more than one is marked).
   *  Null when none are marked or the source workbook didn't include
   *  the column set. */
  lifecycle_status: string | null;
  /** Extra fields captured from vendor drawings — separate from
   *  length_m (which holds T/T). Only populated when the drawing
   *  shows an overall length distinct from the T/T value. */
  length_overall_m: string | null;
  /** Minimum Design Metal Temperature in °C. Split from `design_temp`
   *  so the hot-side value can stay cleanly numeric. */
  mdmt_c: string | null;
  /** Hydrostatic test pressure in barg (printed on every ASME VIII
   *  vessel drawing). */
  hydrostatic_test_press_barg: string | null;
  /** Insulation type + thickness as printed (e.g. "40 mm personal
   *  protection", "75 mm mineral wool + SS cladding"). */
  insulation: string | null;
  data: Record<string, unknown>;
  current_version: number;
  last_source: string | null;
  last_source_file_id: number | null;
  last_updated_by_id: number | null;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentVersion {
  id: number;
  equipment_id: number;
  version_no: number;
  snapshot: Record<string, unknown>;
  changed_fields: string[];
  source: string;
  source_file_id: number | null;
  note: string | null;
  created_by_id: number | null;
  created_at: string;
}

export interface EquipmentDiff {
  equipment_id: number;
  from_version: number;
  to_version: number;
  fields: Record<string, { from: unknown; to: unknown }>;
}

export interface ProjectFile {
  id: number;
  project_id: number;
  workspace?: "topside" | "marine";
  name: string;
  onedrive_path: string;
  folder_category: string | null;
  mime_type: string | null;
  extension: string | null;
  size_bytes: number | null;
  onedrive_modified_at: string | null;
  last_synced_at: string | null;
  sync_status: string;
  sync_error: string | null;
}

export interface FileExtraction {
  id: number;
  file_id: number;
  parser: string;
  status: string;
  error: string | null;
  pages: number | null;
  used_ocr: boolean;
  data: Record<string, unknown>;
  created_at: string;
}

export interface DriveItem {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  size: number | null;
  modified_at: string | null;
  mime_type: string | null;
  is_shortcut?: boolean;
  remote_item_id?: string | null;
  remote_drive_id?: string | null;
}

export interface BrowseResponse {
  project_id: number;
  root_path: string | null;
  items: DriveItem[];
}

export interface OneDriveSelection {
  id: number;
  project_id: number;
  item_id: string;
  item_path: string;
  item_type: "file" | "folder";
  name: string;
  size_bytes: number | null;
}

export interface SyncSummary {
  project_id: number;
  force?: boolean;
  files_synced: number;
  files_skipped?: number;
  files_failed: number;
  pfd_updates_applied: number;
  pid_updates_applied?: number;
  /** Count of PFD/Vendor updates skipped because the equipment row was
   *  already P&ID-locked (higher source precedence). */
  pid_locked_skips?: number;
  /** Count of vendor fields the LLM flagged as "low confidence" — the
   *  extractor found a value but couldn't tie it to an explicit label
   *  on the drawing, so it wasn't auto-applied. The reason for each
   *  skip lives in `extraction.data.vendor.evidence[field]`. */
  vendor_low_confidence_skips?: number;
  vendor_updates_applied: number;
  /** New equipment rows auto-created from PFD/Vendor/P&ID syncs (tags not
   *  previously in the project). 0 when only existing rows were updated. */
  equipment_created?: number;
  errors: Array<{ item: string | null; error: string }>;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
