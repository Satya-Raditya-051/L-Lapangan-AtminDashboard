import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Edit2, Plus, UserCheck, UserX, X, Search } from 'lucide-react';

interface Petugas {
  id: string;
  nama_petugas: string | null;
  role: 'admin' | 'teknisi';
  is_active: boolean;
  created_at: string;
}

export default function Petugas() {
  const [petugasList, setPetugasList] = useState<Petugas[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- STATE FILTER & SORT ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = Terbaru, 'asc' = Terlama

  // --- STATE MODAL EDIT ---
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editData, setEditData] = useState<Petugas | null>(null);

  // --- STATE MODAL TAMBAH (CREATE) ---
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addFormData, setAddFormData] = useState({
    email: '',
    password: '',
    nama_petugas: '',
    role: 'teknisi'
  });

  // --- FUNGSI AMBIL DATA ---
  const fetchPetugas = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('petugas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setPetugasList(data as Petugas[]);
    } catch (error) {
      console.error('Error fetching petugas:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPetugas();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchPetugas]);

  // --- LOGIKA FILTER & SORTING ---
  const filteredPetugas = petugasList.filter((petugas) => {
    // 1. Filter Nama (Search)
    const matchesSearch = (petugas.nama_petugas || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Filter Hak Akses (Role)
    const matchesRole = filterRole ? petugas.role === filterRole : true;
    
    // 3. Filter Status Akun
    let matchesStatus = true;
    if (filterStatus === 'aktif') matchesStatus = petugas.is_active === true;
    if (filterStatus === 'nonaktif') matchesStatus = petugas.is_active === false;

    return matchesSearch && matchesRole && matchesStatus;
  }).sort((a, b) => {
    // 4. Sortir Waktu Pendaftaran
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });


  // --- FUNGSI BUKA MODAL ---
  const handleOpenEdit = (petugas: Petugas) => {
    setEditData(petugas);
    setIsEditOpen(true);
  };

  // --- FUNGSI SUBMIT EDIT (UPDATE) ---
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('petugas')
        .update({
          nama_petugas: editData.nama_petugas,
          role: editData.role,
          is_active: editData.is_active,
        })
        .eq('id', editData.id);

      if (error) throw error;

      setIsEditOpen(false);
      fetchPetugas();
    } catch (error) {
      alert('Gagal memperbarui data petugas!');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- FUNGSI SUBMIT TAMBAH (CREATE VIA BACKEND) ---
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesi tidak valid, silakan login ulang.');

      const response = await fetch('http://localhost:3000/api/create-petugas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session.access_token 
        },
        body: JSON.stringify(addFormData)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Terjadi kesalahan pada server');
      }

      alert('Petugas berhasil ditambahkan!');
      setIsAddOpen(false);
      setAddFormData({ email: '', password: '', nama_petugas: '', role: 'teknisi' }); 
      fetchPetugas(); 

    } catch (error: unknown) {
      alert((error as Error).message);
      console.error('Error create petugas:', error);
    } finally {
      setIsAdding(false);
    }
  };

  // --- HELPER UI ---
  const getRoleBadge = (role: string) => {
    if (role === 'admin') return <span className="bg-purple-100 text-purple-700 px-3 py-1 text-xs font-bold rounded-full uppercase">Admin</span>;
    return <span className="bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold rounded-full uppercase">Teknisi</span>;
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) return <span className="flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1 text-xs font-semibold rounded-full w-max border border-green-200"><UserCheck size={14}/> Aktif</span>;
    return <span className="flex items-center gap-1 bg-red-50 text-red-700 px-3 py-1 text-xs font-semibold rounded-full w-max border border-red-200"><UserX size={14}/> Nonaktif</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manajemen Petugas</h2>
          <p className="text-gray-500 text-sm mt-1">Atur hak akses, role, dan status aktif para teknisi lapangan.</p>
        </div>
        
        {/* Tombol Tambah Petugas Baru */}
        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-[#06a0e5] hover:bg-[#058bc9] text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm w-full sm:w-auto justify-center"
        >
          <Plus size={18} />
          Tambah Petugas
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search Nama */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari nama pengguna..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>
        
        {/* Filter Role */}
        <select 
          value={filterRole} 
          onChange={(e) => setFilterRole(e.target.value)}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
        >
          <option value="">Semua Hak Akses</option>
          <option value="admin">Admin</option>
          <option value="teknisi">Teknisi</option>
        </select>

        {/* Filter Status */}
        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
        >
          <option value="">Semua Status Akun</option>
          <option value="aktif">Aktif (Bisa Login)</option>
          <option value="nonaktif">Nonaktif (Terblokir)</option>
        </select>

        {/* Filter Waktu Terdaftar */}
        <select 
          value={sortOrder} 
          onChange={(e) => setSortOrder(e.target.value)}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white text-gray-700 font-medium"
        >
          <option value="desc">Terdaftar: Terbaru</option>
          <option value="asc">Terdaftar: Terlama</option>
        </select>
      </div>

      {/* TABEL PETUGAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold">Nama Pengguna</th>
                <th className="px-6 py-4 font-semibold">Hak Akses (Role)</th>
                <th className="px-6 py-4 font-semibold">Status Akun</th>
                <th className="px-6 py-4 font-semibold">Terdaftar Sejak</th>
                <th className="px-6 py-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredPetugas.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Tidak ada pengguna yang cocok dengan pencarian.</td></tr>
              ) : (
                filteredPetugas.map((petugas) => (
                  <tr key={petugas.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0">
                          {petugas.nama_petugas ? petugas.nama_petugas.substring(0, 1).toUpperCase() : '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{petugas.nama_petugas || 'User Baru'}</p>
                          <p className="text-xs text-gray-400 font-mono">ID: {petugas.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getRoleBadge(petugas.role)}</td>
                    <td className="px-6 py-4 flex">{getStatusBadge(petugas.is_active)}</td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(petugas.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleOpenEdit(petugas)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                        title="Edit Data"
                      >
                        <Edit2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================= */}
      {/* MODAL TAMBAH (CREATE) PETUGAS             */}
      {/* ========================================= */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Buat Akun Petugas Baru</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                <input 
                  type="text" 
                  required
                  placeholder="John Atmin"
                  value={addFormData.nama_petugas} 
                  onChange={e => setAddFormData({...addFormData, nama_petugas: e.target.value})} 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Auth *</label>
                <input 
                  type="email" 
                  required
                  placeholder="John.Atmin@example.com"
                  value={addFormData.email} 
                  onChange={e => setAddFormData({...addFormData, email: e.target.value})} 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Sementara *</label>
                <input 
                  type="text" 
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  value={addFormData.password} 
                  onChange={e => setAddFormData({...addFormData, password: e.target.value})} 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                />
                <p className="text-xs text-gray-500 mt-1">Petugas akan menggunakan password ini untuk login pertama kali.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hak Akses (Role) *</label>
                <select 
                  value={addFormData.role} 
                  onChange={e => setAddFormData({...addFormData, role: e.target.value as 'admin' | 'teknisi'})} 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all"
                >
                  <option value="teknisi">Teknisi Lapangan</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-gray-100">
                <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl">Batal</button>
                <button type="submit" disabled={isAdding} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl disabled:opacity-50">
                  {isAdding ? 'Memproses...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL EDIT PETUGAS                        */}
      {/* ========================================= */}
      {isEditOpen && editData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Edit Profil Petugas</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  required
                  value={editData.nama_petugas || ''} 
                  onChange={e => setEditData({...editData, nama_petugas: e.target.value})} 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hak Akses (Role)</label>
                <select 
                  value={editData.role} 
                  onChange={e => setEditData({...editData, role: e.target.value as 'admin' | 'teknisi'})} 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all"
                >
                  <option value="teknisi">Teknisi Lapangan</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={editData.is_active}
                      onChange={e => setEditData({...editData, is_active: e.target.checked})}
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${editData.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${editData.is_active ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Status Akun Aktif</p>
                    <p className="text-xs text-gray-500">Matikan toggle ini untuk memblokir akses login (Soft Delete).</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-gray-100">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl disabled:opacity-50">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}