import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Briefcase } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(''); // Kosongkan error sebelumnya (jika ada state error)

    try {
      // Proses Autentikasi Standar Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      // Ambil ID User yang baru saja berhasil login sementara
      const userId = authData.user?.id;
      if (!userId) throw new Error('Terjadi kesalahan sistem. ID tidak ditemukan.');

      // Cek Role dan Status Aktif di tabel 'petugas'
      const { data: profileData, error: profileError } = await supabase
        .from('petugas')
        .select('role, is_active')
        .eq('id', userId)
        .single();

      if (profileError) {
        await supabase.auth.signOut(); // Tendang keluar jika data tidak ada
        throw new Error('Data profil tidak ditemukan di database.');
      }

      // Validasi Hak Akses (Harus Admin)
      if (profileData.role !== 'admin') {
        await supabase.auth.signOut(); // Tendang teknisi keluar dari sesi
        throw new Error('Akses Ditolak: Hanya Administrator yang diizinkan masuk ke Dashboard.');
      }

      // Validasi Status Akun (Soft-Delete)
      if (profileData.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('Akun Anda telah dinonaktifkan oleh sistem.');
      }

      // Arahkan ke halaman Dashboard kalau mencapai parameter atmin
      navigate('/dashboard', { replace: true });

    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'email atau password salah, atau akun tidak terdaftar';
      console.error('Login Error:', errMessage);
      setError(errMessage);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-[#06a0e5] rounded-xl flex items-center justify-center text-white mb-4">
            <Briefcase size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Login Page</h1>
          <p className="text-sm text-gray-500 mt-1">Masuk dengan akun administrator</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="admin@fieldops.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#06a0e5] hover:bg-[#007cb5] text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}