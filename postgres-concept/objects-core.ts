/**
 * Slim core object row. Table: objects_core.
 *
 * No embedded arrays. All updates and votes live in separate tables.
 * seq is incremented on every mutation; used for change tracking.
 */

export interface ObjectCoreRow {
  object_id: string;
  object_type: string;
  creator: string;
  weight: number | null;
  meta_group_id: string | null;
  seq: number;
}
