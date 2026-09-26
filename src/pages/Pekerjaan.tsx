import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, X, MapPin, Clock, FileText, User, Search, ChevronLeft, ChevronRight, Calendar, Edit2, Trash2 } from 'lucide-react';

// --- DEFINISI TIPE DATA ---
interface Petugas {
  id: string;
  nama_petugas: string;
}

interface Task {
  id: string;
  judul_pekerjaan: string;
  deskripsi: string | null;
  lokasi: string;
  status_terkini: string | null;
  created_at: string;
  petugas_id: string | null;
  target_latitude: number | null;
  target_longitude: number | null;
  petugas: { nama_petugas: string } | null;
}

interface Progress {
  id: string;
  status_progress: string;
  catatan_petugas: string | null;
  foto_bukti_url: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  nama_petugas: string | null;
}

export default function Pekerjaan() {
  // --- STATE UTAMA ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [petugasList, setPetugasList] = useState<Petugas[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- STATE FILTER & SEARCH ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPetugas, setFilterPetugas] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = Terbaru, 'asc' = Terlama

  // --- STATE PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // State Modal Detail & Form
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskProgress, setTaskProgress] = useState<Progress[]>([]);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ judul: '', deskripsi: '', lokasi: '', lat: '', lng: '', petugas_id: '' });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ id: '', judul: '', deskripsi: '', lokasi: '', lat: '', lng: '', petugas_id: '' });


  // --- FUNGSI AMBIL DATA AWAL ---
  const fetchInitialData = useCallback(async () => {
    try {
      const { data: tasksData } = await supabase
        .from('pekerjaan')
        .select(`*, petugas ( nama_petugas )`)
        .order('created_at', { ascending: false });

      if (tasksData) setTasks(tasksData as unknown as Task[]);

      const { data: petugasData } = await supabase
        .from('petugas')
        .select('id, nama_petugas')
        .eq('is_active', true)
        .eq('role', 'teknisi'); 

      if (petugasData) setPetugasList(petugasData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        await fetchInitialData();
      } catch (error) {
        console.error('Error loading initial data:', error);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [fetchInitialData]);

  // --- LOGIKA FILTERING (Dijalankan Otomatis oleh React setiap State Berubah) ---
  const filteredTasks = tasks.filter((task) => {
    // 1. Search (Judul atau Lokasi)
    const matchesSearch = 
      task.judul_pekerjaan.toLowerCase().includes(searchTerm.toLowerCase()) || 
      task.lokasi.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Status
    let matchesStatus = true;
    if (filterStatus) {
      const status = task.status_terkini?.toLowerCase().trim() || '';
      const isBelumDiambil = !status || status === 'null' || status === 'pending';
      const isSelesai = status.includes('selesai');
      
      if (filterStatus === 'belum' && !isBelumDiambil) matchesStatus = false;
      if (filterStatus === 'selesai' && !isSelesai) matchesStatus = false;
      if (filterStatus === 'progress' && (isBelumDiambil || isSelesai)) matchesStatus = false;
    }

    // 3. Petugas
    let matchesPetugas = true;
    if (filterPetugas) {
      if (filterPetugas === 'unassigned') matchesPetugas = !task.petugas_id;
      else matchesPetugas = task.petugas_id === filterPetugas;
    }

    // 4. Tanggal
    let matchesDate = true;
    if (filterDate) {
      // Ambil format YYYY-MM-DD dari database
      const taskDate = task.created_at.split('T')[0];
      matchesDate = taskDate === filterDate;
    }

    return matchesSearch && matchesStatus && matchesPetugas && matchesDate;
  }).sort((a, b) => {const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    
    if (sortOrder === 'desc') {
      return dateB - dateA; // Terbaru di atas
    } else {
      return dateA - dateB; // Terlama di atas
    }
  });

  // --- LOGIKA PAGINATION ---
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  const paginatedTasks = filteredTasks.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  );

  // --- FUNGSI MODAL ---
  const handleOpenDetail = async (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
    setIsLoadingProgress(true);
    setTaskProgress([]);

    try {
      const { data } = await supabase
        .from('progres_pekerjaan')
        .select('*')
        .eq('pekerjaan_id', task.id)
        .order('created_at', { ascending: true });
      if (data) setTaskProgress(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingProgress(false);
    }
  };
  // --- FUNGSI BUKA MODAL EDIT ---
  const handleOpenEdit = () => {
    if (selectedTask) {
      setEditFormData({
        id: selectedTask.id,
        judul: selectedTask.judul_pekerjaan,
        deskripsi: selectedTask.deskripsi || '',
        lokasi: selectedTask.lokasi,
        lat: selectedTask.target_latitude ? String(selectedTask.target_latitude) : '',
        lng: selectedTask.target_longitude ? String(selectedTask.target_longitude) : '',
        petugas_id: selectedTask.petugas_id || ''
      });
      setIsDetailOpen(false); // Tutup detail, buka edit
      setIsEditOpen(true);
    }
  };
  // --- FUNGSI SUBMIT FORM TAMBAH PEKERJAAN---
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await supabase.from('pekerjaan').insert([{
        judul_pekerjaan: formData.judul,
        deskripsi: formData.deskripsi,
        lokasi: formData.lokasi,
        target_latitude: formData.lat ? parseFloat(formData.lat) : null,
        target_longitude: formData.lng ? parseFloat(formData.lng) : null,
        petugas_id: formData.petugas_id || null,
        status_terkini: 'Pending'
      }]);
      setFormData({ judul: '', deskripsi: '', lokasi: '', lat: '', lng: '', petugas_id: '' });
      setIsAddOpen(false);
      setIsLoading(true); 
      fetchInitialData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

// --- FUNGSI SUBMIT EDIT ---
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('pekerjaan')
        .update({
          judul_pekerjaan: editFormData.judul,
          deskripsi: editFormData.deskripsi,
          lokasi: editFormData.lokasi,
          target_latitude: editFormData.lat ? parseFloat(editFormData.lat) : null,
          target_longitude: editFormData.lng ? parseFloat(editFormData.lng) : null,
          petugas_id: editFormData.petugas_id || null,
        })
        .eq('id', editFormData.id);

      if (error) throw error;
      
      setIsEditOpen(false);
      setIsLoading(true);
      fetchInitialData();
    } catch (error) {
      console.error(error);
      alert("Gagal mengupdate pekerjaan!");
    } finally {
      setIsSubmitting(false);
    }
  };
// --- FUNGSI DELETE ---
  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm("Apakah Anda yakin ingin menghapus tugas ini? Semua progres yang sudah dilaporkan juga akan ikut terhapus.");
    if (!confirmDelete) return;

    try {
      setIsLoading(true);
      // Hapus data progres terlebih dahulu untuk menghindari error Foreign Key
      await supabase.from('progres_pekerjaan').delete().eq('pekerjaan_id', id);
      // Baru hapus pekerjaan utamanya
      const { error } = await supabase.from('pekerjaan').delete().eq('id', id);
      
      if (error) throw error;

      setIsDetailOpen(false);
      fetchInitialData();
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus pekerjaan!");
      setIsLoading(false);
    }
  };

  // --- HELPER UI ---
  const getStatusBadge = (status: string | null) => {
    const s = (status || '').toLowerCase();
    if (!s || s === 'null' || s === 'pending') return <span className="bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold rounded-full w-max">Belum Diambil</span>;
    if (s.includes('selesai')) return <span className="bg-green-100 text-green-700 px-3 py-1 text-xs font-semibold rounded-full w-max">{status}</span>;
    return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 text-xs font-semibold rounded-full w-max">{status}</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER TABS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manajemen Pekerjaan</h2>
          <p className="text-gray-500 text-sm mt-1">Kelola dan pantau seluruh penugasan lapangan.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-[#06a0e5] hover:bg-[#058bc9] text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm w-full sm:w-auto justify-center"
        >
          <Plus size={18} />
          Tambah Pekerjaan
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari tugas atau lokasi..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>
        
        {/* Filter Status */}
        <select 
          value={filterStatus} 
          onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
        >
          <option value="">Semua Status</option>
          <option value="belum">Belum Diambil</option>
          <option value="progress">On Progress</option>
          <option value="selesai">Selesai</option>
        </select>

        {/* Filter Petugas */}
        <select 
          value={filterPetugas} 
          onChange={(e) => { setFilterPetugas(e.target.value); setCurrentPage(1); }}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
        >
          <option value="">Semua Teknisi</option>
          <option value="unassigned">-- Belum Ditugaskan --</option>
          {petugasList.map(p => (
            <option key={p.id} value={p.id}>{p.nama_petugas}</option>
          ))}
        </select>

        {/* Filter Tanggal */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white text-gray-700"
          />
        </div>

        {/* Sort Order */}
        <select 
          value={sortOrder} 
          onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white text-gray-700 font-medium"
        >
          <option value="desc">Waktu: Terbaru</option>
          <option value="asc">Waktu: Terlama</option>
        </select>
      </div>

      {/* TABEL UTAMA */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold">Nama Pekerjaan</th>
                <th className="px-6 py-4 font-semibold">Lokasi</th>
                <th className="px-6 py-4 font-semibold">Petugas</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Tanggal Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : paginatedTasks.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Tidak ada pekerjaan yang cocok dengan pencarian.</td></tr>
              ) : (
                paginatedTasks.map((task) => (
                  <tr 
                    key={task.id} 
                    onClick={() => handleOpenDetail(task)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900">{task.judul_pekerjaan}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-50">{task.lokasi}</td>
                    <td className="px-6 py-4 text-gray-600">{task.petugas?.nama_petugas || '-'}</td>
                    <td className="px-6 py-4 flex">{getStatusBadge(task.status_terkini)}</td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(task.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- PAGINATION CONTROLS --- */}
        {!isLoading && filteredTasks.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Tampilkan:</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 bg-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
              <span>baris</span>
            </div>

            <div className="text-sm text-gray-500">
              Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredTasks.length)} dari {filteredTasks.length} data
            </div>

            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================= */}
      {/* MODAL FORM TAMBAH (Kode tetap sama)       */}
      {/* ========================================= */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Buat Penugasan Baru</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Pekerjaan *</label>
                <input required type="text" value={formData.judul} onChange={e => setFormData({...formData, judul: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: Perbaikan Pipa Bocor" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea value={formData.deskripsi} onChange={e => setFormData({...formData, deskripsi: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-20" placeholder="Rincian kendala di lapangan..."></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi (Alamat) *</label>
                <input required type="text" value={formData.lokasi} onChange={e => setFormData({...formData, lokasi: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: Jl. Sudirman No. 12" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Latitude</label>
                  <input type="number" step="any" value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="-6.200000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Longitude</label>
                  <input type="number" step="any" value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="106.816666" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tugaskan Kepada</label>
                <select value={formData.petugas_id} onChange={e => setFormData({...formData, petugas_id: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="">-- Biarkan kosong (Belum Diambil) --</option>
                  {petugasList.map(p => (
                    <option key={p.id} value={p.id}>{p.nama_petugas}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl disabled:opacity-50">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL DETAIL (Kode tetap sama)            */}
      {/* ========================================= */}
      {isDetailOpen && selectedTask && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden relative">
            <button onClick={() => setIsDetailOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:bg-gray-100 p-2 rounded-lg z-10 bg-white shadow-sm border border-gray-100">
              <X size={20} />
            </button>

            <div className="w-full md:w-1/2 p-6 md:p-8 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/50 overflow-y-auto">
              <div className="mb-6">
                <div className="mb-3 flex">{getStatusBadge(selectedTask.status_terkini)}</div>
                <h3 className="text-2xl font-bold text-gray-900 leading-tight">{selectedTask.judul_pekerjaan}</h3>
                <p className="text-gray-500 text-sm mt-1">ID: #{selectedTask.id.substring(0, 8)}</p>
              </div>
              <div className="space-y-5">
                <div className="flex gap-3 text-gray-700">
                  <MapPin size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Lokasi Sasaran</p>
                    <p className="text-sm text-gray-600">{selectedTask.lokasi}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-gray-700">
                  <User size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Ditugaskan Kepada</p>
                    <p className="text-sm text-gray-600">{selectedTask.petugas?.nama_petugas || 'Belum ada teknisi'}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-gray-700">
                  <FileText size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Deskripsi Kendala</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedTask.deskripsi || '-'}</p>
                  </div>
                </div>
              </div>
              {/* Tombol Edit & Delete */}
              <div className="mt-8 flex gap-3 pt-6 border-t border-gray-100">
                <button 
                  onClick={handleOpenEdit} 
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-2.5 rounded-xl font-medium hover:bg-indigo-100 transition-colors text-sm"
                >
                  <Edit2 size={16} /> Edit Tugas
                </button>
                <button 
                  onClick={() => handleDelete(selectedTask.id)} 
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-700 py-2.5 rounded-xl font-medium hover:bg-red-100 transition-colors text-sm"
                >
                  <Trash2 size={16} /> Hapus
                </button>
              </div>
            </div>

            <div className="w-full md:w-1/2 p-6 md:p-8 overflow-y-auto bg-white">
              <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Clock size={18} className="text-indigo-500" /> Timeline Progres
              </h4>
              {isLoadingProgress ? (
                <p className="text-center text-gray-500 text-sm py-10">Memuat laporan petugas...</p>
              ) : taskProgress.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 text-sm">Belum ada progres/laporan dari teknisi.</p>
                </div>
              ) : (
                <div className="pl-2 space-y-6">
                  {taskProgress.map((prog) => (
                    <div key={prog.id} className="relative pl-6 pb-6 border-l-2 border-indigo-100 last:border-0 last:pb-0">
                      <div className="absolute -left-2.25 top-1 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-white"></div>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-gray-900 text-sm">{prog.status_progress}</h5>
                          <span className="text-xs text-gray-500 font-medium">{formatDate(prog.created_at)}</span>
                        </div>
                        {prog.catatan_petugas && <p className="text-sm text-gray-600 mb-3">{prog.catatan_petugas}</p>}
                        {prog.foto_bukti_url && (
                          <a href={prog.foto_bukti_url} target="_blank" rel="noreferrer">
                            <img src={prog.foto_bukti_url} alt="Bukti" className="h-24 w-auto rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
                          </a>
                        )}
                        {prog.latitude && prog.longitude && (
                          <div className="mt-3 flex items-start gap-1.5 text-xs text-indigo-600 bg-indigo-50 p-2 rounded-lg border border-indigo-100 w-max">
                            <MapPin size={14} className="shrink-0 mt-0.5" />
                            <span>
                              Titik Lapor: {prog.latitude}, {prog.longitude}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL FORM EDIT                           */}
      {/* ========================================= */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Edit Penugasan</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Pekerjaan *</label>
                <input required type="text" value={editFormData.judul} onChange={e => setEditFormData({...editFormData, judul: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea value={editFormData.deskripsi} onChange={e => setEditFormData({...editFormData, deskripsi: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-20" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi (Alamat) *</label>
                <input required type="text" value={editFormData.lokasi} onChange={e => setEditFormData({...editFormData, lokasi: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Latitude</label>
                  <input type="number" step="any" value={editFormData.lat} onChange={e => setEditFormData({...editFormData, lat: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Longitude</label>
                  <input type="number" step="any" value={editFormData.lng} onChange={e => setEditFormData({...editFormData, lng: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tugaskan Kepada</label>
                <select value={editFormData.petugas_id} onChange={e => setEditFormData({...editFormData, petugas_id: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="">-- Biarkan kosong (Belum Diambil) --</option>
                  {petugasList.map(p => (
                    <option key={p.id} value={p.id}>{p.nama_petugas}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl disabled:opacity-50">
                  {isSubmitting ? 'Menyimpan...' : 'Update Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}