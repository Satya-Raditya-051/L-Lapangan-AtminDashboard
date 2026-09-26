// src/types/database.ts
export type Pekerjaan = {
  id: string
  judul_pekerjaan: string
  deskripsi: string | null
  lokasi: string
  status_terkini: string
  created_at: string
  target_latitude: number | null
  target_longitude: number | null
  petugas_id: string | null
  updated_at: string | null
}

export type ProgresPekerjaan = {
  id: string
  pekerjaan_id: string
  status_progress: string
  catatan_petugas: string | null
  foto_bukti_url: string | null
  created_at: string
  longitude: number | null
  latitude: number | null
  nama_petugas: string | null
}

export type Petugas = {
  id: string
  created_at: string
  nama_petugas: string | null
  role: string | null
  is_active: boolean
}