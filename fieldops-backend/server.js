import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load variabel dari .env
dotenv.config();

const app = express();

// Middleware
app.use(cors()); // Mengizinkan frontend React mengakses API ini
app.use(express.json()); // Membaca body request berbentuk JSON

// Inisialisasi Supabase Admin (Bisa menembus RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Route untuk mengecek status server
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Server berjalan dengan baik!' });
});

// Route utama untuk membuat petugas
app.post('/api/create-petugas', async (req, res) => {
  const { email, password, nama_petugas, role } = req.body;
  const adminToken = req.headers.authorization;
  console.log(`[INFO] Menerima request pembuatan petugas untuk: ${req.body.email}`);

  if (!adminToken) {
    return res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
  }

  try {
    // 1. Validasi Token Admin
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(adminToken);
    if (authErr || !user) throw new Error('Token tidak valid');

    // Cek apakah user yang hit API ini benar-benar Admin di tabel petugas (Opsional tapi direkomendasikan)
    const { data: adminData } = await supabaseAdmin
      .from('petugas')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (adminData?.role !== 'admin') {
      throw new Error('Hanya admin yang boleh membuat akun baru');
    }

    // 2. Buat akun di Supabase Auth
    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true 
    });

    if (createErr) throw createErr;

    // 3. Masukkan biodata ke tabel petugas
    const { error: dbErr } = await supabaseAdmin.from('petugas').insert([{
      id: authData.user.id,
      nama_petugas: nama_petugas,
      role: role,
      is_active: true
    }]);

    if (dbErr) {
      // Rollback (Hapus akun auth jika gagal masuk tabel)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw dbErr;
    }

    res.status(201).json({ message: 'Petugas berhasil ditambahkan!' });

  } catch (error) {
    console.error(`[ERROR] Gagal membuat petugas:`, error.message);
    res.status(400).json({ error: error.message });
  }
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend API berjalan di http://localhost:${PORT}`);
});